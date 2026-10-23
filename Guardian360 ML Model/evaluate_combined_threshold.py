import os
import numpy as np
import pandas as pd
import joblib

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)


# ============================================================
# GUARDIAN 360
# FINAL COMBINED TEST EVALUATION
#
# Compare:
#   Default threshold = 0.50
#   Tuned threshold   = 0.47
#
# IMPORTANT:
# Official test sets are ONLY evaluated here.
# They are NOT used for training or threshold selection.
# ============================================================


# ============================================================
# PATHS
# ============================================================

BASE_DIR = r"D:\Guardian360"

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "guardian360_combined_random_forest.joblib"
)

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


# Sampling rates used by the original pipeline
SISFALL_FS = 100.0
MPU_FS = 9.90


# Thresholds being compared
THRESHOLDS = [0.50, 0.47]


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def extract_features(X, fs):
    """
    Extract the 104 features used by Guardian 360.

    Input:
        X  = (number_of_windows, samples, 6)

    Channels:
        0 = ax
        1 = ay
        2 = az
        3 = gx
        4 = gy
        5 = gz
    """

    feature_rows = []

    for window in X:

        # ----------------------------------------------------
        # Raw channels
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
            ax ** 2 +
            ay ** 2 +
            az ** 2
        )

        gyro_mag = np.sqrt(
            gx ** 2 +
            gy ** 2 +
            gz ** 2
        )

        # ----------------------------------------------------
        # Acceleration jerk
        # ----------------------------------------------------

        dt = 1.0 / fs

        if len(acc_mag) > 1:
            acc_jerk = np.diff(acc_mag) / dt
        else:
            acc_jerk = np.array([0.0])

        # ----------------------------------------------------
        # Feature vector
        # ----------------------------------------------------

        features = []

        # ====================================================
        # 1. AXIS STATISTICS
        # 6 axes × 9 = 54 features
        # ====================================================

        axes = [
            ax,
            ay,
            az,
            gx,
            gy,
            gz
        ]

        for signal in axes:

            features.extend([
                np.mean(signal),
                np.std(signal),
                np.min(signal),
                np.max(signal),
                np.ptp(signal),
                np.sqrt(np.mean(signal ** 2)),
                np.percentile(signal, 25),
                np.median(signal),
                np.percentile(signal, 75),
            ])

        # ====================================================
        # 2. ACCELERATION MAGNITUDE
        # 12 features
        # ====================================================

        features.extend([
            np.mean(acc_mag),
            np.std(acc_mag),
            np.min(acc_mag),
            np.max(acc_mag),
            np.ptp(acc_mag),
            np.sqrt(np.mean(acc_mag ** 2)),
            np.percentile(acc_mag, 10),
            np.percentile(acc_mag, 25),
            np.median(acc_mag),
            np.percentile(acc_mag, 75),
            np.percentile(acc_mag, 90),
            np.percentile(acc_mag, 95),
        ])

        # ====================================================
        # 3. GYROSCOPE MAGNITUDE
        # 12 features
        # ====================================================

        features.extend([
            np.mean(gyro_mag),
            np.std(gyro_mag),
            np.min(gyro_mag),
            np.max(gyro_mag),
            np.ptp(gyro_mag),
            np.sqrt(np.mean(gyro_mag ** 2)),
            np.percentile(gyro_mag, 10),
            np.percentile(gyro_mag, 25),
            np.median(gyro_mag),
            np.percentile(gyro_mag, 75),
            np.percentile(gyro_mag, 90),
            np.percentile(gyro_mag, 95),
        ])

        # ====================================================
        # 4. ACCELERATION THRESHOLD FEATURES
        # 8 features
        # ====================================================

        features.extend([
            np.mean(acc_mag < 0.5),
            np.mean(acc_mag < 0.7),
            np.mean(acc_mag < 0.8),

            np.mean(acc_mag > 1.5),
            np.mean(acc_mag > 2.0),
            np.mean(acc_mag > 3.0),
            np.mean(acc_mag > 4.0),
            np.mean(acc_mag > 5.0),
        ])

        # ====================================================
        # 5. GYROSCOPE THRESHOLD FEATURES
        # 5 features
        # ====================================================

        features.extend([
            np.mean(gyro_mag > 30),
            np.mean(gyro_mag > 60),
            np.mean(gyro_mag > 100),
            np.mean(gyro_mag > 150),
            np.mean(gyro_mag > 200),
        ])

        # ====================================================
        # 6. JERK FEATURES
        # 4 features
        # ====================================================

        abs_jerk = np.abs(acc_jerk)

        features.extend([
            np.mean(abs_jerk),
            np.std(acc_jerk),
            np.max(abs_jerk),
            np.percentile(abs_jerk, 95),
        ])

        # ====================================================
        # 7. PEAK POSITION FEATURES
        # 3 features
        # ====================================================

        acc_peak_idx = np.argmax(acc_mag)
        gyro_peak_idx = np.argmax(gyro_mag)

        n = len(window)

        features.extend([
            acc_peak_idx / n,
            gyro_peak_idx / n,
            abs(acc_peak_idx - gyro_peak_idx) / n,
        ])

        # ====================================================
        # 8. PRE/POST IMPACT FEATURES
        # 6 features
        # ====================================================

        half_window = int(0.5 * fs)

        start = max(
            0,
            acc_peak_idx - half_window
        )

        end = min(
            n,
            acc_peak_idx + half_window
        )

        before = acc_mag[
            start:acc_peak_idx
        ]

        after = acc_mag[
            acc_peak_idx:end
        ]

        # Safety for edge cases
        if len(before) == 0:
            before = acc_mag[:1]

        if len(after) == 0:
            after = acc_mag[-1:]

        features.extend([
            np.mean(before),
            np.min(before),
            np.std(before),

            np.mean(after),
            np.min(after),
            np.std(after),
        ])

        # ----------------------------------------------------
        # Store window features
        # ----------------------------------------------------

        feature_rows.append(features)

    return np.asarray(
        feature_rows,
        dtype=np.float32
    )


# ============================================================
# NPZ LOADER
# ============================================================

def load_npz(path, y_path=None):
    """
    Flexible NPZ loader.

    Supports:

    A) X and y stored in the same NPZ
       Example:
           mpu_windows_test.npz

    B) X and y stored separately
       Example:
           X_test.npz
           y_test.npz
    """

    data = np.load(path)

    # --------------------------------------------------------
    # Load X
    # --------------------------------------------------------

    if "X" in data:
        X = data["X"]
    else:
        X = data[data.files[0]]

    # --------------------------------------------------------
    # Load y
    # --------------------------------------------------------

    if y_path is not None:

        y_data = np.load(y_path)

        if "y" in y_data:
            y = y_data["y"]
        else:
            y = y_data[y_data.files[0]]

    elif "y" in data:

        y = data["y"]

    else:

        raise ValueError(
            "\nNo y array found.\n"
            f"File: {path}\n"
            "Provide the separate y NPZ file."
        )

    return X, y


# ============================================================
# EVALUATION FUNCTION
# ============================================================

def evaluate_threshold(
    y_true,
    probabilities,
    threshold
):

    y_pred = (
        probabilities >= threshold
    ).astype(int)

    accuracy = accuracy_score(
        y_true,
        y_pred
    )

    precision = precision_score(
        y_true,
        y_pred,
        zero_division=0
    )

    recall = recall_score(
        y_true,
        y_pred,
        zero_division=0
    )

    f1 = f1_score(
        y_true,
        y_pred,
        zero_division=0
    )

    roc_auc = roc_auc_score(
        y_true,
        probabilities
    )

    cm = confusion_matrix(
        y_true,
        y_pred
    )

    tn, fp, fn, tp = cm.ravel()

    return {
        "threshold": threshold,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
        "TN": int(tn),
        "FP": int(fp),
        "FN": int(fn),
        "TP": int(tp),
    }


# ============================================================
# PRINT RESULTS
# ============================================================

def print_results(
    dataset_name,
    result
):

    print("\n" + "-" * 65)

    print(
        f"{dataset_name} | "
        f"Threshold = {result['threshold']:.2f}"
    )

    print("-" * 65)

    print(
        f"Accuracy  : {result['accuracy']:.4f}"
    )

    print(
        f"Precision : {result['precision']:.4f}"
    )

    print(
        f"Recall    : {result['recall']:.4f}"
    )

    print(
        f"F1        : {result['f1']:.4f}"
    )

    print(
        f"ROC-AUC   : {result['roc_auc']:.4f}"
    )

    print()

    print(
        f"TN = {result['TN']}"
    )

    print(
        f"FP = {result['FP']}"
    )

    print(
        f"FN = {result['FN']}"
    )

    print(
        f"TP = {result['TP']}"
    )


# ============================================================
# MAIN
# ============================================================

print("=" * 75)
print("GUARDIAN 360 - FINAL COMBINED TEST EVALUATION")
print("=" * 75)


# ============================================================
# LOAD MODEL
# ============================================================

model_bundle = joblib.load(
    MODEL_PATH
)

# The trained model was saved inside a dictionary
model = model_bundle["model"]

# Recover the exact feature names saved during training
trained_feature_names = model_bundle["feature_names"]

print("\nModel loaded successfully.")
print("Model type:", type(model).__name__)
print("Saved feature count:", len(trained_feature_names))

# ============================================================
# LOAD SISFALL OFFICIAL TEST
# ============================================================

print("\nLoading SisFall official test set...")

sis_x_path = os.path.join(
    SISFALL_DIR,
    "X_test.npz"
)

sis_y_path = os.path.join(
    SISFALL_DIR,
    "y_test.npz"
)

X_sis_test, y_sis_test = load_npz(
    sis_x_path,
    sis_y_path
)

print(
    "SisFall X:",
    X_sis_test.shape
)

print(
    "SisFall y:",
    y_sis_test.shape
)


# ============================================================
# LOAD MPU OFFICIAL TEST
# ============================================================

print("\nLoading MPU official test set...")

mpu_test_path = os.path.join(
    MPU_DIR,
    "mpu_windows_test.npz"
)

X_mpu_test, y_mpu_test = load_npz(
    mpu_test_path
)

print(
    "MPU X:",
    X_mpu_test.shape
)

print(
    "MPU y:",
    y_mpu_test.shape
)


# ============================================================
# FEATURE EXTRACTION
# ============================================================

print("\n" + "=" * 75)
print("FEATURE EXTRACTION")
print("=" * 75)

print("\nExtracting SisFall test features...")

F_sis_test = extract_features(
    X_sis_test,
    SISFALL_FS
)

print(
    "SisFall feature shape:",
    F_sis_test.shape
)


print("\nExtracting MPU test features...")

F_mpu_test = extract_features(
    X_mpu_test,
    MPU_FS
)

print(
    "MPU feature shape:",
    F_mpu_test.shape
)


# ============================================================
# FEATURE COUNT CHECK
# ============================================================

if F_sis_test.shape[1] != len(trained_feature_names):
    raise ValueError(
        f"SisFall feature mismatch: "
        f"generated {F_sis_test.shape[1]}, "
        f"model expects {len(trained_feature_names)}"
    )

if F_mpu_test.shape[1] != len(trained_feature_names):
    raise ValueError(
        f"MPU feature mismatch: "
        f"generated {F_mpu_test.shape[1]}, "
        f"model expects {len(trained_feature_names)}"
    )

print(
    "\nFeature compatibility check passed:"
    f" {len(trained_feature_names)} features"
)

# ============================================================
# GENERATE PROBABILITIES
# ============================================================

print("\n" + "=" * 75)
print("GENERATING TEST PROBABILITIES")
print("=" * 75)

print("\nSisFall...")

sis_prob = model.predict_proba(
    F_sis_test
)[:, 1]

print(
    "SisFall probabilities generated:",
    len(sis_prob)
)


print("\nMPU...")

mpu_prob = model.predict_proba(
    F_mpu_test
)[:, 1]

print(
    "MPU probabilities generated:",
    len(mpu_prob)
)


# ============================================================
# COMBINED OFFICIAL TEST SET
# ============================================================

y_combined_test = np.concatenate([
    y_sis_test,
    y_mpu_test
])

combined_prob = np.concatenate([
    sis_prob,
    mpu_prob
])


print("\n" + "=" * 75)
print("OFFICIAL TEST SET")
print("=" * 75)

print(
    f"Total test windows : {len(y_combined_test)}"
)

print(
    f"SisFall            : {len(y_sis_test)}"
)

print(
    f"MPU                : {len(y_mpu_test)}"
)

print(
    f"Actual NORMAL      : "
    f"{np.sum(y_combined_test == 0)}"
)

print(
    f"Actual FALL        : "
    f"{np.sum(y_combined_test == 1)}"
)


# ============================================================
# EVALUATE ALL THRESHOLDS
# ============================================================

all_results = []

print("\n" + "=" * 75)
print("COMBINED OFFICIAL TEST RESULTS")
print("=" * 75)

for threshold in THRESHOLDS:

    result = evaluate_threshold(
        y_combined_test,
        combined_prob,
        threshold
    )

    result["dataset"] = "Combined"

    all_results.append(result)

    print_results(
        "COMBINED OFFICIAL TEST",
        result
    )


# ============================================================
# SISFALL TEST
# ============================================================

print("\n" + "=" * 75)
print("SISFALL OFFICIAL TEST RESULTS")
print("=" * 75)

for threshold in THRESHOLDS:

    result = evaluate_threshold(
        y_sis_test,
        sis_prob,
        threshold
    )

    result["dataset"] = "SisFall"

    all_results.append(result)

    print_results(
        "SISFALL OFFICIAL TEST",
        result
    )


# ============================================================
# MPU TEST
# ============================================================

print("\n" + "=" * 75)
print("MPU OFFICIAL TEST RESULTS")
print("=" * 75)

for threshold in THRESHOLDS:

    result = evaluate_threshold(
        y_mpu_test,
        mpu_prob,
        threshold
    )

    result["dataset"] = "MPU"

    all_results.append(result)

    print_results(
        "MPU OFFICIAL TEST",
        result
    )


# ============================================================
# SAVE RESULTS
# ============================================================

results_df = pd.DataFrame(
    all_results
)

# Put dataset first
columns = [
    "dataset",
    "threshold",
    "accuracy",
    "precision",
    "recall",
    "f1",
    "roc_auc",
    "TN",
    "FP",
    "FN",
    "TP",
]

results_df = results_df[
    columns
]

results_path = os.path.join(
    RESULT_DIR,
    "final_test_threshold_comparison.csv"
)

results_df.to_csv(
    results_path,
    index=False
)


# ============================================================
# SAVE RAW TEST PROBABILITIES
# ============================================================

prob_df = pd.DataFrame({
    "dataset": (
        ["SisFall"] * len(y_sis_test)
        +
        ["MPU"] * len(y_mpu_test)
    ),

    "true_label": np.concatenate([
        y_sis_test,
        y_mpu_test
    ]),

    "fall_probability": np.concatenate([
        sis_prob,
        mpu_prob
    ])
})

prob_path = os.path.join(
    RESULT_DIR,
    "official_test_probabilities.csv"
)

prob_df.to_csv(
    prob_path,
    index=False
)


# ============================================================
# FINAL SIDE-BY-SIDE SUMMARY
# ============================================================

print("\n" + "=" * 75)
print("FINAL 0.50 vs 0.47 COMPARISON")
print("=" * 75)

combined_summary = results_df[
    results_df["dataset"] == "Combined"
][[
    "threshold",
    "accuracy",
    "precision",
    "recall",
    "f1",
    "FP",
    "FN"
]]

print(
    combined_summary.to_string(
        index=False
    )
)


# ============================================================
# CHECK WHETHER 0.47 IMPROVES RECALL
# ============================================================

result_050 = results_df[
    (results_df["dataset"] == "Combined") &
    (results_df["threshold"] == 0.50)
].iloc[0]

result_047 = results_df[
    (results_df["dataset"] == "Combined") &
    (results_df["threshold"] == 0.47)
].iloc[0]

recall_change = (
    result_047["recall"]
    -
    result_050["recall"]
)

fn_change = (
    result_047["FN"]
    -
    result_050["FN"]
)

fp_change = (
    result_047["FP"]
    -
    result_050["FP"]
)


print("\n" + "=" * 75)
print("THRESHOLD EFFECT")
print("=" * 75)

print(
    f"Recall change : {recall_change:+.4f}"
)

print(
    f"FN change     : {fn_change:+d}"
)

print(
    f"FP change     : {fp_change:+d}"
)


# ============================================================
# FINAL FILE LOCATIONS
# ============================================================

print("\n" + "=" * 75)
print("FILES SAVED")
print("=" * 75)

print(
    results_path
)

print(
    prob_path
)

print("\n" + "=" * 75)
print("DONE")
print("=" * 75)