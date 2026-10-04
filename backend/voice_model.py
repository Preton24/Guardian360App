import sys
import json
import os
import csv
import numpy as np

# Synthetic dataset generator for Random Forest Voice Classifier / Regressor
def generate_training_data(n_samples=500):
    np.random.seed(42)
    
    # Feature ranges:
    # 1. speech_rate_wpm: 60 - 180
    # 2. pause_duration_sec: 0.2 - 6.0 sec
    # 3. pitch_variability_hz: 5 - 60 Hz
    # 4. jitter_shimmer_ratio: 0.2 - 6.0 %
    # 5. articulation_score: 2.0 - 10.0
    
    speech_rate = np.random.uniform(60, 180, n_samples)
    pause_sec = np.random.uniform(0.2, 6.0, n_samples)
    pitch_var = np.random.uniform(5, 60, n_samples)
    jitter_shimmer = np.random.uniform(0.2, 6.0, n_samples)
    articulation = np.random.uniform(2.0, 10.0, n_samples)
    
    # Synthetic formula for Cognitive Health Score (0 - 100%)
    raw_scores = (
        (speech_rate / 180.0 * 30.0) +
        (np.maximum(0, 5.0 - pause_sec) / 5.0 * 25.0) +
        (pitch_var / 60.0 * 15.0) +
        (np.maximum(0, 5.0 - jitter_shimmer) / 5.0 * 15.0) +
        (articulation / 10.0 * 15.0)
    )
    
    # Add small noise and clip between 15% and 99%
    scores = np.clip(raw_scores + np.random.normal(0, 2.5, n_samples), 15.0, 99.0)
    
    X = np.column_stack((speech_rate, pause_sec, pitch_var, jitter_shimmer, articulation))
    y = scores
    
    return X, y

def analyze_text_sentiment(text):
    """
    Evaluates clinical and emotional sentiment using clinical keyword rules
    and VADER SentimentIntensityAnalyzer (matching voice_check_test.py).
    """
    if not text or not text.strip():
        return {
            "sentiment": "Neutral & Responsive",
            "sentimentScore": 0.0,
            "isAlert": False
        }

    text_lower = text.lower().strip()

    critical_phrases = [
        "help", "i need help", "emergency", "fell down", "i fell",
        "call doctor", "call 911", "cannot get up", "can't get up",
        "heart attack", "stroke", "bleeding", "ambulance"
    ]

    health_concern_phrases = [
        "pain", "chest pain", "dizzy", "dizziness", "tired", "very tired",
        "weak", "feeling weak", "not well", "not feeling well", "not feeling good",
        "unwell", "sick", "feeling sick", "breathless", "can't breathe",
        "cannot breathe", "headache", "confused", "hurts", "hurting", "ache",
        "aching", "fever", "nausea", "nauseous", "vomit", "vomiting", "sore",
        "hard to walk", "cannot walk", "can't walk"
    ]

    emotional_support_phrases = [
        "lonely", "feeling lonely", "sad", "very sad", "scared", "afraid",
        "depressed", "depression", "unhappy", "no one to talk to", "no one to talk",
        "crying", "anxious", "anxiety", "hopeless", "worried", "frightened"
    ]

    negative_general_phrases = [
        "bad", "i feel bad", "feeling bad", "very bad", "terrible", "awful",
        "horrible", "worse", "worst", "poor", "poorly", "not good", "not fine",
        "not okay", "not happy", "not great", "not alright", "not normal",
        "miserable", "struggling", "no good", "don't feel good", "don't feel well"
    ]

    # Priority 1: Critical Emergency
    for phrase in critical_phrases:
        if phrase in text_lower:
            return {
                "sentiment": "Emergency / Needs Help",
                "sentimentScore": -1.0,
                "isAlert": True
            }

    # Priority 2: Health Concern
    for phrase in health_concern_phrases:
        if phrase in text_lower:
            return {
                "sentiment": "Health Concern Detected",
                "sentimentScore": -0.75,
                "isAlert": True
            }

    # Priority 3: Emotional Support
    for phrase in emotional_support_phrases:
        if phrase in text_lower:
            return {
                "sentiment": "Emotional Support Needed",
                "sentimentScore": -0.7,
                "isAlert": True
            }

    # Priority 4: Explicit Negative Phrases (e.g., "bad", "not good", "terrible")
    for phrase in negative_general_phrases:
        if phrase in text_lower:
            return {
                "sentiment": "Negative / Distress",
                "sentimentScore": -0.65,
                "isAlert": True
            }

    # Priority 5: VADER Polarity Scoring
    compound = 0.0
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        analyzer = SentimentIntensityAnalyzer()
        scores = analyzer.polarity_scores(text)
        compound = float(scores["compound"])
    except Exception:
        pass

    if compound <= -0.15:
        return {
            "sentiment": "Negative / Distress",
            "sentimentScore": round(compound, 4),
            "isAlert": True
        }
    elif compound >= 0.15:
        return {
            "sentiment": "Positive & Healthy",
            "sentimentScore": round(compound, 4),
            "isAlert": False
        }
    else:
        return {
            "sentiment": "Neutral & Responsive",
            "sentimentScore": round(compound, 4),
            "isAlert": False
        }

def train_and_predict(input_features):
    """
    input_features: dict with keys
      - speechRateWpm (float)
      - pauseDurationSec / pauseFrequency (float, in seconds)
      - pitchVariability (float)
      - jitterShimmerRatio (float)
      - articulationScore (float)
      - transcribedText (str, optional)
      - sentiment (str, optional)
    """
    sr = float(input_features.get('speechRateWpm', 135.0))
    pause_val = input_features.get('pauseDurationSec') if input_features.get('pauseDurationSec') is not None else input_features.get('pauseFrequency', 1.2)
    pf = float(pause_val)
    pv = float(input_features.get('pitchVariability', 32.0))
    js = float(input_features.get('jitterShimmerRatio', 1.2))
    art = float(input_features.get('articulationScore', 8.5))
    transcribed_text = str(input_features.get('transcribedText', '') or '')
    
    # 1. Calculate acoustic baseline cognitive score via Random Forest
    try:
        from sklearn.ensemble import RandomForestRegressor
        
        X_train, y_train = generate_training_data(600)
        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X_train, y_train)
        
        sample = np.array([[sr, pf, pv, js, art]])
        acoustic_score = float(model.predict(sample)[0])
    except Exception as e:
        norm_sr = min(1.0, max(0.0, sr / 160.0))
        norm_pf = min(1.0, max(0.0, (5.0 - pf) / 5.0))
        norm_pv = min(1.0, max(0.0, pv / 50.0))
        norm_js = min(1.0, max(0.0, (5.0 - js) / 5.0))
        norm_art = min(1.0, max(0.0, art / 10.0))
        
        acoustic_score = round(
          (norm_sr * 30.0) + (norm_pf * 25.0) + (norm_pv * 15.0) + (norm_js * 15.0) + (norm_art * 15.0), 
          2
        )

    base_score = round(max(15.0, min(99.0, acoustic_score)), 1)
    
    # 2. Analyze sentiment from transcribed text
    sentiment_data = analyze_text_sentiment(transcribed_text)
    sentiment_label = input_features.get('sentiment') or sentiment_data["sentiment"]
    sentiment_score = sentiment_data["sentimentScore"]

    # 3. Clinical integration: Adjust score and status when negative or concern detected
    final_score = base_score
    if sentiment_label == "Emergency / Needs Help":
        final_score = round(min(base_score, 32.0), 1)
        status = "HIGH_RISK"
        status_label = "Emergency / Urgent Attention Required"
    elif sentiment_label == "Health Concern Detected":
        final_score = round(min(base_score, 54.0), 1)
        status = "MILD_COGNITIVE_IMPAIRMENT_RISK"
        status_label = "Health Concern Detected"
    elif sentiment_label == "Emotional Support Needed":
        final_score = round(min(base_score, 62.0), 1)
        status = "MILD_COGNITIVE_IMPAIRMENT_RISK"
        status_label = "Emotional Support Needed"
    elif "negative" in sentiment_label.lower() or sentiment_score <= -0.15:
        # Negative words spoken (e.g. "I feel bad", "not good", "terrible")
        penalty = max(22.0, min(42.0, abs(sentiment_score) * 45.0 + 15.0))
        final_score = round(max(25.0, min(65.0, base_score - penalty)), 1)
        status = "MILD_COGNITIVE_IMPAIRMENT_RISK"
        status_label = "Negative Sentiment / Concern Detected"
    else:
        # Positive or normal speech
        if final_score >= 80.0:
            status = "NORMAL"
            status_label = "Optimal Cognitive Health"
        elif final_score >= 60.0:
            status = "MILD_COGNITIVE_IMPAIRMENT_RISK"
            status_label = "Mild Cognitive Risk"
        else:
            status = "HIGH_RISK"
            status_label = "High Cognitive Risk"

    confidence = round(0.85 + (final_score % 10) * 0.01, 2)
    
    return {
        "cognitiveHealthScore": final_score,
        "cognitiveStatus": status,
        "cognitiveStatusLabel": status_label,
        "confidenceScore": confidence,
        "sentiment": sentiment_label,
        "sentimentScore": sentiment_score,
        "isAlert": sentiment_data["isAlert"],
        "transcribedText": transcribed_text,
        "metrics": {
            "speechRateWpm": sr,
            "pauseDurationSec": pf,
            "pauseFrequency": pf,
            "pitchVariability": pv,
            "jitterShimmerRatio": js,
            "articulationScore": art
        }
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            input_json = json.loads(sys.argv[1])
            res = train_and_predict(input_json)
            print(json.dumps(res))
        except Exception as err:
            print(json.dumps({"error": str(err)}))
    else:
        # Default test run
        sample_input = {
            "speechRateWpm": 142.5,
            "pauseFrequency": 3.2,
            "pitchVariability": 35.0,
            "jitterShimmerRatio": 1.1,
            "articulationScore": 8.8,
            "transcribedText": "I feel bad and have not been doing good today"
        }
        res = train_and_predict(sample_input)
        print("Random Forest Voice Model Test Output:")
        print(json.dumps(res, indent=2))
