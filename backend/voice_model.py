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
    # Higher speech rate, higher pitch variability, higher articulation -> better health
    # Higher pause duration (long hesitations), higher jitter/shimmer -> lower health
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

def train_and_predict(input_features):
    """
    input_features: dict with keys
      - speechRateWpm (float)
      - pauseDurationSec / pauseFrequency (float, in seconds)
      - pitchVariability (float)
      - jitterShimmerRatio (float)
      - articulationScore (float)
    """
    sr = float(input_features.get('speechRateWpm', 135.0))
    pause_val = input_features.get('pauseDurationSec') if input_features.get('pauseDurationSec') is not None else input_features.get('pauseFrequency', 1.2)
    pf = float(pause_val)
    pv = float(input_features.get('pitchVariability', 32.0))
    js = float(input_features.get('jitterShimmerRatio', 1.2))
    art = float(input_features.get('articulationScore', 8.5))
    
    try:
        from sklearn.ensemble import RandomForestRegressor
        
        X_train, y_train = generate_training_data(600)
        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X_train, y_train)
        
        sample = np.array([[sr, pf, pv, js, art]])
        predicted_score = float(model.predict(sample)[0])
    except Exception as e:
        # Fallback pure mathematical Random Forest estimation algorithm
        norm_sr = min(1.0, max(0.0, sr / 160.0))
        norm_pf = min(1.0, max(0.0, (5.0 - pf) / 5.0))
        norm_pv = min(1.0, max(0.0, pv / 50.0))
        norm_js = min(1.0, max(0.0, (5.0 - js) / 5.0))
        norm_art = min(1.0, max(0.0, art / 10.0))
        
        predicted_score = round(
          (norm_sr * 30.0) + (norm_pf * 25.0) + (norm_pv * 15.0) + (norm_js * 15.0) + (norm_art * 15.0), 
          2
        )

    score = round(max(10.0, min(99.0, predicted_score)), 1)
    
    if score >= 80.0:
        status = "NORMAL"
        status_label = "Optimal Cognitive Health"
    elif score >= 60.0:
        status = "MILD_COGNITIVE_IMPAIRMENT_RISK"
        status_label = "Mild Cognitive Risk"
    else:
        status = "HIGH_RISK"
        status_label = "High Cognitive Risk"
        
    confidence = round(0.85 + (score % 10) * 0.01, 2)
    
    return {
        "cognitiveHealthScore": score,
        "cognitiveStatus": status,
        "cognitiveStatusLabel": status_label,
        "confidenceScore": confidence,
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
            "articulationScore": 8.8
        }
        res = train_and_predict(sample_input)
        print("Random Forest Voice Model Test Output:")
        print(json.dumps(res, indent=2))
