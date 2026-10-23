# ============================================================
# GUARDIAN 360
# Combined SisFall + MPU
# FALL Decision Threshold Tuning
#
# IMPORTANT:
# - Uses TRAIN data only for model fitting
# - Uses COMBINED VALIDATION data for threshold selection
# - NEVER touches official test sets
# - Uses the same RF-300 configuration as the final model
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
    confusion_matrix
)


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = r"D:\Guardian360"

SISFALL_DIR = os.path.join(
    BASE_DIR,
    "results",
    "windows_v2"
)

MPU_DIR = os.path.join(
    BASE_DIR,
    "results",
    "mpu_dataset",
    "windows"
)

RESULT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "combined_threshold_tuning"
)

os.makedirs(RESULT_DIR, exist_ok=True)

SISFALL_FS = 100.0
MPU_FS = 9.90


# ============================================================
# FEATURE EXTRACTION
# EXACT SAME 104-FEATURE REPRESENTATION
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

        # ----------------------------------------------------
        # Jerk
        # ----------------------------------------------------

        acc_jerk = np.diff(acc_mag) / dt

        f = {}

        # ====================================================
        # AXIS STATISTICS
        # ====================================================

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

            f[name + "_median"] = np.median(
                signal
            )

            f[name + "_p75"] = np.percentile(
                signal, 75
            )

        # ====================================================
        # ACCELERATION MAGNITUDE
        # ====================================================

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

        # ====================================================
        # GYRO MAGNITUDE
        # ====================================================

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

        # ====================================================
        # ACCELERATION THRESHOLDS
        # ====================================================

        for threshold in [
            0.5,
            0.7,
            0.8,
            1.5,
            2.0,
            3.0,
            4.0,
            5.0
        ]:

            if threshold < 1.0:

                name = f"acc_below_{str(threshold).replace('.', '')}g"

                f[name] = np.mean(
                    acc_mag < threshold
                )

            else:

                name = f"acc_above_{str(threshold).replace('.', '')}g"

                f[name] = np.mean(
                    acc_mag > threshold
                )

        # ====================================================
        # GYRO THRESHOLDS
        # ====================================================

        for threshold in [
            30,
            60,
            100,
            150,
            200
        ]:

            f[f"gyro_above_{threshold}"] = np.mean(
                gyro_mag > threshold
            )

        # ====================================================
        # JERK
        # ====================================================

        f["jerk_mean_abs"] = np.mean(
            np.abs(acc_jerk)
        )

        f["jerk_std"] = np.std(
            acc_jerk
        )

        f["jerk_max_abs"] = np.max(
            np.abs(acc_jerk)
        )

        f["jerk_p95_abs"] = np.percentile(
            np.abs(acc_jerk),
            95
        )

        # ====================================================
        # PEAK POSITIONS
        # ====================================================

        acc_peak_index = np.argmax(
            acc_mag
        )

        gyro_peak_index = np.argmax(
            gyro_mag
        )

        n = len(window)

        f["acc_peak_index"] = (
            acc_peak_index / n
        )

        f["gyro_peak_index"] = (
            gyro_peak_index / n
        )

        f["peak_index_distance"] = abs(
            acc_peak_index - gyro_peak_index
        ) / n

        # ====================================================
        # PRE / POST ACCELERATION PEAK
        # ====================================================

        peak = acc_peak_index

        half_second = int(
            0.5 * fs
        )

        before_start = max(
            0,
            peak - half_second
        )

        before = acc_mag[
            before_start:peak
        ]

        after_end = min(
            n,
            peak + half_second
        )

        after = acc_mag[
            peak:after_end
        ]

        if len(before) == 0:
            before = np.array([0.0])

        if len(after) == 0:
            after = np.array([0.0])

        f["acc_before_mean"] = np.mean(
            before
        )

        f["acc_before_min"] = np.min(
            before
        )

        f["acc_before_std"] = np.std(
            before
        )

        f["acc_after_mean"] = np.mean(
            after
        )

        f["acc_after_min"] = np.min(
            after
        )

        f["acc_after_std"] = np.std(
            after
        )

        feature_rows.append(f)

    return pd.DataFrame(feature_rows)


# ============================================================
# LOAD SISFALL
# ============================================================

print("=" * 75)
print("GUARDIAN 360 - COMBINED THRESHOLD TUNING")
print("=" * 75)

print("\nLoading SisFall...")

sis_train = np.load(
    os.path.join(
        SISFALL_DIR,
        "X_train.npz"
    )
)["X"]

sis_y_train = np.load(
    os.path.join(
        SISFALL_DIR,
        "y_train.npz"
    )
)["y"]

sis_val = np.load(
    os.path.join(
        SISFALL_DIR,
        "X_val.npz"
    )
)["X"]

sis_y_val = np.load(
    os.path.join(
        SISFALL_DIR,
        "y_val.npz"
    )
)["y"]


# ============================================================
# LOAD MPU
# ============================================================

print("Loading MPU...")

mpu_train_all = np.load(
    os.path.join(
        MPU_DIR,
        "mpu_windows_train.npz"
    )
)

mpu_test_all = np.load(
    os.path.join(
        MPU_DIR,
        "mpu_windows_test.npz"
    )
)

mpu_train = mpu_train_all["X"]
mpu_y_train = mpu_train_all["y"]

# ------------------------------------------------------------
# IMPORTANT
#
# The existing combined pipeline has already created the
# official recording-level train/validation split.
#
# We use the saved feature files + recreate the split from
# the window metadata to guarantee recording-level separation.
# ------------------------------------------------------------

metadata = pd.read_csv(
    os.path.join(
        MPU_DIR,
        "mpu_windows_metadata.csv"
    )
)

# Keep only official TRAIN recordings.
train_meta = metadata[
    metadata["split"] == "train"
].copy()

train_recordings = sorted(
    train_meta["source_file"].unique()
)

# Same random seed as the existing MPU split
from sklearn.model_selection import train_test_split

recording_labels = (
    train_meta
    .groupby("source_file")["label"]
    .first()
    .reset_index()
)

mpu_train_recordings, mpu_val_recordings = train_test_split(
    recording_labels["source_file"].values,
    test_size=0.20,
    random_state=42,
    stratify=recording_labels["label"].values
)

mpu_train_recordings = set(
    mpu_train_recordings
)

mpu_val_recordings = set(
    mpu_val_recordings
)

mpu_window_source = (
    train_meta["source_file"]
    .values
)

mpu_train_mask = np.array([
    x in mpu_train_recordings
    for x in mpu_window_source
])

mpu_val_mask = np.array([
    x in mpu_val_recordings
    for x in mpu_window_source
])

# ------------------------------------------------------------
# Align metadata ordering with the saved train NPZ.
# ------------------------------------------------------------

assert len(mpu_window_source) == len(
    mpu_train
), (
    "MPU metadata/window count mismatch."
)

mpu_train_X = mpu_train[
    mpu_train_mask
]

mpu_train_y = mpu_y_train[
    mpu_train_mask
]

mpu_val_X = mpu_train[
    mpu_val_mask
]

mpu_val_y = mpu_y_train[
    mpu_val_mask
]


# ============================================================
# FEATURE EXTRACTION
# ============================================================

print("\nExtracting SisFall features...")

F_sis_train = extract_features(
    sis_train,
    SISFALL_FS
)

F_sis_val = extract_features(
    sis_val,
    SISFALL_FS
)

print("Extracting MPU features...")

F_mpu_train = extract_features(
    mpu_train_X,
    MPU_FS
)

F_mpu_val = extract_features(
    mpu_val_X,
    MPU_FS
)


# ============================================================
# FEATURE CHECK
# ============================================================

print("\nFeature shapes:")

print(
    "SisFall train:",
    F_sis_train.shape
)

print(
    "SisFall val  :",
    F_sis_val.shape
)

print(
    "MPU train    :",
    F_mpu_train.shape
)

print(
    "MPU val      :",
    F_mpu_val.shape
)

assert F_sis_train.shape[1] == 104
assert F_mpu_train.shape[1] == 104

assert list(
    F_sis_train.columns
) == list(
    F_mpu_train.columns
)

print(
    "\nCommon feature count: 104"
)

print(
    "Feature names match exactly."
)


# ============================================================
# COMBINE
# ============================================================

F_train_combined = pd.concat(
    [
        F_sis_train,
        F_mpu_train
    ],
    ignore_index=True
)

y_train_combined = np.concatenate(
    [
        sis_y_train,
        mpu_train_y
    ]
)

dataset_train = np.array(
    ["SisFall"] * len(F_sis_train)
    +
    ["MPU"] * len(F_mpu_train)
)


F_val_combined = pd.concat(
    [
        F_sis_val,
        F_mpu_val
    ],
    ignore_index=True
)

y_val_combined = np.concatenate(
    [
        sis_y_val,
        mpu_val_y
    ]
)

dataset_val = np.array(
    ["SisFall"] * len(F_sis_val)
    +
    ["MPU"] * len(F_mpu_val)
)


print("\nCombined training:")
print(
    "Total:",
    len(F_train_combined)
)

print(
    "SisFall:",
    len(F_sis_train)
)

print(
    "MPU:",
    len(F_mpu_train)
)


print("\nCombined validation:")
print(
    "Total:",
    len(F_val_combined)
)

print(
    "SisFall:",
    len(F_sis_val)
)

print(
    "MPU:",
    len(F_mpu_val)
)


# ============================================================
# DATASET WEIGHTS
# SAME AS FINAL PIPELINE
# ============================================================

sis_weight = 1.0 / len(
    F_sis_train
)

mpu_weight = 1.0 / len(
    F_mpu_train
)

train_sample_weights = np.where(
    dataset_train == "SisFall",
    sis_weight,
    mpu_weight
)

train_sample_weights *= (
    len(train_sample_weights)
    /
    np.sum(train_sample_weights)
)


# ============================================================
# RF-300
# SAME CONFIGURATION AS FINAL MODEL
# ============================================================

print("\nTraining RF-300...")

model = RandomForestClassifier(
    n_estimators=300,
    min_samples_leaf=2,
    max_features="sqrt",
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)

model.fit(
    F_train_combined,
    y_train_combined,
    sample_weight=train_sample_weights
)


# ============================================================
# VALIDATION PROBABILITIES
# ============================================================

print("\nGenerating validation probabilities...")

fall_probability = model.predict_proba(
    F_val_combined
)[:, 1]

roc_auc = roc_auc_score(
    y_val_combined,
    fall_probability
)

print(
    f"Validation ROC-AUC: {roc_auc:.4f}"
)


# ============================================================
# THRESHOLD SEARCH
# ============================================================

thresholds = np.round(
    np.arange(
        0.05,
        0.951,
        0.01
    ),
    2
)

results = []

for threshold in thresholds:

    pred = (
        fall_probability >= threshold
    ).astype(int)

    accuracy = accuracy_score(
        y_val_combined,
        pred
    )

    precision = precision_score(
        y_val_combined,
        pred,
        zero_division=0
    )

    recall = recall_score(
        y_val_combined,
        pred,
        zero_division=0
    )

    f1 = f1_score(
        y_val_combined,
        pred,
        zero_division=0
    )

    tn, fp, fn, tp = confusion_matrix(
        y_val_combined,
        pred
    ).ravel()

    results.append({
        "threshold": threshold,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "TN": tn,
        "FP": fp,
        "FN": fn,
        "TP": tp
    })


results_df = pd.DataFrame(
    results
)


# ============================================================
# SAVE
# ============================================================

results_path = os.path.join(
    RESULT_DIR,
    "combined_threshold_results.csv"
)

results_df.to_csv(
    results_path,
    index=False
)


# ============================================================
# BEST THRESHOLDS
# ============================================================

best_f1 = results_df.loc[
    results_df["f1"].idxmax()
]

best_recall = results_df.loc[
    results_df["recall"].idxmax()
]

# Highest precision+recall while prioritizing
# balanced behavior.
results_df["precision_recall_sum"] = (
    results_df["precision"]
    +
    results_df["recall"]
)

best_balanced = results_df.loc[
    results_df["precision_recall_sum"].idxmax()
]


# Safety-oriented thresholds:
# Find the lowest threshold achieving >= 98% recall.
high_recall = results_df[
    results_df["recall"] >= 0.98
]

if len(high_recall) > 0:

    safety_threshold = high_recall.loc[
        high_recall["precision"].idxmax()
    ]

else:

    safety_threshold = None


# ============================================================
# PRINT BEST RESULTS
# ============================================================

print("\n" + "=" * 75)
print("BEST THRESHOLD RESULTS")
print("=" * 75)


print("\nBEST F1")
print("-" * 50)

print(
    f"Threshold : {best_f1['threshold']:.2f}"
)

print(
    f"Accuracy  : {best_f1['accuracy']:.4f}"
)

print(
    f"Precision : {best_f1['precision']:.4f}"
)

print(
    f"Recall    : {best_f1['recall']:.4f}"
)

print(
    f"F1        : {best_f1['f1']:.4f}"
)

print(
    f"FP        : {int(best_f1['FP'])}"
)

print(
    f"FN        : {int(best_f1['FN'])}"
)


print("\nBEST RECALL")
print("-" * 50)

print(
    f"Threshold : {best_recall['threshold']:.2f}"
)

print(
    f"Precision : {best_recall['precision']:.4f}"
)

print(
    f"Recall    : {best_recall['recall']:.4f}"
)

print(
    f"F1        : {best_recall['f1']:.4f}"
)

print(
    f"FP        : {int(best_recall['FP'])}"
)

print(
    f"FN        : {int(best_recall['FN'])}"
)


print("\nBEST PRECISION + RECALL BALANCE")
print("-" * 50)

print(
    f"Threshold : {best_balanced['threshold']:.2f}"
)

print(
    f"Precision : {best_balanced['precision']:.4f}"
)

print(
    f"Recall    : {best_balanced['recall']:.4f}"
)

print(
    f"F1        : {best_balanced['f1']:.4f}"
)

print(
    f"FP        : {int(best_balanced['FP'])}"
)

print(
    f"FN        : {int(best_balanced['FN'])}"
)


if safety_threshold is not None:

    print(
        "\nBEST >=98% RECALL THRESHOLD"
    )

    print("-" * 50)

    print(
        f"Threshold : "
        f"{safety_threshold['threshold']:.2f}"
    )

    print(
        f"Precision : "
        f"{safety_threshold['precision']:.4f}"
    )

    print(
        f"Recall    : "
        f"{safety_threshold['recall']:.4f}"
    )

    print(
        f"F1        : "
        f"{safety_threshold['f1']:.4f}"
    )

    print(
        f"FP        : "
        f"{int(safety_threshold['FP'])}"
    )

    print(
        f"FN        : "
        f"{int(safety_threshold['FN'])}"
    )


# ============================================================
# USEFUL THRESHOLD TABLE
# ============================================================

print("\n" + "=" * 75)
print("THRESHOLD COMPARISON")
print("=" * 75)

selected = results_df[
    results_df["threshold"].isin([
        0.10,
        0.15,
        0.20,
        0.25,
        0.27,
        0.30,
        0.35,
        0.40,
        0.45,
        0.50,
        0.55,
        0.60,
        0.65,
        0.70,
        0.72,
        0.75,
        0.80
    ])
]

print(
    selected[
        [
            "threshold",
            "accuracy",
            "precision",
            "recall",
            "f1",
            "FP",
            "FN"
        ]
    ].to_string(
        index=False
    )
)


# ============================================================
# SAVE VALIDATION PREDICTIONS
# ============================================================

prediction_df = pd.DataFrame({
    "dataset": dataset_val,
    "true_label": y_val_combined,
    "fall_probability": fall_probability
})

prediction_path = os.path.join(
    RESULT_DIR,
    "combined_validation_predictions.csv"
)

prediction_df.to_csv(
    prediction_path,
    index=False
)


# ============================================================
# MISSED FALL ANALYSIS
# ============================================================

# Use the safety-oriented threshold if available;
# otherwise use best F1.

if safety_threshold is not None:

    selected_threshold = (
        safety_threshold["threshold"]
    )

else:

    selected_threshold = (
        best_f1["threshold"]
    )


selected_pred = (
    fall_probability >= selected_threshold
).astype(int)


missed_mask = (
    (y_val_combined == 1)
    &
    (selected_pred == 0)
)

false_alarm_mask = (
    (y_val_combined == 0)
    &
    (selected_pred == 1)
)


print("\n" + "=" * 75)
print("SELECTED SAFETY THRESHOLD ANALYSIS")
print("=" * 75)

print(
    f"\nSelected threshold: "
    f"{selected_threshold:.2f}"
)

print(
    f"Missed FALL windows: "
    f"{np.sum(missed_mask)}"
)

print(
    f"False alarms: "
    f"{np.sum(false_alarm_mask)}"
)


# ============================================================
# SAVE MISSED FALL PROBABILITIES
# ============================================================

missed_df = prediction_df[
    missed_mask
].copy()

missed_df = missed_df.sort_values(
    "fall_probability"
)

missed_path = os.path.join(
    RESULT_DIR,
    "combined_missed_falls.csv"
)

missed_df.to_csv(
    missed_path,
    index=False
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "=" * 75)
print("FILES SAVED")
print("=" * 75)

print(
    results_path
)

print(
    prediction_path
)

print(
    missed_path
)

print("\nDONE")
print("=" * 75)