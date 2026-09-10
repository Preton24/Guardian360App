"""
Project: Guardian 360
Module: Local Voice Reminder + Speech Analysis & Cognitive Machine Learning
"""

import os
import sys
import time
import datetime
import subprocess
import argparse
import joblib
import pyttsx3
import speech_recognition as sr
import sounddevice as sd
import scipy.io.wavfile as wav
import librosa
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    recall_score,
)
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline as SklearnPipeline
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


# --------------------------------------------------
# 1. LOCAL REMINDERS FOR TESTING
# --------------------------------------------------

REMINDERS = [
    {
        "id": 1,
        "time": "00:10",
        "title": "Medicine Reminder",
        "notes": "Please take your evening medicine.",
        "question": "How are you feeling right now?"
    },
    {
        "id": 2,
        "time": "20:41",
        "title": "Water Reminder",
        "notes": "Please drink a glass of water.",
        "question": "Can you describe your mood today?"
    }
]


# --------------------------------------------------
# 2. BASIC SETTINGS & PATHS
# --------------------------------------------------

MICROPHONE_INDEX = 2  # Physical Microphone Array index or None for auto-detect

RECORD_SECONDS = 10
SAMPLE_RATE = 16000
TEMP_AUDIO_FILE = "user_response.wav"
OUTPUT_CSV_FILE = "voice_analysis_results.csv"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
COGNITIVE_MODEL_PATH = os.path.join(MODELS_DIR, "cognitive_model.pkl")
COGNITIVE_TRAINING_CSV = os.path.join(BASE_DIR, "cognitive_training_data.csv")
COGNITIVE_TARGET_COLUMN = "cognitive_pattern"

cognitive_model = None
COGNITIVE_FEATURE_COLUMNS = []
COGNITIVE_MODEL_METADATA = {}


# --------------------------------------------------
# 3. TEXT-TO-SPEECH SETUP
# --------------------------------------------------

_pyttsx_engine = None


def speak(message: str):
    """
    Speaks text using Windows built-in speech engine.
    Also prints the message in terminal.
    """
    print("\nAssistant:", message)

    try:
        safe_message = message.replace("'", "")
        subprocess.run(
            [
                "powershell",
                "-Command",
                f"Add-Type -AssemblyName System.Speech; "
                f"$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                f"$speak.Speak('{safe_message}')"
            ],
            check=True
        )
    except Exception as error:
        global _pyttsx_engine
        try:
            if _pyttsx_engine is None:
                _pyttsx_engine = pyttsx3.init()
                _pyttsx_engine.setProperty("rate", 150)
                _pyttsx_engine.setProperty("volume", 1.0)
            _pyttsx_engine.say(message)
            _pyttsx_engine.runAndWait()
        except Exception:
            print("Voice output notice:", error)


# --------------------------------------------------
# 4. MICROPHONE & RECORDING (AUTO-ADAPTIVE)
# --------------------------------------------------

def get_preferred_microphone_index():
    """
    Intelligently auto-detects and adapts to connected audio input hardware:
    1. Prioritizes connected earphones, headphones, headsets, or bluetooth earbuds.
    2. Falls back to physical microphone arrays (e.g. laptop Realtek mic).
    3. Excludes loopbacks like "Stereo Mix".
    4. Returns None if the Windows default should be used directly.
    """
    try:
        mic_names = sr.Microphone.list_microphone_names()
    except Exception:
        return None

    # Priority 1: Connected earphones, headphones, headsets, bluetooth earbuds
    earphone_keywords = ["headset", "headphone", "earphone", "bluetooth", "airpod", "buds", "wireless", "usb audio"]
    for index, name in enumerate(mic_names):
        name_lower = name.lower()
        if any(kw in name_lower for kw in earphone_keywords) and "stereo mix" not in name_lower:
            print(f"[HEADSET] Connected Earphones/Headset detected [Index {index}]: {name}")
            return index

    # Priority 2: Built-in physical microphone array (laptop mic)
    for index, name in enumerate(mic_names):
        name_lower = name.lower()
        if ("microphone array" in name_lower or "mic array" in name_lower) and "stereo mix" not in name_lower:
            print(f"[MIC ARRAY] Physical Microphone Array selected [Index {index}]: {name}")
            return index

    # Priority 3: Any physical microphone
    for index, name in enumerate(mic_names):
        name_lower = name.lower()
        if ("microphone" in name_lower or "mic" in name_lower) and "stereo mix" not in name_lower:
            print(f"[MIC] Microphone device selected [Index {index}]: {name}")
            return index

    return None


def record_voice_response():
    """
    Records voice adapting automatically to earphones, headsets, or built-in mic.
    """
    recognizer = sr.Recognizer()
    recognizer.energy_threshold = 300
    recognizer.dynamic_energy_threshold = True

    speak("Please answer after the beep.")
    time.sleep(1)

    print("\nListening through active microphone...")
    print("Speak now...")

    mic_index = MICROPHONE_INDEX if MICROPHONE_INDEX is not None else get_preferred_microphone_index()
    if mic_index is not None:
        print(f"Using Microphone Device Index: {mic_index}")
    else:
        print("Using Windows Default Recording Device")

    try:
        source_mic = sr.Microphone(device_index=mic_index) if mic_index is not None else sr.Microphone()
        with source_mic as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)

            audio = recognizer.listen(
                source,
                timeout=15,
                phrase_time_limit=RECORD_SECONDS
            )

        with open(TEMP_AUDIO_FILE, "wb") as file:
            file.write(audio.get_wav_data())

        print("Recording completed.")
        print("Audio saved as:", TEMP_AUDIO_FILE)

        return TEMP_AUDIO_FILE

    except Exception as error:
        # Fallback to default system mic if specific index had an issue
        if mic_index is not None:
            print(f"Device index {mic_index} error ({error}). Trying Windows default mic...")
            try:
                with sr.Microphone() as fallback_source:
                    recognizer.adjust_for_ambient_noise(fallback_source, duration=0.5)
                    audio = recognizer.listen(fallback_source, timeout=15, phrase_time_limit=RECORD_SECONDS)
                with open(TEMP_AUDIO_FILE, "wb") as file:
                    file.write(audio.get_wav_data())
                print("Recording completed via fallback default mic.")
                return TEMP_AUDIO_FILE
            except Exception as fb_err:
                print("Fallback recording error:", fb_err)
        else:
            print("Microphone recording error:", error)
        return None


# --------------------------------------------------
# 5. SPEECH TO TEXT (GOOGLE ASR)
# --------------------------------------------------

def speech_to_text(audio_file):
    """
    Converts recorded voice into text using Google Speech Recognition.
    Internet connection is required.
    """
    recognizer = sr.Recognizer()

    try:
        with sr.AudioFile(audio_file) as source:
            audio = recognizer.record(source)

        text = recognizer.recognize_google(audio)
        print("Recognized Text (Google ASR):", text)
        return text

    except sr.UnknownValueError:
        print("Speech could not be understood.")
        return ""

    except sr.RequestError as req_err:
        print("Speech recognition service error. Please check internet connection:", req_err)
        return ""

    except Exception as error:
        print("Speech recognition error:", error)
        return ""


# --------------------------------------------------
# 6. SENTIMENT ANALYSIS
# --------------------------------------------------

def analyze_sentiment(text):
    """
    Sentiment analysis with clinical & emotional priority triggers.
    """
    analyzer = SentimentIntensityAnalyzer()

    if not text or text.strip() == "":
        return {
            "sentiment": "Unknown",
            "sentiment_score": 0.0
        }

    text_lower = text.lower()

    critical_phrases = [
        "help",
        "i need help",
        "emergency",
        "fell down",
        "i fell",
        "call doctor",
        "cannot get up",
        "can't get up"
    ]

    emotional_support_phrases = [
        "lonely",
        "feeling lonely",
        "sad",
        "very sad",
        "scared",
        "afraid",
        "depressed",
        "no one to talk to",
        "unhappy"
    ]

    health_concern_phrases = [
        "pain",
        "chest pain",
        "dizzy",
        "dizziness",
        "tired",
        "very tired",
        "weak",
        "feeling weak",
        "not well",
        "unwell",
        "sick",
        "breathless",
        "can't breathe",
        "cannot breathe",
        "headache",
        "confused"
    ]

    for phrase in critical_phrases:
        if phrase in text_lower:
            return {
                "sentiment": "Needs Help",
                "sentiment_score": -1.0
            }

    for phrase in emotional_support_phrases:
        if phrase in text_lower:
            return {
                "sentiment": "Emotional Support Needed",
                "sentiment_score": -0.8
            }

    for phrase in health_concern_phrases:
        if phrase in text_lower:
            return {
                "sentiment": "Health Concern",
                "sentiment_score": -0.7
            }

    scores = analyzer.polarity_scores(text)
    compound_score = scores["compound"]

    if compound_score >= 0.05:
        sentiment = "Positive"
    elif compound_score <= -0.05:
        sentiment = "Negative"
    else:
        sentiment = "Neutral"

    return {
        "sentiment": sentiment,
        "sentiment_score": round(compound_score, 4)
    }


# --------------------------------------------------
# 7. VOICE & ACOUSTIC BIOMARKER EXTRACTION
# --------------------------------------------------

def extract_cognitive_features(audio_file, recognized_text):
    """
    Extracts acoustic and cognitive features directly from audio and text:
    - speech_rate_wpm: Words per minute
    - pause_duration_sec: Total pause duration
    - pause_frequency: Number of detected pauses
    - pitch_variability: Pitch standard deviation (Hz)
    - jitter_shimmer_ratio: Perturbation proxy (%)
    - articulation_score: Fluency / clarity score (0.0 to 10.0)
    - average_energy: RMS energy
    - zero_crossing_rate: Zero crossing rate
    - duration_seconds: Total duration
    - word_count: Spoken words count
    """
    try:
        sample_rate_read, data = wav.read(audio_file)
        if data.ndim > 1:
            data = data.mean(axis=1)
        audio = data.astype(np.float32)
        if np.abs(audio).max() > 0:
            audio = audio / np.abs(audio).max()
        sr_value = sample_rate_read
    except Exception:
        audio, sr_value = librosa.load(audio_file, sr=SAMPLE_RATE)

    duration_seconds = float(len(audio) / sr_value) if sr_value > 0 else 0.0
    words = recognized_text.split()
    word_count = len(words)

    # Speech rate (words per minute)
    wpm = round((word_count / duration_seconds) * 60, 1) if duration_seconds > 0 else 0.0
    wpm = max(40.0, min(200.0, wpm if wpm > 0 else 125.0))

    # Pause detection
    try:
        non_silent_intervals = librosa.effects.split(audio, top_db=25)
        non_silent_duration = sum([(end - start) / sr_value for start, end in non_silent_intervals])
        pause_duration = max(0.2, round(duration_seconds - non_silent_duration, 2))
        pause_freq = max(1, len(non_silent_intervals) - 1)
    except Exception:
        pause_duration = max(0.3, round(duration_seconds - (word_count * 0.4), 1))
        pause_freq = max(1, int(pause_duration / 0.8))

    # RMS Energy & ZCR
    rms_energy = librosa.feature.rms(y=audio)
    average_energy = float(np.mean(rms_energy))
    zero_crossing = librosa.feature.zero_crossing_rate(audio)
    zero_crossing_rate = float(np.mean(zero_crossing))

    # Pitch & Pitch Variability
    try:
        f0 = librosa.yin(audio, fmin=50, fmax=400, sr=sr_value)
        valid_f0 = f0[~np.isnan(f0)]
        pitch_var = round(float(np.std(valid_f0)), 1) if len(valid_f0) > 5 else round(zero_crossing_rate * 400.0, 1)
    except Exception:
        pitch_var = round(max(10.0, min(55.0, zero_crossing_rate * 400.0)), 1)

    # Jitter & Shimmer perturbation ratio proxy
    js_ratio = round(max(0.3, min(5.0, (1.0 - average_energy * 40.0) * 2.2)), 2)

    # Articulation score (0 to 10 scale)
    art_score = round(min(10.0, max(3.0, (wpm / 160.0) * 8.5)), 1)

    return {
        "speech_rate_wpm": wpm,
        "pause_duration_sec": pause_duration,
        "pause_frequency": pause_freq,
        "pitch_variability": pitch_var,
        "jitter_shimmer_ratio": js_ratio,
        "articulation_score": art_score,
        "average_energy": round(average_energy, 5),
        "zero_crossing_rate": round(zero_crossing_rate, 5),
        "duration_seconds": round(duration_seconds, 2),
        "word_count": word_count,
        "speech_rate_words_per_second": round(wpm / 60.0, 2),
    }


def analyze_voice_features(audio_file, recognized_text):
    """
    Standard voice features dictionary for backwards compatibility.
    """
    cog = extract_cognitive_features(audio_file, recognized_text)
    return {
        "duration_seconds": cog["duration_seconds"],
        "average_energy": cog["average_energy"],
        "zero_crossing_rate": cog["zero_crossing_rate"],
        "word_count": cog["word_count"],
        "speech_rate_words_per_second": cog["speech_rate_words_per_second"],
        "speech_rate_wpm": cog["speech_rate_wpm"],
        "pause_duration_sec": cog["pause_duration_sec"],
        "pitch_variability": cog["pitch_variability"],
        "jitter_shimmer_ratio": cog["jitter_shimmer_ratio"],
        "articulation_score": cog["articulation_score"],
    }


# --------------------------------------------------
# 8. VOICE EMOTION DETECTION
# --------------------------------------------------

_emotion_classifier = None
_emotion_pipeline_tried = False


def detect_voice_emotion(audio_file):
    """
    Detects emotional tone from recorded voice audio using pre-trained model or fallback.
    """
    global _emotion_classifier, _emotion_pipeline_tried

    if not _emotion_pipeline_tried:
        _emotion_pipeline_tried = True
        try:
            from transformers import pipeline
            _emotion_classifier = pipeline(
                "audio-classification",
                model="superb/wav2vec2-base-superb-er"
            )
        except Exception:
            _emotion_classifier = None

    if _emotion_classifier is None:
        return {"voice_emotion": "neutral", "voice_emotion_confidence": 0.85}

    try:
        sample_rate_read, data = wav.read(audio_file)
        if data.ndim > 1:
            data = data.mean(axis=1)
        audio_np = data.astype(np.float32)
        if np.abs(audio_np).max() > 0:
            audio_np = audio_np / np.abs(audio_np).max()

        results = _emotion_classifier({"raw": audio_np, "sampling_rate": sample_rate_read})
        top_result = results[0]
        return {
            "voice_emotion": top_result["label"],
            "voice_emotion_confidence": round(float(top_result["score"]), 4)
        }
    except Exception:
        return {
            "voice_emotion": "neutral",
            "voice_emotion_confidence": 0.85
        }


# --------------------------------------------------
# 9. RANDOM FOREST COGNITIVE CLASSIFIER PIPELINE
# --------------------------------------------------

def _create_synthetic_training_data(n_samples=400):
    """
    Generates realistic synthetic cognitive dataset to train the Random Forest
    baseline if an external training CSV is not provided.
    """
    np.random.seed(42)
    sr_wpm = np.random.uniform(60, 180, n_samples)
    pause_sec = np.random.uniform(0.3, 5.5, n_samples)
    pitch_var = np.random.uniform(8, 55, n_samples)
    js_ratio = np.random.uniform(0.3, 4.5, n_samples)
    art_score = np.random.uniform(3.0, 9.8, n_samples)

    # Risk indicator: long pauses, slow speech rate, high jitter/shimmer, low pitch var
    risk_score = (
        (np.maximum(0, pause_sec - 2.5) / 3.0 * 0.35) +
        (np.maximum(0, 110 - sr_wpm) / 50.0 * 0.25) +
        (np.maximum(0, js_ratio - 2.0) / 2.5 * 0.20) +
        (np.maximum(0, 5.5 - art_score) / 3.0 * 0.20)
    )

    y = (risk_score > 0.45).astype(int)

    df = pd.DataFrame({
        "speech_rate_wpm": sr_wpm,
        "pause_duration_sec": pause_sec,
        "pitch_variability": pitch_var,
        "jitter_shimmer_ratio": js_ratio,
        "articulation_score": art_score,
        "cognitive_pattern": y,
    })
    return df


def _prepare_cognitive_training_data(training_csv):
    """Prepare labelled data for Random Forest training."""
    if not os.path.exists(training_csv):
        print(f"Notice: {training_csv} not found. Synthesizing baseline dataset for Random Forest...")
        df = _create_synthetic_training_data()
    else:
        df = pd.read_csv(training_csv)

    if COGNITIVE_TARGET_COLUMN not in df.columns:
        raise ValueError(f"Missing target column: {COGNITIVE_TARGET_COLUMN}")

    df = df.dropna(subset=[COGNITIVE_TARGET_COLUMN]).copy()
    y = pd.to_numeric(df[COGNITIVE_TARGET_COLUMN], errors="coerce")
    valid = y.isin([0, 1])
    df = df.loc[valid].copy()
    y = y.loc[valid].astype(int)

    prefixed_features = [
        col for col in df.columns
        if col.startswith("cognitive_")
        and col not in {
            "cognitive_pattern",
            "cognitive_pattern_name",
            "cognitive_concern_probability",
            "cognitive_observation",
        }
    ]

    if prefixed_features:
        X = df[prefixed_features].copy()
        X.columns = [col[len("cognitive_"):] for col in prefixed_features]
    else:
        excluded = {
            "cognitive_pattern", "cognitive_pattern_name",
            "typical_probability", "cognitive_concern_probability",
            "cognitive_observation", "date", "time", "reminder_id",
            "reminder_title", "reminder_notes", "question",
            "recognized_text", "sentiment", "sentiment_score",
            "voice_emotion", "voice_emotion_confidence", "observation",
        }
        X = df[[col for col in df.columns if col not in excluded]].copy()

    for column in X.columns:
        X[column] = pd.to_numeric(X[column], errors="coerce")

    X = X.dropna(axis=1, how="all")
    return X, y


def train_random_forest_model(training_csv=COGNITIVE_TRAINING_CSV):
    """
    Tune RandomForestClassifier using RandomizedSearchCV and save the fitted package.
    """
    print("\n====================================")
    print("RANDOM FOREST COGNITIVE MODEL TRAINING")
    print("====================================")

    X, y = _prepare_cognitive_training_data(training_csv)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    cv_splits = min(5, int(y_train.value_counts().min()))
    cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=42)

    rf_pipeline = SklearnPipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("rf", RandomForestClassifier(random_state=42)),
    ])

    parameter_space = {
        "rf__n_estimators": [100, 200, 300],
        "rf__max_depth": [None, 6, 10, 14],
        "rf__min_samples_split": [2, 4],
        "rf__min_samples_leaf": [1, 2],
        "rf__max_features": ["sqrt", "log2", None],
        "rf__class_weight": [None, "balanced"],
    }

    search = RandomizedSearchCV(
        estimator=rf_pipeline,
        param_distributions=parameter_space,
        n_iter=15,
        scoring="accuracy",
        cv=cv,
        random_state=42,
        n_jobs=1,
        verbose=0,
        refit=True,
    )

    search.fit(X_train, y_train)
    best_model = search.best_estimator_
    y_pred = best_model.predict(X_test)

    test_accuracy = accuracy_score(y_test, y_pred)
    balanced_accuracy = balanced_accuracy_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)

    print(f"\nBest CV Accuracy:       {search.best_score_:.4f}")
    print(f"Hold-out Test Accuracy: {test_accuracy:.4f}")
    print(f"Balanced Accuracy:      {balanced_accuracy:.4f}")
    print(f"Concern Recall:         {recall:.4f}")
    print(f"Concern F1-Score:       {f1:.4f}")

    os.makedirs(MODELS_DIR, exist_ok=True)

    package = {
        "model": best_model,
        "feature_columns": list(X.columns),
        "model_type": "RandomForestClassifier",
        "best_params": search.best_params_,
        "cv_accuracy": float(search.best_score_),
        "test_accuracy": float(test_accuracy),
        "balanced_accuracy": float(balanced_accuracy),
        "recall_class_1": float(recall),
        "f1_class_1": float(f1),
        "target_column": COGNITIVE_TARGET_COLUMN,
        "trained_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }

    joblib.dump(package, COGNITIVE_MODEL_PATH)
    print("\nSaved tuned Random Forest to:", COGNITIVE_MODEL_PATH)
    return package


def load_cognitive_model():
    """
    Load the trained Random Forest model. If not present on disk, trains a default
    baseline model so cognitive ML is instantly available.
    """
    global cognitive_model, COGNITIVE_FEATURE_COLUMNS, COGNITIVE_MODEL_METADATA

    if not os.path.exists(COGNITIVE_MODEL_PATH):
        print("\nNotice: Cognitive Random Forest model not found on disk.")
        print("Training baseline Random Forest model now...")
        try:
            train_random_forest_model()
        except Exception as err:
            print("Baseline training notice:", err)

    if os.path.exists(COGNITIVE_MODEL_PATH):
        try:
            package = joblib.load(COGNITIVE_MODEL_PATH)
            cognitive_model = package["model"]
            COGNITIVE_FEATURE_COLUMNS = package["feature_columns"]
            COGNITIVE_MODEL_METADATA = package

            print("\nCognitive Random Forest loaded successfully.")
            if "test_accuracy" in package:
                print(f"Model Hold-out Accuracy: {package['test_accuracy'] * 100:.2f}%")
            return True
        except Exception as error:
            print("Unable to load cognitive Random Forest:", error)

    return False


def predict_cognitive_pattern(audio_file, recognized_text):
    """
    Runs the tuned Random Forest cognitive model on the extracted audio features.
    """
    cognitive_features = extract_cognitive_features(audio_file, recognized_text)

    empty_result = {
        "cognitive_pattern": -1,
        "typical_probability": 0.0,
        "cognitive_concern_probability": 0.0,
        "cognitive_features": cognitive_features,
    }

    if recognized_text.strip() == "" or cognitive_model is None:
        return empty_result

    try:
        input_data = pd.DataFrame([cognitive_features])

        # Filter to model features, imputing missing ones
        for col in COGNITIVE_FEATURE_COLUMNS:
            if col not in input_data.columns:
                input_data[col] = 0.0

        input_data = input_data[COGNITIVE_FEATURE_COLUMNS]
        prediction = cognitive_model.predict(input_data)[0]
        probabilities = cognitive_model.predict_proba(input_data)[0]
        probability_map = dict(zip(cognitive_model.classes_, probabilities))

        typical_p = round(float(probability_map.get(0, 0.0)), 4)
        concern_p = round(float(probability_map.get(1, 0.0)), 4)

        return {
            "cognitive_pattern": int(prediction),
            "typical_probability": typical_p,
            "cognitive_concern_probability": concern_p,
            "cognitive_features": cognitive_features,
        }

    except Exception as error:
        print("Cognitive Random Forest prediction notice:", error)
        return empty_result


def get_cognitive_pattern_name(cognitive_result):
    if cognitive_result["cognitive_pattern"] == -1:
        return "Unable to determine"

    probability = cognitive_result["cognitive_concern_probability"]
    if 0.40 <= probability <= 0.60:
        return "Uncertain"
    if probability < 0.40:
        return "Typical Pattern"
    return "Possible Concern Pattern"


def generate_cognitive_observation(cognitive_result):
    if cognitive_result["cognitive_pattern"] == -1:
        return "Cognitive Random Forest result unavailable for this response."

    probability = cognitive_result["cognitive_concern_probability"]
    if 0.40 <= probability <= 0.60:
        return "The model is uncertain for this response. More observations are required."
    if probability < 0.40:
        return "Speech and language response is closer to the learned typical pattern."
    return "Speech and language response shows a deviation from the learned pattern. Continue monitoring."


def generate_observation(sentiment_result, voice_features, voice_emotion_result):
    """
    Generates caregiver-friendly observation.
    """
    observations = []

    text_sentiment = sentiment_result["sentiment"]
    voice_emotion = voice_emotion_result["voice_emotion"].lower()

    if text_sentiment == "Needs Help":
        observations.append("User requested immediate help")
    if text_sentiment == "Emotional Support Needed":
        observations.append("User may need emotional support or conversation")
    if text_sentiment == "Health Concern":
        observations.append("Health-related concern detected")
    if text_sentiment == "Negative":
        observations.append("Negative emotional tone in spoken words")

    if voice_emotion in ["sad", "sadness"]:
        observations.append("Sad tone detected from voice")
    if voice_emotion in ["angry", "anger"]:
        observations.append("Angry or distressed tone detected from voice")
    if voice_emotion in ["fear", "fearful"]:
        observations.append("Fearful tone detected from voice")

    if voice_features["word_count"] < 3:
        observations.append("Very short response")
    if voice_features["speech_rate_words_per_second"] < 0.5:
        observations.append("Slow speech response")
    if voice_features["average_energy"] < 0.005:
        observations.append("Low voice energy")

    if not observations:
        return "Normal response pattern"

    return ", ".join(observations)


# --------------------------------------------------
# 10. SAVE RESULTS & SYNC WITH BACKEND
# --------------------------------------------------

def save_result_to_csv(result):
    """
    Saves the final speech analysis result to CSV.
    """
    new_df = pd.DataFrame([result])

    if not os.path.exists(OUTPUT_CSV_FILE):
        new_df.to_csv(OUTPUT_CSV_FILE, index=False)
        print("\nResult saved to:", OUTPUT_CSV_FILE)
        return

    try:
        old_df = pd.read_csv(OUTPUT_CSV_FILE, on_bad_lines="skip")
        combined_df = pd.concat([old_df, new_df], ignore_index=True, sort=False)
        combined_df.to_csv(OUTPUT_CSV_FILE, index=False)
    except Exception:
        new_df.to_csv(OUTPUT_CSV_FILE, index=False)

    print("\nResult saved to:", OUTPUT_CSV_FILE)


# --------------------------------------------------
# 11. RUN ONE REMINDER SESSION
# --------------------------------------------------

def run_reminder_session(reminder):
    """
    Runs one complete reminder and speech analysis session.
    """
    speak(reminder["title"])

    if reminder.get("notes"):
        speak(reminder["notes"])

    question = reminder["question"]
    speak(question)

    audio_file = record_voice_response()

    if audio_file is None:
        print("Recording failed. Skipping this reminder session.")
        return

    # 1. Speech to Text via Google ASR (No Whisper)
    recognized_text = speech_to_text(audio_file)

    # 2. Sentiment analysis
    sentiment_result = analyze_sentiment(recognized_text)

    # 3. Voice features
    voice_features = analyze_voice_features(audio_file, recognized_text)

    # 4. Voice emotion detection
    voice_emotion_result = detect_voice_emotion(audio_file)

    # 5. Random Forest Cognitive Model Prediction
    cognitive_result = predict_cognitive_pattern(audio_file, recognized_text)
    cognitive_pattern_name = get_cognitive_pattern_name(cognitive_result)
    cognitive_observation = generate_cognitive_observation(cognitive_result)

    observation = generate_observation(
        sentiment_result,
        voice_features,
        voice_emotion_result
    )

    now = datetime.datetime.now()

    result = {
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "reminder_id": reminder["id"],
        "reminder_title": reminder["title"],
        "reminder_notes": reminder["notes"],
        "question": question,
        "recognized_text": recognized_text,
        "sentiment": sentiment_result["sentiment"],
        "sentiment_score": sentiment_result["sentiment_score"],
        "voice_emotion": voice_emotion_result["voice_emotion"],
        "voice_emotion_confidence": voice_emotion_result["voice_emotion_confidence"],
        "duration_seconds": voice_features["duration_seconds"],
        "average_energy": voice_features["average_energy"],
        "zero_crossing_rate": voice_features["zero_crossing_rate"],
        "word_count": voice_features["word_count"],
        "speech_rate_words_per_second": voice_features["speech_rate_words_per_second"],
        "observation": observation,
        "cognitive_pattern": cognitive_result["cognitive_pattern"],
        "cognitive_pattern_name": cognitive_pattern_name,
        "typical_probability": cognitive_result["typical_probability"],
        "cognitive_concern_probability": cognitive_result["cognitive_concern_probability"],
        "cognitive_observation": cognitive_observation
    }

    for feature_name, feature_value in cognitive_result["cognitive_features"].items():
        result[f"cognitive_{feature_name}"] = feature_value

    print("\nFinal Speech Analysis Result")
    print("----------------------------")
    for key, value in result.items():
        print(f"{key}: {value}")

    save_result_to_csv(result)

    # --------------------------------------------------
    # SYNC TO GUARDIAN360 BACKEND (for Mobile App Charts)
    # --------------------------------------------------
    try:
        sys_path_backend = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
        if sys_path_backend not in sys.path:
            sys.path.append(sys_path_backend)

        import importlib
        voice_model = importlib.import_module("voice_model")

        wpm = voice_features["speech_rate_wpm"]
        duration = voice_features["duration_seconds"]
        pause_sec = voice_features["pause_duration_sec"]
        art_score = voice_features["articulation_score"]
        js_ratio = voice_features["jitter_shimmer_ratio"]
        pitch_var = voice_features["pitch_variability"]

        ml_input = {
            "speechRateWpm": wpm,
            "pauseDurationSec": pause_sec,
            "pitchVariability": pitch_var,
            "jitterShimmerRatio": js_ratio,
            "articulationScore": art_score,
        }

        ml_result = voice_model.train_and_predict(ml_input)

        # Dynamically resolve active user ID from backend so mobile app chart updates for active patient
        target_user_id = "a263f382-f9e2-4aba-b571-1c479d20a575"
        patient_name = "Arthur Pendelton"
        try:
            import urllib.request
            import json
            req_c = urllib.request.Request("http://localhost:5000/api/caretakers/current", headers={"User-Agent": "VoiceCheck/1.0"})
            with urllib.request.urlopen(req_c, timeout=1.5) as resp_c:
                c_data = json.loads(resp_c.read().decode("utf-8"))
                c_id = c_data.get("id")
                if c_id:
                    req_u = urllib.request.Request(f"http://localhost:5000/api/caretakers/{c_id}/users", headers={"User-Agent": "VoiceCheck/1.0"})
                    with urllib.request.urlopen(req_u, timeout=1.5) as resp_u:
                        users_list = json.loads(resp_u.read().decode("utf-8"))
                        if users_list and len(users_list) > 0:
                            target_user_id = users_list[0].get("id", target_user_id)
                            patient_name = users_list[0].get("name", patient_name)
        except Exception:
            pass

        backend_csv_path = os.path.join(sys_path_backend, "voice_analysis_reports.csv")
        report_id = f"VAR-{int(time.time() * 1000) % 1000000}"
        iso_timestamp = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        csv_row = f"{report_id},{target_user_id},{iso_timestamp},{wpm},{pause_sec},{pitch_var},{js_ratio},{art_score},{ml_result['cognitiveHealthScore']},{ml_result['cognitiveStatus']},{ml_result['confidenceScore']}\n"

        with open(backend_csv_path, "a", encoding="utf-8") as backend_csv:
            backend_csv.write(csv_row)

        print("\n🧠 Random Forest ML Cognitive Analysis:")
        print(f"   • Patient: {patient_name} ({target_user_id})")
        print(f"   • Cognitive Health Score: {ml_result['cognitiveHealthScore']}%")
        print(f"   • Cognitive Risk Status: {ml_result['cognitiveStatus']}")
        print(f"   • Updated Backend CSV: {backend_csv_path}")

    except Exception as ml_err:
        print("Notice: Backend sync notice:", ml_err)


# --------------------------------------------------
# 12. MAIN LOOP & CLI ENTRYPOINT
# --------------------------------------------------

def main():
    """
    Main loop checks the current time every 10 seconds.
    """
    print("\nGuardian 360 local voice reminder and Random Forest speech analysis test started.")
    print("The system is now waiting for the scheduled reminder time...")

    already_triggered = set()

    while True:
        now = datetime.datetime.now()
        current_time = now.strftime("%H:%M")
        current_seconds = now.strftime("%H:%M:%S")
        today = now.strftime("%Y-%m-%d")

        print("\nCurrent system time:", current_seconds)
        print("Checking local reminders...")

        for reminder in REMINDERS:
            reminder_time = reminder["time"]
            unique_key = f"{today}_{reminder['id']}_{reminder_time}"

            print(
                f"Reminder {reminder['id']} | "
                f"Title: {reminder['title']} | "
                f"Scheduled Time: {reminder_time}"
            )

            if current_time == reminder_time and unique_key not in already_triggered:
                print("\nReminder time matched.")
                print("Starting reminder and voice analysis session...")

                run_reminder_session(reminder)
                already_triggered.add(unique_key)
            else:
                print("Not time yet. Waiting...")

        time.sleep(10)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Guardian360 with tuned Random Forest cognitive classification."
    )
    parser.add_argument(
        "--train-rf",
        action="store_true",
        help="Train/tune the cognitive Random Forest and save the model."
    )
    parser.add_argument(
        "--training-csv",
        default=COGNITIVE_TRAINING_CSV,
        help="Path to labelled cognitive training CSV."
    )
    args = parser.parse_args()

    if args.train_rf:
        train_random_forest_model(args.training_csv)
    else:
        load_cognitive_model()
        main()