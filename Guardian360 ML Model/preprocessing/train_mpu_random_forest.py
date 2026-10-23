# ============================================================
# Guardian 360 - MPU-only Random Forest Baseline
# Sampling-rate-aware feature extraction
# ============================================================

import os
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)
from sklearn.model_selection import train_test_split
import joblib


# ============================================================
# PATHS
# ============================================================

BASE_DIR = r"D:\Guardian360"

WINDOW_DIR = os.path.join(
    BASE_DIR,
    "results",
    "mpu_dataset",
    "windows"
)

RESULT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "mpu_random_forest"
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

os.makedirs(RESULT_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)


# ============================================================
# MPU DATASET SAMPLING RATE
# ============================================================

# The dataset was measured at approximately 9.90 Hz.
# We use this for time-dependent features such as jerk
# and pre/post peak regions.

FS = 9.90


# ============================================================
# LOAD WINDOW DATA
# ============================================================

print("=" * 70)
print("GUARDIAN 360 - MPU RANDOM FOREST BASELINE")
print("=" * 70)

print("\nLoading MPU windows...")

X_all = np.load(
    os.path.join(WINDOW_DIR, "mpu_windows.npz")
)["X"]

y_all = np.load(
    os.path.join(WINDOW_DIR, "mpu_windows.npz")
)["y"]

metadata = pd.read_csv(
    os.path.join(WINDOW_DIR, "mpu_windows_metadata.csv")
)

print(f"X shape       : {X_all.shape}")
print(f"y shape       : {y_all.shape}")
print(f"Metadata rows : {len(metadata)}")


# ============================================================
# VERIFY DATA
# ============================================================

assert len(X_all) == len(y_all)
assert len(X_all) == len(metadata)

assert X_all.shape[1] == 20
assert X_all.shape[2] == 6

print("\nWindow shape verified:")
print("20 samples x 6 sensor channels")


# ============================================================
# LABEL NORMALIZATION
# ============================================================

# Expected labels:
# NORMAL
# FALL

metadata["label"] = metadata["label"].astype(str).str.upper()

print("\nAll labels:")
print(metadata["label"].value_counts())


# ============================================================
# RECORDING-LEVEL TRAIN / VALIDATION SPLIT
# ============================================================

# IMPORTANT:
# We split recordings, NOT windows.
#
# This prevents windows originating from the same recording
# from leaking into both training and validation.

train_metadata = metadata[
    metadata["split"].astype(str).str.lower() == "train"
].copy()

test_metadata = metadata[
    metadata["split"].astype(str).str.lower() == "test"
].copy()

print("\nOfficial split:")
print(f"Train windows : {len(train_metadata)}")
print(f"Test windows  : {len(test_metadata)}")

print(
    f"Train recordings : "
    f"{train_metadata['source_file'].nunique()}"
)

print(
    f"Test recordings  : "
    f"{test_metadata['source_file'].nunique()}"
)


# ============================================================
# GET UNIQUE TRAIN RECORDINGS
# ============================================================

recordings = (
    train_metadata[
        ["source_file", "label"]
    ]
    .drop_duplicates()
    .reset_index(drop=True)
)

print("\nTraining recordings by label:")
print(recordings["label"].value_counts())


# ============================================================
# RECORDING-LEVEL STRATIFIED SPLIT
# ============================================================

train_recordings, val_recordings = train_test_split(
    recordings,
    test_size=0.20,
    random_state=42,
    stratify=recordings["label"]
)

train_recording_names = set(
    train_recordings["source_file"]
)

val_recording_names = set(
    val_recordings["source_file"]
)


# ============================================================
# WINDOW INDICES
# ============================================================

train_indices = metadata.index[
    metadata["source_file"].isin(train_recording_names)
].to_numpy()

val_indices = metadata.index[
    metadata["source_file"].isin(val_recording_names)
].to_numpy()

test_indices = metadata.index[
    metadata["split"].astype(str).str.lower() == "test"
].to_numpy()


# ============================================================
# SANITY CHECK FOR LEAKAGE
# ============================================================

train_sources = set(
    metadata.loc[train_indices, "source_file"]
)

val_sources = set(
    metadata.loc[val_indices, "source_file"]
)

test_sources = set(
    metadata.loc[test_indices, "source_file"]
)

assert train_sources.isdisjoint(val_sources)
assert train_sources.isdisjoint(test_sources)
assert val_sources.isdisjoint(test_sources)

print("\nNo recording leakage detected.")


# ============================================================
# SPLIT ARRAYS
# ============================================================

X_train = X_all[train_indices]
y_train = y_all[train_indices]

X_val = X_all[val_indices]
y_val = y_all[val_indices]

X_test = X_all[test_indices]
y_test = y_all[test_indices]

print("\nWindow split:")
print(f"Train : {X_train.shape}")
print(f"Val   : {X_val.shape}")
print(f"Test  : {X_test.shape}")


# ============================================================
# LABEL CONVERSION
# ============================================================

def normalize_label(value):

    value = str(value).upper()

    if value in ["FALL", "1"]:
        return 1

    return 0


y_train = np.array([
    normalize_label(x)
    for x in y_train
])

y_val = np.array([
    normalize_label(x)
    for x in y_val
])

y_test = np.array([
    normalize_label(x)
    for x in y_test
])


print("\nClass distribution:")

print(
    f"Train NORMAL={np.sum(y_train == 0)}, "
    f"FALL={np.sum(y_train == 1)}"
)

print(
    f"Val   NORMAL={np.sum(y_val == 0)}, "
    f"FALL={np.sum(y_val == 1)}"
)

print(
    f"Test  NORMAL={np.sum(y_test == 0)}, "
    f"FALL={np.sum(y_test == 1)}"
)


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def extract_features(X, fs=FS):

    feature_rows = []

    dt = 1.0 / fs

    for window in X:

        # ----------------------------------------------------
        # Channels
        # ----------------------------------------------------

        ax = window[:, 0]
        ay = window[:, 1]
        az = window[:, 2]

        gx = window[:, 3]
        gy = window[:, 4]
        gz = window[:, 5]

        # ----------------------------------------------------
        # Magnitudes
        # ----------------------------------------------------

        acc_mag = np.sqrt(
            ax**2 +
            ay**2 +
            az**2
        )

        gyro_mag = np.sqrt(
            gx**2 +
            gy**2 +
            gz**2
        )

        # ----------------------------------------------------
        # Feature dictionary
        # ----------------------------------------------------

        f = {}

        # ----------------------------------------------------
        # Axis statistics
        # ----------------------------------------------------

        axes = {
            "ax": ax,
            "ay": ay,
            "az": az,
            "gx": gx,
            "gy": gy,
            "gz": gz
        }

        for name, signal in axes.items():

            f[name + "_mean"] = np.mean(signal)
            f[name + "_std"] = np.std(signal)
            f[name + "_min"] = np.min(signal)
            f[name + "_max"] = np.max(signal)
            f[name + "_ptp"] = np.ptp(signal)
            f[name + "_rms"] = np.sqrt(
                np.mean(signal ** 2)
            )
            f[name + "_p25"] = np.percentile(
                signal, 25
            )
            f[name + "_median"] = np.median(signal)
            f[name + "_p75"] = np.percentile(
                signal, 75
            )

        # ----------------------------------------------------
        # Acceleration magnitude
        # ----------------------------------------------------

        f["acc_mag_mean"] = np.mean(acc_mag)
        f["acc_mag_std"] = np.std(acc_mag)
        f["acc_mag_min"] = np.min(acc_mag)
        f["acc_mag_max"] = np.max(acc_mag)
        f["acc_mag_ptp"] = np.ptp(acc_mag)
        f["acc_mag_rms"] = np.sqrt(
            np.mean(acc_mag ** 2)
        )

        for p in [10, 25, 50, 75, 90, 95]:

            f[f"acc_mag_p{p}"] = np.percentile(
                acc_mag,
                p
            )

        # ----------------------------------------------------
        # Gyroscope magnitude
        # ----------------------------------------------------

        f["gyro_mag_mean"] = np.mean(gyro_mag)
        f["gyro_mag_std"] = np.std(gyro_mag)
        f["gyro_mag_min"] = np.min(gyro_mag)
        f["gyro_mag_max"] = np.max(gyro_mag)
        f["gyro_mag_ptp"] = np.ptp(gyro_mag)
        f["gyro_mag_rms"] = np.sqrt(
            np.mean(gyro_mag ** 2)
        )

        for p in [10, 25, 50, 75, 90, 95]:

            f[f"gyro_mag_p{p}"] = np.percentile(
                gyro_mag,
                p
            )

        # ----------------------------------------------------
        # Acceleration threshold fractions
        # ----------------------------------------------------

        f["acc_below_0.5g"] = np.mean(
            acc_mag < 0.5
        )

        f["acc_below_0.7g"] = np.mean(
            acc_mag < 0.7
        )

        f["acc_below_0.8g"] = np.mean(
            acc_mag < 0.8
        )

        f["acc_above_1.5g"] = np.mean(
            acc_mag > 1.5
        )

        f["acc_above_2g"] = np.mean(
            acc_mag > 2.0
        )

        f["acc_above_3g"] = np.mean(
            acc_mag > 3.0
        )

        f["acc_above_4g"] = np.mean(
            acc_mag > 4.0
        )

        f["acc_above_5g"] = np.mean(
            acc_mag > 5.0
        )

        # ----------------------------------------------------
        # Gyroscope threshold fractions
        # ----------------------------------------------------

        f["gyro_above_30"] = np.mean(
            gyro_mag > 30
        )

        f["gyro_above_60"] = np.mean(
            gyro_mag > 60
        )

        f["gyro_above_100"] = np.mean(
            gyro_mag > 100
        )

        f["gyro_above_150"] = np.mean(
            gyro_mag > 150
        )

        f["gyro_above_200"] = np.mean(
            gyro_mag > 200
        )

        # ----------------------------------------------------
        # Sampling-rate-aware jerk
        # ----------------------------------------------------

        if len(acc_mag) > 1:

            jerk = np.diff(acc_mag) / dt

            f["jerk_mean_abs"] = np.mean(
                np.abs(jerk)
            )

            f["jerk_std"] = np.std(jerk)

            f["jerk_max_abs"] = np.max(
                np.abs(jerk)
            )

            f["jerk_p95_abs"] = np.percentile(
                np.abs(jerk),
                95
            )

        else:

            f["jerk_mean_abs"] = 0
            f["jerk_std"] = 0
            f["jerk_max_abs"] = 0
            f["jerk_p95_abs"] = 0

        # ----------------------------------------------------
        # Peak positions
        # ----------------------------------------------------

        acc_peak_idx = np.argmax(acc_mag)
        gyro_peak_idx = np.argmax(gyro_mag)

        n = len(window)

        f["acc_peak_index"] = (
            acc_peak_idx / n
        )

        f["gyro_peak_index"] = (
            gyro_peak_idx / n
        )

        f["peak_index_distance"] = (
            abs(acc_peak_idx - gyro_peak_idx) / n
        )

        # ----------------------------------------------------
        # Pre/post acceleration around acceleration peak
        #
        # 0.5 seconds converted using actual sampling rate.
        # ----------------------------------------------------

        half_second_samples = max(
            1,
            int(round(0.5 * fs))
        )

        start_before = max(
            0,
            acc_peak_idx - half_second_samples
        )

        end_after = min(
            n,
            acc_peak_idx + half_second_samples + 1
        )

        before = acc_mag[
            start_before:acc_peak_idx
        ]

        after = acc_mag[
            acc_peak_idx + 1:end_after
        ]

        if len(before) > 0:

            f["acc_before_mean"] = np.mean(before)
            f["acc_before_min"] = np.min(before)
            f["acc_before_std"] = np.std(before)

        else:

            f["acc_before_mean"] = np.mean(acc_mag)
            f["acc_before_min"] = np.min(acc_mag)
            f["acc_before_std"] = np.std(acc_mag)

        if len(after) > 0:

            f["acc_after_mean"] = np.mean(after)
            f["acc_after_min"] = np.min(after)
            f["acc_after_std"] = np.std(after)

        else:

            f["acc_after_mean"] = np.mean(acc_mag)
            f["acc_after_min"] = np.min(acc_mag)
            f["acc_after_std"] = np.std(acc_mag)

        feature_rows.append(f)

    df = pd.DataFrame(feature_rows)

    return df


# ============================================================
# EXTRACT FEATURES
# ============================================================

print("\n" + "=" * 70)
print("EXTRACTING FEATURES")
print("=" * 70)

print("\nTraining features...")
F_train = extract_features(X_train)

print("Validation features...")
F_val = extract_features(X_val)

print("Test features...")
F_test = extract_features(X_test)

print("\nFeature shapes:")
print("Train:", F_train.shape)
print("Val  :", F_val.shape)
print("Test :", F_test.shape)


# ============================================================
# VERIFY FEATURE COUNT
# ============================================================

assert F_train.shape[1] == F_val.shape[1]
assert F_train.shape[1] == F_test.shape[1]

print(
    f"\nTotal features: {F_train.shape[1]}"
)


# ============================================================
# SAVE FEATURE MATRICES
# ============================================================

F_train.to_csv(
    os.path.join(
        RESULT_DIR,
        "mpu_train_features.csv"
    ),
    index=False
)

F_val.to_csv(
    os.path.join(
        RESULT_DIR,
        "mpu_val_features.csv"
    ),
    index=False
)

F_test.to_csv(
    os.path.join(
        RESULT_DIR,
        "mpu_test_features.csv"
    ),
    index=False
)


# ============================================================
# RANDOM FOREST CANDIDATES
# ============================================================

models = {

    "RF_100": RandomForestClassifier(
        n_estimators=100,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    ),

    "RF_200": RandomForestClassifier(
        n_estimators=200,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    ),

    "RF_300": RandomForestClassifier(
        n_estimators=300,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
}


# ============================================================
# VALIDATION
# ============================================================

print("\n" + "=" * 70)
print("MODEL VALIDATION")
print("=" * 70)

validation_results = []

best_model_name = None
best_model = None
best_f1 = -1

for name, model in models.items():

    print(f"\nTraining {name}...")

    model.fit(
        F_train,
        y_train
    )

    pred = model.predict(F_val)

    precision = precision_score(
        y_val,
        pred,
        zero_division=0
    )

    recall = recall_score(
        y_val,
        pred,
        zero_division=0
    )

    f1 = f1_score(
        y_val,
        pred,
        zero_division=0
    )

    accuracy = accuracy_score(
        y_val,
        pred
    )

    try:

        probabilities = model.predict_proba(
            F_val
        )[:, 1]

        roc_auc = roc_auc_score(
            y_val,
            probabilities
        )

    except Exception:

        roc_auc = np.nan

    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1 Score : {f1:.4f}")
    print(f"ROC-AUC  : {roc_auc:.4f}")

    validation_results.append({
        "model": name,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc
    })

    if f1 > best_f1:

        best_f1 = f1
        best_model_name = name
        best_model = model


validation_df = pd.DataFrame(
    validation_results
)

validation_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "validation_results.csv"
    ),
    index=False
)

print("\nBest validation model:")
print(best_model_name)


# ============================================================
# RETRAIN BEST MODEL ON TRAIN + VALIDATION
# ============================================================

print("\n" + "=" * 70)
print("FINAL TRAINING")
print("=" * 70)

F_train_val = pd.concat(
    [
        F_train,
        F_val
    ],
    ignore_index=True
)

y_train_val = np.concatenate(
    [
        y_train,
        y_val
    ]
)

print(
    f"Final training samples: "
    f"{len(F_train_val)}"
)

print(
    f"Using model: {best_model_name}"
)


# Create fresh model using best configuration
best_params = models[
    best_model_name
].get_params()

final_model = RandomForestClassifier(
    **best_params
)

final_model.fit(
    F_train_val,
    y_train_val
)


# ============================================================
# FINAL TEST
# ============================================================

print("\n" + "=" * 70)
print("FINAL MPU TEST")
print("=" * 70)

test_pred = final_model.predict(
    F_test
)

test_prob = final_model.predict_proba(
    F_test
)[:, 1]


accuracy = accuracy_score(
    y_test,
    test_pred
)

precision = precision_score(
    y_test,
    test_pred,
    zero_division=0
)

recall = recall_score(
    y_test,
    test_pred,
    zero_division=0
)

f1 = f1_score(
    y_test,
    test_pred,
    zero_division=0
)

roc_auc = roc_auc_score(
    y_test,
    test_prob
)


print("\nFINAL RESULTS")
print("-" * 40)

print(f"Accuracy : {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall   : {recall:.4f}")
print(f"F1 Score : {f1:.4f}")
print(f"ROC-AUC  : {roc_auc:.4f}")


# ============================================================
# CONFUSION MATRIX
# ============================================================

cm = confusion_matrix(
    y_test,
    test_pred
)

print("\nConfusion Matrix:")
print(cm)


# ============================================================
# CLASSIFICATION REPORT
# ============================================================

report = classification_report(
    y_test,
    test_pred,
    target_names=[
        "NORMAL",
        "FALL"
    ],
    zero_division=0
)

print("\nClassification Report:")
print(report)


# ============================================================
# SAVE TEST PREDICTIONS
# ============================================================

test_output = metadata.loc[
    test_indices
].copy()

test_output["actual"] = y_test

test_output["predicted"] = test_pred

test_output["fall_probability"] = test_prob

test_output.to_csv(
    os.path.join(
        RESULT_DIR,
        "mpu_test_predictions.csv"
    ),
    index=False
)


# ============================================================
# FEATURE IMPORTANCE
# ============================================================

importance_df = pd.DataFrame({

    "feature": F_train.columns,

    "importance": final_model.feature_importances_

}).sort_values(
    "importance",
    ascending=False
)

importance_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "feature_importance.csv"
    ),
    index=False
)

print("\nTop 20 features:")

print(
    importance_df.head(20).to_string(
        index=False
    )
)


# ============================================================
# SAVE MODEL
# ============================================================

model_path = os.path.join(
    MODEL_DIR,
    "guardian360_mpu_random_forest.joblib"
)

joblib.dump(
    {
        "model": final_model,
        "feature_names": list(F_train.columns),
        "sampling_rate": FS,
        "window_samples": 20,
        "window_duration_seconds": 20 / FS,
        "channels": [
            "ax_g",
            "ay_g",
            "az_g",
            "gx_dps",
            "gy_dps",
            "gz_dps"
        ]
    },
    model_path
)


# ============================================================
# SAVE SUMMARY
# ============================================================

summary = pd.DataFrame([{

    "dataset": "MPU public dataset",

    "sampling_rate_hz": FS,

    "window_samples": 20,

    "window_duration_seconds": 20 / FS,

    "features": F_train.shape[1],

    "best_model": best_model_name,

    "accuracy": accuracy,

    "precision": precision,

    "recall": recall,

    "f1": f1,

    "roc_auc": roc_auc,

    "test_windows": len(y_test),

    "test_recordings": len(test_sources)

}])

summary.to_csv(
    os.path.join(
        RESULT_DIR,
        "mpu_random_forest_summary.csv"
    ),
    index=False
)


# ============================================================
# DONE
# ============================================================

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)

print("\nModel saved to:")
print(model_path)

print("\nResults saved to:")
print(RESULT_DIR)

print("\nIMPORTANT:")
print("The MPU test set was not used during model selection.")
print("Train/validation splitting was performed at recording level.")