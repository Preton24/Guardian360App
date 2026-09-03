import os
import time
import datetime
import subprocess
import pyttsx3
import speech_recognition as sr
import sounddevice as sd
import scipy.io.wavfile as wav
import librosa
import numpy as np
import pandas as pd

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


# --------------------------------------------------
# 1. LOCAL REMINDERS FOR TESTING
# --------------------------------------------------

REMINDERS = [
    {
        "id": 1,
        "time": "15:54",
        "title": "Medicine Reminder",
        "notes": "Please take your evening medicine.",
        "question": "How are you feeling right now?"
    },
    {
        "id": 2,
        "time": "12:58",
        "title": "Water Reminder",
        "notes": "Please drink a glass of water.",
        "question": "Can you describe your mood today?"
    }
]


# --------------------------------------------------
# 2. BASIC SETTINGS
# --------------------------------------------------

MICROPHONE_INDEX = 2  # Microphone Array (Realtek(R) Audio)

RECORD_SECONDS = 8
SAMPLE_RATE = 16000
TEMP_AUDIO_FILE = "user_response.wav"
OUTPUT_CSV_FILE = "voice_analysis_results.csv"



# --------------------------------------------------
# 3. TEXT-TO-SPEECH SETUP
# --------------------------------------------------

engine = pyttsx3.init()

# Speaking speed
engine.setProperty("rate", 150)

# Volume: 0.0 to 1.0
engine.setProperty("volume", 1.0)


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
        print("Voice output failed:", error)

# --------------------------------------------------
# 4. RECORD USER VOICE
# --------------------------------------------------
def get_physical_microphone_index():
    """
    Finds the first valid physical microphone (avoiding Stereo Mix).
    """
    for index, name in enumerate(sr.Microphone.list_microphone_names()):
        if ("microphone" in name.lower() or "mic" in name.lower()) and "stereo mix" not in name.lower():
            print(f"Selected Microphone Device [Index {index}]: {name}")
            return index
    return None

def record_voice_response():
    """
    Records voice using the active physical microphone array or headset.
    """
    recognizer = sr.Recognizer()
    recognizer.energy_threshold = 300
    recognizer.dynamic_energy_threshold = True

    speak("Please answer after the beep.")
    time.sleep(1)

    print("\nListening through active physical microphone...")
    print("Speak now...")

    mic_index = MICROPHONE_INDEX if MICROPHONE_INDEX is not None else get_physical_microphone_index()
    print(f"Using Microphone Device Index: {mic_index}")

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
        print("Microphone recording error:", error)
        return None


# --------------------------------------------------
# 5. SPEECH TO TEXT
# --------------------------------------------------

def speech_to_text(audio_file):
    """
    Converts recorded voice into text using OpenAI Whisper ASR.
    Falls back to Google Speech Recognition if needed.
    """
    try:
        import whisper
        # Load lightweight Whisper model (tiny/base)
        model = whisper.load_model("tiny")
        result = model.transcribe(audio_file, fp16=False)
        text = result.get("text", "").strip()
        print("Recognized Text (Whisper ASR):", text)
        return text

    except Exception as whisper_err:
        print(f"Notice: Whisper ASR unavailable ({whisper_err}). Using Google ASR fallback...")
        recognizer = sr.Recognizer()
        with sr.AudioFile(audio_file) as source:
            audio = recognizer.record(source)

        try:
            text = recognizer.recognize_google(audio)
            print("Recognized Text (Google ASR):", text)
            return text

        except sr.UnknownValueError:
            print("Speech could not be understood.")
            return ""
        except sr.RequestError:
            print("Speech recognition service error. Check internet connection.")
            return ""



# --------------------------------------------------
# 6. SENTIMENT ANALYSIS
# --------------------------------------------------

def analyze_sentiment(text):
    """
    Improved sentiment analysis for Guardian 360.

    Priority:
    1. Emergency / help phrases
    2. Emotional support / loneliness phrases
    3. Health concern phrases
    4. Normal VADER sentiment
    """

    analyzer = SentimentIntensityAnalyzer()

    if text.strip() == "":
        return {
            "sentiment": "Unknown",
            "sentiment_score": 0.0
        }

    text_lower = text.lower()

    # Critical emergency/help phrases
    critical_phrases = [
        "help",
        "need help",
        "i need help",
        "please help",
        "emergency",
        "save me",
        "call someone",
        "call caretaker",
        "call caregiver",
        "call doctor",
        "call ambulance",
        "i fell",
        "i have fallen",
        "fallen down",
        "can't get up",
        "cannot get up",
        "unable to get up"
    ]

    # Emotional support / loneliness phrases
    emotional_support_phrases = [
        "i need someone to talk",
        "need someone to talk",
        "someone to talk",
        "talk to someone",
        "i want to talk",
        "need to talk",
        "i feel lonely",
        "feeling lonely",
        "i am lonely",
        "lonely",
        "alone",
        "i feel alone",
        "feeling alone",
        "no one is there",
        "nobody is there",
        "i feel sad",
        "feeling sad",
        "i am sad",
        "i am scared",
        "feeling scared",
        "i feel anxious",
        "feeling anxious"
    ]

    # Health discomfort phrases
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

    # Normal VADER sentiment analysis
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
# 7. VOICE FEATURE ANALYSIS
# --------------------------------------------------

def analyze_voice_features(audio_file, recognized_text):
    """
    Extracts basic speech features from the recorded audio.

    Features:
    1. Duration
    2. Average energy
    3. Zero crossing rate
    4. Word count
    5. Speech rate
    """

    audio, sr_value = librosa.load(audio_file, sr=SAMPLE_RATE)

    duration_seconds = librosa.get_duration(y=audio, sr=sr_value)

    rms_energy = librosa.feature.rms(y=audio)
    average_energy = float(np.mean(rms_energy))

    zero_crossing = librosa.feature.zero_crossing_rate(audio)
    zero_crossing_rate = float(np.mean(zero_crossing))

    words = recognized_text.split()
    word_count = len(words)

    if duration_seconds > 0:
        speech_rate = word_count / duration_seconds
    else:
        speech_rate = 0.0

    return {
        "duration_seconds": round(duration_seconds, 2),
        "average_energy": round(average_energy, 5),
        "zero_crossing_rate": round(zero_crossing_rate, 5),
        "word_count": word_count,
        "speech_rate_words_per_second": round(speech_rate, 2)
    }

from transformers import pipeline

emotion_classifier = pipeline(
    "audio-classification",
    model="superb/wav2vec2-base-superb-er"
)
def detect_voice_emotion(audio_file):
    """
    Detects emotional tone from the recorded voice audio.

    This uses a pre-trained audio emotion recognition model.
    It analyzes the sound/tone of the voice, not the words.
    """

    try:
        results = emotion_classifier(audio_file)

        top_result = results[0]

        emotion = top_result["label"]
        confidence = round(top_result["score"], 4)

        return {
            "voice_emotion": emotion,
            "voice_emotion_confidence": confidence
        }

    except Exception as error:
        print("Voice emotion detection error:", error)

        return {
            "voice_emotion": "Unknown",
            "voice_emotion_confidence": 0.0
        }

# --------------------------------------------------
# 8. BASIC COGNITIVE / VOICE OBSERVATION
# --------------------------------------------------

def generate_observation(sentiment_result, voice_features, voice_emotion_result):
    """
    Generates caregiver-friendly observation using:
    1. Text sentiment
    2. Basic voice features
    3. ML-based voice emotion detection
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
# 9. SAVE RESULT TO CSV
# --------------------------------------------------

def save_result_to_csv(result):
    """
    Saves the final speech analysis result to a CSV file.
    """

    df = pd.DataFrame([result])

    if os.path.exists(OUTPUT_CSV_FILE):
        df.to_csv(OUTPUT_CSV_FILE, mode="a", header=False, index=False)
    else:
        df.to_csv(OUTPUT_CSV_FILE, index=False)

    print("\nResult saved to:", OUTPUT_CSV_FILE)


# --------------------------------------------------
# 10. RUN ONE REMINDER SESSION
# --------------------------------------------------

def run_reminder_session(reminder):
    """
    Runs one complete reminder and speech analysis session.

    Steps:
    1. Speak reminder title.
    2. Speak reminder notes.
    3. Ask question.
    4. Record voice.
    5. Convert voice to text.
    6. Perform sentiment analysis.
    7. Extract voice features.
    8. Generate observation.
    9. Save result to CSV.
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

    recognized_text = speech_to_text(audio_file)

    sentiment_result = analyze_sentiment(recognized_text)

    voice_features = analyze_voice_features(audio_file, recognized_text)
    voice_emotion_result = detect_voice_emotion(audio_file)

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

    "observation": observation
}

    print("\nFinal Speech Analysis Result")
    print("----------------------------")

    for key, value in result.items():
        print(f"{key}: {value}")

    save_result_to_csv(result)


# --------------------------------------------------
# 11. MAIN LOOP
# --------------------------------------------------

def main():
    """
    Main loop checks the current time every 10 seconds.
    If current time matches a local reminder time,
    it runs the reminder session.

    Important:
    The startup message will print immediately.
    The actual reminder will run only when the time matches.
    """

    print("\nGuardian 360 local voice reminder and speech analysis test started.")
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

# --------------------------------------------------
# 12. PROGRAM START
# --------------------------------------------------

if __name__ == "__main__":
    main()