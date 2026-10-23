# ============================================================
# Guardian 360
# Combined SisFall + MPU Random Forest
#
# Common 104-feature representation
# Sampling-rate-aware feature extraction
# ============================================================

import os
import numpy as np
import pandas as pd
import joblib

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


# ============================================================
# PATHS
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
    "combined_random_forest"
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

os.makedirs(RESULT_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)


# ============================================================
# SAMPLING RATES
# ============================================================

SISFALL_FS = 100.0
MPU_FS = 9.90


# ============================================================
# FEATURE EXTRACTION
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
# LOAD SISFALL
# ============================================================

# ============================================================
# LOAD SISFALL
# ============================================================

print("\nLoading SisFall...")

sis_train = np.load(
    os.path.join(
        SISFALL_DIR,
        "X_train.npz"
    )
)["X"]

sis_val = np.load(
    os.path.join(
        SISFALL_DIR,
        "X_val.npz"
    )
)["X"]

sis_test = np.load(
    os.path.join(
        SISFALL_DIR,
        "X_test.npz"
    )
)["X"]

sis_y_train = np.load(
    os.path.join(
        SISFALL_DIR,
        "y_train.npz"
    )
)["y"]

sis_y_val = np.load(
    os.path.join(
        SISFALL_DIR,
        "y_val.npz"
    )
)["y"]

sis_y_test = np.load(
    os.path.join(
        SISFALL_DIR,
        "y_test.npz"
    )
)["y"]

print("SisFall:")
print("Train:", sis_train.shape)
print("Val  :", sis_val.shape)
print("Test :", sis_test.shape)

# ============================================================
# LOAD MPU
# ============================================================

print("\nLoading MPU...")

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

# ------------------------------------------------------------
# Use the existing official train/test recording split.
#
# The existing MPU baseline additionally split its 181
# training recordings into train/validation.
#
# We reproduce the same recording-level split here.
# ------------------------------------------------------------

from sklearn.model_selection import train_test_split

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

mpu_test_indices = mpu_metadata.index[
    mpu_metadata["split"]
    .astype(str)
    .str.lower() == "test"
].to_numpy()

mpu_train = mpu_X[mpu_train_indices]
mpu_val = mpu_X[mpu_val_indices]
mpu_test = mpu_X[mpu_test_indices]

mpu_y_train = mpu_y[mpu_train_indices]
mpu_y_val = mpu_y[mpu_val_indices]
mpu_y_test = mpu_y[mpu_test_indices]

mpu_y_train = np.array([
    normalize_label(x)
    for x in mpu_y_train
])

mpu_y_val = np.array([
    normalize_label(x)
    for x in mpu_y_val
])

mpu_y_test = np.array([
    normalize_label(x)
    for x in mpu_y_test
])

print("\nMPU:")
print("Train:", mpu_train.shape)
print("Val  :", mpu_val.shape)
print("Test :", mpu_test.shape)

print("\nMPU recording counts:")
print(
    "Train:",
    len(mpu_train_sources)
)

print(
    "Val  :",
    len(mpu_val_sources)
)

print(
    "Test :",
    len(
        set(
            mpu_metadata.loc[
                mpu_test_indices,
                "source_file"
            ]
        )
    )
)


# ============================================================
# NORMALIZE SISFALL LABELS
# ============================================================

sis_y_train = np.array([
    normalize_label(x)
    for x in sis_y_train
])

sis_y_val = np.array([
    normalize_label(x)
    for x in sis_y_val
])

sis_y_test = np.array([
    normalize_label(x)
    for x in sis_y_test
])


# ============================================================
# FEATURE EXTRACTION
# ============================================================

print("\n" + "=" * 75)
print("EXTRACTING COMMON 104-FEATURE REPRESENTATION")
print("=" * 75)

print("\nSisFall train...")
F_sis_train = extract_features(
    sis_train,
    SISFALL_FS
)

print("SisFall validation...")
F_sis_val = extract_features(
    sis_val,
    SISFALL_FS
)

print("SisFall test...")
F_sis_test = extract_features(
    sis_test,
    SISFALL_FS
)

print("\nMPU train...")
F_mpu_train = extract_features(
    mpu_train,
    MPU_FS
)

print("MPU validation...")
F_mpu_val = extract_features(
    mpu_val,
    MPU_FS
)

print("MPU test...")
F_mpu_test = extract_features(
    mpu_test,
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
    "MPU train    :",
    F_mpu_train.shape
)

assert F_sis_train.shape[1] == 104
assert F_mpu_train.shape[1] == 104

assert list(
    F_sis_train.columns
) == list(
    F_mpu_train.columns
)

print("\nCommon feature count: 104")
print("Feature names match exactly.")


# ============================================================
# COMBINE TRAIN
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
        mpu_y_train
    ]
)

dataset_train = np.array(
    ["SisFall"] * len(F_sis_train)
    +
    ["MPU"] * len(F_mpu_train)
)


# ============================================================
# COMBINE VALIDATION
# ============================================================

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
        mpu_y_val
    ]
)

dataset_val = np.array(
    ["SisFall"] * len(F_sis_val)
    +
    ["MPU"] * len(F_mpu_val)
)


print("\nCombined training:")
print(
    "Total windows:",
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
    "Total windows:",
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
# DATASET BALANCING
# ============================================================
#
# SisFall has considerably more windows than MPU.
#
# Give each DATASET approximately equal total training
# weight so the classifier does not simply optimize for
# the larger SisFall dataset.
#
# RandomForest class_weight="balanced" additionally handles
# FALL/NORMAL imbalance within the combined data.
# ============================================================

sis_weight = 1.0 / len(F_sis_train)
mpu_weight = 1.0 / len(F_mpu_train)

train_sample_weights = np.where(
    dataset_train == "SisFall",
    sis_weight,
    mpu_weight
)

# Normalize weights so average weight = 1.
train_sample_weights *= (
    len(train_sample_weights)
    /
    np.sum(train_sample_weights)
)

print("\nDataset sample weighting:")
print(
    f"SisFall weight: {sis_weight:.8f}"
)

print(
    f"MPU weight    : {mpu_weight:.8f}"
)

print(
    "Mean final weight:",
    np.mean(train_sample_weights)
)


# ============================================================
# SAVE FEATURES
# ============================================================

F_train_combined.to_csv(
    os.path.join(
        RESULT_DIR,
        "combined_train_features.csv"
    ),
    index=False
)

F_val_combined.to_csv(
    os.path.join(
        RESULT_DIR,
        "combined_val_features.csv"
    ),
    index=False
)


# ============================================================
# MODEL CANDIDATES
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

print("\n" + "=" * 75)
print("COMBINED VALIDATION")
print("=" * 75)

validation_results = []

best_name = None
best_f1 = -1

for name, model in models.items():

    print(f"\nTraining {name}...")

    model.fit(
        F_train_combined,
        y_train_combined,
        sample_weight=train_sample_weights
    )

    pred = model.predict(
        F_val_combined
    )

    prob = model.predict_proba(
        F_val_combined
    )[:, 1]

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

    roc_auc = roc_auc_score(
        y_val_combined,
        prob
    )

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
        best_name = name


validation_df = pd.DataFrame(
    validation_results
)

validation_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "combined_validation_results.csv"
    ),
    index=False
)

print("\nBest model:")
print(best_name)


# ============================================================
# FINAL TRAIN + VALIDATION
# ============================================================

print("\n" + "=" * 75)
print("FINAL COMBINED TRAINING")
print("=" * 75)

F_final_train = pd.concat(
    [
        F_train_combined,
        F_val_combined
    ],
    ignore_index=True
)

y_final_train = np.concatenate(
    [
        y_train_combined,
        y_val_combined
    ]
)

dataset_final = np.concatenate(
    [
        dataset_train,
        dataset_val
    ]
)

# Equalize dataset contribution again.
sis_count = np.sum(
    dataset_final == "SisFall"
)

mpu_count = np.sum(
    dataset_final == "MPU"
)

final_weights = np.where(
    dataset_final == "SisFall",
    1.0 / sis_count,
    1.0 / mpu_count
)

final_weights *= (
    len(final_weights)
    /
    np.sum(final_weights)
)


best_params = models[
    best_name
].get_params()

final_model = RandomForestClassifier(
    **best_params
)

final_model.fit(
    F_final_train,
    y_final_train,
    sample_weight=final_weights
)

print(
    "Final training samples:",
    len(F_final_train)
)


# ============================================================
# EVALUATION FUNCTION
# ============================================================

def evaluate_dataset(
    name,
    features,
    labels,
    metadata=None
):

    print("\n" + "=" * 75)
    print(f"FINAL TEST - {name}")
    print("=" * 75)

    pred = final_model.predict(
        features
    )

    prob = final_model.predict_proba(
        features
    )[:, 1]

    accuracy = accuracy_score(
        labels,
        pred
    )

    precision = precision_score(
        labels,
        pred,
        zero_division=0
    )

    recall = recall_score(
        labels,
        pred,
        zero_division=0
    )

    f1 = f1_score(
        labels,
        pred,
        zero_division=0
    )

    roc_auc = roc_auc_score(
        labels,
        prob
    )

    cm = confusion_matrix(
        labels,
        pred
    )

    print("\nRESULTS")
    print("-" * 40)

    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1 Score : {f1:.4f}")
    print(f"ROC-AUC  : {roc_auc:.4f}")

    print("\nConfusion Matrix:")
    print(cm)

    print("\nClassification Report:")

    report = classification_report(
        labels,
        pred,
        target_names=[
            "NORMAL",
            "FALL"
        ],
        zero_division=0
    )

    print(report)

    # --------------------------------------------------------
    # Save predictions
    # --------------------------------------------------------

    if metadata is not None:

        output = metadata.copy()

    else:

        output = pd.DataFrame()

    output["actual"] = labels
    output["predicted"] = pred
    output["fall_probability"] = prob

    output.to_csv(
        os.path.join(
            RESULT_DIR,
            name.lower().replace(" ", "_")
            + "_predictions.csv"
        ),
        index=False
    )

    return {

        "dataset": name,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
        "tn": cm[0, 0],
        "fp": cm[0, 1],
        "fn": cm[1, 0],
        "tp": cm[1, 1]

    }


# ============================================================
# TEST SISFALL
# ============================================================

sis_result = evaluate_dataset(
    "SisFall Test",
    F_sis_test,
    sis_y_test
)


# ============================================================
# TEST MPU
# ============================================================

mpu_test_metadata = mpu_metadata.loc[
    mpu_test_indices
].copy()

mpu_result = evaluate_dataset(
    "MPU Test",
    F_mpu_test,
    mpu_y_test,
    mpu_test_metadata
)


# ============================================================
# COMPARISON TABLE
# ============================================================

comparison = pd.DataFrame(
    [
        sis_result,
        mpu_result
    ]
)

comparison.to_csv(
    os.path.join(
        RESULT_DIR,
        "combined_test_results.csv"
    ),
    index=False
)


print("\n" + "=" * 75)
print("FINAL COMPARISON")
print("=" * 75)

print(
    comparison[
        [
            "dataset",
            "accuracy",
            "precision",
            "recall",
            "f1",
            "roc_auc"
        ]
    ].to_string(
        index=False
    )
)


# ============================================================
# FEATURE IMPORTANCE
# ============================================================

importance = pd.DataFrame({

    "feature": F_final_train.columns,

    "importance":
        final_model.feature_importances_

}).sort_values(
    "importance",
    ascending=False
)

importance.to_csv(
    os.path.join(
        RESULT_DIR,
        "combined_feature_importance.csv"
    ),
    index=False
)

print("\nTop 20 features:")

print(
    importance.head(20).to_string(
        index=False
    )
)


# ============================================================
# SAVE MODEL
# ============================================================

model_path = os.path.join(
    MODEL_DIR,
    "guardian360_combined_random_forest.joblib"
)

joblib.dump(
    {
        "model": final_model,

        "feature_names":
            list(F_final_train.columns),

        "sisfall_sampling_rate":
            SISFALL_FS,

        "mpu_sampling_rate":
            MPU_FS,

        "features":
            104,

        "window_representation":
            "sampling-rate-aware common features",

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
# DONE
# ============================================================

print("\n" + "=" * 75)
print("DONE")
print("=" * 75)

print("\nModel:")
print(model_path)

print("\nResults:")
print(RESULT_DIR)

print("\nThe official SisFall and MPU test sets were")
print("NOT used during model selection or training.")