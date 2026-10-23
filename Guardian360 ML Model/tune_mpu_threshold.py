# ============================================================
# Guardian 360
# MPU Validation Threshold Tuning
#
# Purpose:
#   Find a better FALL decision threshold using ONLY the MPU
#   validation set.
#
# IMPORTANT:
#   - Official MPU test set is NOT used for tuning.
#   - Official MPU test recordings remain untouched.
#   - Same 104-feature representation as combined RF.
#   - Same 80/20 recording-level train/validation split.
# ============================================================

import os
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = r"D:\Guardian360"

MPU_DIR = os.path.join(
    BASE_DIR,
    "results",
    "mpu_dataset",
    "windows"
)

RESULT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "mpu_threshold_tuning"
)

os.makedirs(RESULT_DIR, exist_ok=True)


# ============================================================
# SAMPLING RATE
# ============================================================

MPU_FS = 9.90


# ============================================================
# FEATURE EXTRACTION
# Same 104 features used by combined model
# ============================================================

def extract_features(X, fs):

    feature_rows = []

    dt = 1.0 / fs

    for window in X:

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
        # Acceleration thresholds
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
        # Gyroscope thresholds
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
        # Pre/post acceleration around peak
        # 0.5 seconds using actual sampling rate
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

    return pd.DataFrame(feature_rows)


# ============================================================
# LABEL CONVERSION
# ============================================================

def normalize_label(value):

    value = str(value).upper()

    if value in ["FALL", "1"]:
        return 1

    return 0


# ============================================================
# LOAD MPU DATA
# ============================================================

print("\n" + "=" * 75)
print("GUARDIAN 360 - MPU THRESHOLD TUNING")
print("=" * 75)

print("\nLoading MPU dataset...")

mpu_all = np.load(
    os.path.join(
        MPU_DIR,
        "mpu_windows.npz"
    )
)

mpu_X = mpu_all["X"]
mpu_y = mpu_all["y"]

mpu_metadata = pd.read_csv(
    os.path.join(
        MPU_DIR,
        "mpu_windows_metadata.csv"
    )
)

mpu_metadata["label"] = (
    mpu_metadata["label"]
    .astype(str)
    .str.upper()
)


# ============================================================
# EXISTING OFFICIAL TRAIN / TEST SPLIT
# ============================================================

train_meta = mpu_metadata[
    mpu_metadata["split"]
    .astype(str)
    .str.lower() == "train"
].copy()

test_meta = mpu_metadata[
    mpu_metadata["split"]
    .astype(str)
    .str.lower() == "test"
].copy()


# ============================================================
# REPRODUCE EXACT SAME RECORDING-LEVEL VALIDATION SPLIT
# ============================================================

recordings = (
    train_meta[
        ["source_file", "label"]
    ]
    .drop_duplicates()
    .reset_index(drop=True)
)

mpu_train_recordings, mpu_val_recordings = train_test_split(
    recordings,
    test_size=0.20,
    random_state=42,
    stratify=recordings["label"]
)

mpu_train_sources = set(
    mpu_train_recordings["source_file"]
)

mpu_val_sources = set(
    mpu_val_recordings["source_file"]
)

mpu_train_indices = mpu_metadata.index[
    mpu_metadata["source_file"].isin(
        mpu_train_sources
    )
].to_numpy()

mpu_val_indices = mpu_metadata.index[
    mpu_metadata["source_file"].isin(
        mpu_val_sources
    )
].to_numpy()


# ============================================================
# EXTRACT TRAIN / VALIDATION WINDOWS
# ============================================================

mpu_train = mpu_X[mpu_train_indices]
mpu_val = mpu_X[mpu_val_indices]

mpu_y_train = np.array([
    normalize_label(x)
    for x in mpu_y[mpu_train_indices]
])

mpu_y_val = np.array([
    normalize_label(x)
    for x in mpu_y[mpu_val_indices]
])


print("\nMPU split used for tuning:")

print(
    "Training recordings:",
    len(mpu_train_sources)
)

print(
    "Validation recordings:",
    len(mpu_val_sources)
)

print(
    "Official test recordings:",
    len(
        set(
            test_meta["source_file"]
        )
    )
)

print(
    "\nTraining windows:",
    len(mpu_train)
)

print(
    "Validation windows:",
    len(mpu_val)
)


# ============================================================
# FEATURE EXTRACTION
# ============================================================

print("\n" + "=" * 75)
print("EXTRACTING 104 FEATURES")
print("=" * 75)

print("\nExtracting training features...")

F_train = extract_features(
    mpu_train,
    MPU_FS
)

print("Extracting validation features...")

F_val = extract_features(
    mpu_val,
    MPU_FS
)

print(
    "\nTraining feature shape:",
    F_train.shape
)

print(
    "Validation feature shape:",
    F_val.shape
)

assert F_train.shape[1] == 104
assert F_val.shape[1] == 104


# ============================================================
# TRAIN MODEL
#
# IMPORTANT:
# We train ONLY on MPU training recordings.
# Validation is never used to fit the model.
# ============================================================

print("\n" + "=" * 75)
print("TRAINING RF_300")
print("=" * 75)

model = RandomForestClassifier(
    n_estimators=300,
    min_samples_leaf=2,
    max_features="sqrt",
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)

model.fit(
    F_train,
    mpu_y_train
)


# ============================================================
# VALIDATION PROBABILITIES
# ============================================================

val_probability = model.predict_proba(
    F_val
)[:, 1]

roc_auc = roc_auc_score(
    mpu_y_val,
    val_probability
)

print(
    f"\nValidation ROC-AUC: {roc_auc:.4f}"
)


# ============================================================
# THRESHOLD SEARCH
# ============================================================

print("\n" + "=" * 75)
print("THRESHOLD SEARCH")
print("=" * 75)

thresholds = np.arange(
    0.10,
    0.91,
    0.01
)

threshold_results = []

for threshold in thresholds:

    pred = (
        val_probability >= threshold
    ).astype(int)

    accuracy = accuracy_score(
        mpu_y_val,
        pred
    )

    precision = precision_score(
        mpu_y_val,
        pred,
        zero_division=0
    )

    recall = recall_score(
        mpu_y_val,
        pred,
        zero_division=0
    )

    f1 = f1_score(
        mpu_y_val,
        pred,
        zero_division=0
    )

    cm = confusion_matrix(
        mpu_y_val,
        pred
    )

    threshold_results.append({

        "threshold": threshold,

        "accuracy": accuracy,

        "precision": precision,

        "recall": recall,

        "f1": f1,

        "tn": cm[0, 0],

        "fp": cm[0, 1],

        "fn": cm[1, 0],

        "tp": cm[1, 1]

    })


threshold_df = pd.DataFrame(
    threshold_results
)


# ============================================================
# SAVE ALL THRESHOLD RESULTS
# ============================================================

threshold_path = os.path.join(
    RESULT_DIR,
    "mpu_threshold_results.csv"
)

threshold_df.to_csv(
    threshold_path,
    index=False
)


# ============================================================
# BEST THRESHOLDS
# ============================================================

best_f1_row = threshold_df.loc[
    threshold_df["f1"].idxmax()
]

best_recall_row = threshold_df.loc[
    threshold_df["recall"].idxmax()
]

best_balanced_row = threshold_df.loc[
    (
        threshold_df["precision"] +
        threshold_df["recall"]
    ).idxmax()
]


print("\n" + "=" * 75)
print("BEST THRESHOLD BY F1")
print("=" * 75)

print(
    f"Threshold : {best_f1_row['threshold']:.2f}"
)

print(
    f"Accuracy  : {best_f1_row['accuracy']:.4f}"
)

print(
    f"Precision : {best_f1_row['precision']:.4f}"
)

print(
    f"Recall    : {best_f1_row['recall']:.4f}"
)

print(
    f"F1        : {best_f1_row['f1']:.4f}"
)

print(
    f"TN / FP   : {int(best_f1_row['tn'])} / "
    f"{int(best_f1_row['fp'])}"
)

print(
    f"FN / TP   : {int(best_f1_row['fn'])} / "
    f"{int(best_f1_row['tp'])}"
)


print("\n" + "=" * 75)
print("BEST THRESHOLD BY RECALL")
print("=" * 75)

print(
    f"Threshold : {best_recall_row['threshold']:.2f}"
)

print(
    f"Precision : {best_recall_row['precision']:.4f}"
)

print(
    f"Recall    : {best_recall_row['recall']:.4f}"
)

print(
    f"F1        : {best_recall_row['f1']:.4f}"
)


print("\n" + "=" * 75)
print("BEST BALANCED PRECISION + RECALL")
print("=" * 75)

print(
    f"Threshold : {best_balanced_row['threshold']:.2f}"
)

print(
    f"Precision : {best_balanced_row['precision']:.4f}"
)

print(
    f"Recall    : {best_balanced_row['recall']:.4f}"
)

print(
    f"F1        : {best_balanced_row['f1']:.4f}"
)


# ============================================================
# SHOW THRESHOLDS FROM 0.20 TO 0.70
# ============================================================

print("\n" + "=" * 75)
print("THRESHOLD COMPARISON")
print("=" * 75)

display_df = threshold_df[
    threshold_df["threshold"].between(
        0.20,
        0.70
    )
].copy()

display_df["threshold"] = display_df[
    "threshold"
].round(2)

display_df["accuracy"] = display_df[
    "accuracy"
].round(4)

display_df["precision"] = display_df[
    "precision"
].round(4)

display_df["recall"] = display_df[
    "recall"
].round(4)

display_df["f1"] = display_df[
    "f1"
].round(4)

print(
    display_df[
        [
            "threshold",
            "accuracy",
            "precision",
            "recall",
            "f1",
            "fp",
            "fn",
            "tp"
        ]
    ].to_string(index=False)
)


# ============================================================
# VALIDATION PREDICTIONS AT BEST F1 THRESHOLD
# ============================================================

best_threshold = float(
    best_f1_row["threshold"]
)

best_pred = (
    val_probability >= best_threshold
).astype(int)


# ============================================================
# VALIDATION METRICS
# ============================================================

print("\n" + "=" * 75)
print("VALIDATION RESULT AT BEST F1 THRESHOLD")
print("=" * 75)

print(
    f"\nThreshold: {best_threshold:.2f}"
)

print(
    f"Accuracy : "
    f"{accuracy_score(mpu_y_val, best_pred):.4f}"
)

print(
    f"Precision: "
    f"{precision_score(mpu_y_val, best_pred, zero_division=0):.4f}"
)

print(
    f"Recall   : "
    f"{recall_score(mpu_y_val, best_pred, zero_division=0):.4f}"
)

print(
    f"F1 Score : "
    f"{f1_score(mpu_y_val, best_pred, zero_division=0):.4f}"
)

print("\nConfusion Matrix:")

print(
    confusion_matrix(
        mpu_y_val,
        best_pred
    )
)

print("\nClassification Report:")

print(
    classification_report(
        mpu_y_val,
        best_pred,
        target_names=[
            "NORMAL",
            "FALL"
        ],
        zero_division=0
    )
)


# ============================================================
# VALIDATION ERROR ANALYSIS
# ============================================================

print("\n" + "=" * 75)
print("VALIDATION ERROR ANALYSIS")
print("=" * 75)

val_metadata = mpu_metadata.loc[
    mpu_val_indices
].copy()

val_metadata = val_metadata.reset_index(
    drop=True
)

val_metadata["actual"] = mpu_y_val

val_metadata["fall_probability"] = val_probability

val_metadata["predicted"] = best_pred

val_metadata["correct"] = (
    val_metadata["actual"] ==
    val_metadata["predicted"]
)


# ------------------------------------------------------------
# Missed FALL windows
# ------------------------------------------------------------

missed_falls = val_metadata[
    (val_metadata["actual"] == 1) &
    (val_metadata["predicted"] == 0)
].copy()

false_alarms = val_metadata[
    (val_metadata["actual"] == 0) &
    (val_metadata["predicted"] == 1)
].copy()


print(
    "\nMissed FALL windows:",
    len(missed_falls)
)

print(
    "False alarms:",
    len(false_alarms)
)


# ============================================================
# FALL ACTIVITY BREAKDOWN
# ============================================================

if len(missed_falls) > 0:

    print("\nMissed FALLs by activity:")

    print(
        missed_falls[
            "activity"
        ].value_counts().to_string()
    )

    missed_falls.to_csv(
        os.path.join(
            RESULT_DIR,
            "missed_falls_validation.csv"
        ),
        index=False
    )

else:

    print(
        "\nNo missed FALL windows at "
        "the selected threshold."
    )


# ============================================================
# FALSE ALARM BREAKDOWN
# ============================================================

if len(false_alarms) > 0:

    print("\nFalse alarms by activity:")

    print(
        false_alarms[
            "activity"
        ].value_counts().to_string()
    )

    false_alarms.to_csv(
        os.path.join(
            RESULT_DIR,
            "false_alarms_validation.csv"
        ),
        index=False
    )

else:

    print(
        "\nNo false alarms at "
        "the selected threshold."
    )


# ============================================================
# SAVE ALL VALIDATION PREDICTIONS
# ============================================================

validation_predictions = val_metadata.copy()

validation_predictions.to_csv(
    os.path.join(
        RESULT_DIR,
        "mpu_validation_predictions.csv"
    ),
    index=False
)


# ============================================================
# SAVE SELECTED THRESHOLD
# ============================================================

threshold_info = pd.DataFrame([
    {
        "selected_threshold": best_threshold,
        "selection_method": "maximum_validation_F1",
        "validation_accuracy": best_f1_row["accuracy"],
        "validation_precision": best_f1_row["precision"],
        "validation_recall": best_f1_row["recall"],
        "validation_f1": best_f1_row["f1"],
        "validation_roc_auc": roc_auc
    }
])

threshold_info.to_csv(
    os.path.join(
        RESULT_DIR,
        "selected_threshold.csv"
    ),
    index=False
)


# ============================================================
# IMPORTANT TEST-SET PROTECTION
# ============================================================

print("\n" + "=" * 75)
print("TEST SET PROTECTION")
print("=" * 75)

print(
    "\nOfficial MPU test recordings were NOT loaded "
    "for prediction or threshold selection."
)

print(
    "The selected threshold was determined "
    "using MPU validation data only."
)


# ============================================================
# DONE
# ============================================================

print("\n" + "=" * 75)
print("DONE")
print("=" * 75)

print(
    "\nResults saved to:"
)

print(RESULT_DIR)

print(
    "\nMain files:"
)

print(
    "  mpu_threshold_results.csv"
)

print(
    "  selected_threshold.csv"
)

print(
    "  mpu_validation_predictions.csv"
)

print(
    "  missed_falls_validation.csv"
)

print(
    "  false_alarms_validation.csv"
)