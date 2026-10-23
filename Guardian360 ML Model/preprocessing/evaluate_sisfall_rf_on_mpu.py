import os
import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
    roc_auc_score
)


# ============================================================
# GUARDIAN 360
# SISFALL RF -> MPU ZERO-SHOT EVALUATION
# ============================================================
#
# IMPORTANT:
# This does NOT retrain the model.
#
# The Random Forest was trained ONLY on SisFall.
# The MPU dataset is completely unseen.
#
# We intentionally reproduce the ORIGINAL SisFall feature
# extractor exactly, including FS = 100.
#
# This experiment answers:
#
# "How well does the SisFall-trained model generalize
#  directly to the public MPU dataset?"
#
# ============================================================


# ------------------------------------------------------------
# 1. PATHS
# ------------------------------------------------------------

BASE_DIR = r"D:\Guardian360"

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "guardian360_random_forest.joblib"
)

MPU_WINDOW_DIR = os.path.join(
    BASE_DIR,
    "results",
    "mpu_dataset",
    "windows"
)

RESULT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "zero_shot_mpu"
)

os.makedirs(
    RESULT_DIR,
    exist_ok=True
)


# ------------------------------------------------------------
# 2. LOAD MODEL
# ------------------------------------------------------------

print("=" * 75)
print("GUARDIAN 360 - SISFALL -> MPU ZERO-SHOT TEST")
print("=" * 75)

print("\nLoading SisFall Random Forest...")

bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
feature_names = bundle["feature_names"]
training_fs = bundle["sampling_rate"]

print(
    f"Model sampling rate : {training_fs} Hz"
)

print(
    f"Expected features   : {len(feature_names)}"
)


# ------------------------------------------------------------
# 3. LOAD MPU TEST DATA
# ------------------------------------------------------------

test_file = os.path.join(
    MPU_WINDOW_DIR,
    "mpu_windows_test.npz"
)

metadata_file = os.path.join(
    MPU_WINDOW_DIR,
    "mpu_windows_metadata.csv"
)

print("\nLoading MPU test windows...")

data = np.load(test_file)

X_test = data["X"]
y_test = data["y"]

metadata = pd.read_csv(metadata_file)

# Metadata contains ALL windows.
# Select only the rows belonging to the test split.

metadata_test = metadata[
    metadata["split"] == "test"
].reset_index(drop=True)


print(
    f"MPU test windows    : {X_test.shape}"
)

print(
    f"MPU test labels     : {y_test.shape}"
)

print(
    f"MPU test metadata   : {metadata_test.shape}"
)


# ------------------------------------------------------------
# 4. SAFETY CHECK
# ------------------------------------------------------------

if len(X_test) != len(y_test):
    raise RuntimeError(
        "X_test and y_test have different lengths."
    )

if len(X_test) != len(metadata_test):
    raise RuntimeError(
        "Test windows and test metadata do not match."
    )

if X_test.shape[1] != 20:
    raise RuntimeError(
        f"Expected 20 samples per window, "
        f"got {X_test.shape[1]}"
    )

if X_test.shape[2] != 6:
    raise RuntimeError(
        f"Expected 6 channels, "
        f"got {X_test.shape[2]}"
    )


# ------------------------------------------------------------
# 5. EXACT ORIGINAL SISFALL FEATURE EXTRACTOR
# ------------------------------------------------------------

def extract_features(X):

    features = []

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
        # ORIGINAL SISFALL JERK
        # ----------------------------------------------------
        #
        # IMPORTANT:
        # The original model used FS = 100.
        #
        # We deliberately preserve this for the zero-shot
        # experiment.
        #

        acc_jerk = np.diff(acc_mag) * training_fs

        f = []

        # ====================================================
        # AXIS STATISTICS
        # ====================================================

        for signal in [
            ax, ay, az,
            gx, gy, gz
        ]:

            f.extend([
                np.mean(signal),
                np.std(signal),
                np.min(signal),
                np.max(signal),
                np.ptp(signal),
                np.sqrt(np.mean(signal ** 2)),
                np.percentile(signal, 25),
                np.percentile(signal, 50),
                np.percentile(signal, 75)
            ])

        # ====================================================
        # ACCELERATION MAGNITUDE
        # ====================================================

        f.extend([
            np.mean(acc_mag),
            np.std(acc_mag),
            np.min(acc_mag),
            np.max(acc_mag),
            np.ptp(acc_mag),
            np.sqrt(np.mean(acc_mag ** 2)),
            np.percentile(acc_mag, 10),
            np.percentile(acc_mag, 25),
            np.percentile(acc_mag, 50),
            np.percentile(acc_mag, 75),
            np.percentile(acc_mag, 90),
            np.percentile(acc_mag, 95)
        ])

        # ====================================================
        # GYROSCOPE MAGNITUDE
        # ====================================================

        f.extend([
            np.mean(gyro_mag),
            np.std(gyro_mag),
            np.min(gyro_mag),
            np.max(gyro_mag),
            np.ptp(gyro_mag),
            np.sqrt(np.mean(gyro_mag ** 2)),
            np.percentile(gyro_mag, 10),
            np.percentile(gyro_mag, 25),
            np.percentile(gyro_mag, 50),
            np.percentile(gyro_mag, 75),
            np.percentile(gyro_mag, 90),
            np.percentile(gyro_mag, 95)
        ])

        # ====================================================
        # IMPACT / FREE-FALL
        # ====================================================

        f.extend([
            np.mean(acc_mag < 0.5),
            np.mean(acc_mag < 0.7),
            np.mean(acc_mag < 0.8),
            np.mean(acc_mag > 1.5),
            np.mean(acc_mag > 2.0),
            np.mean(acc_mag > 3.0),
            np.mean(acc_mag > 4.0),
            np.mean(acc_mag > 5.0)
        ])

        # ====================================================
        # GYRO ACTIVITY
        # ====================================================

        f.extend([
            np.mean(gyro_mag > 30),
            np.mean(gyro_mag > 60),
            np.mean(gyro_mag > 100),
            np.mean(gyro_mag > 150),
            np.mean(gyro_mag > 200)
        ])

        # ====================================================
        # JERK
        # ====================================================

        if len(acc_jerk) > 0:

            f.extend([
                np.mean(np.abs(acc_jerk)),
                np.std(acc_jerk),
                np.max(np.abs(acc_jerk)),
                np.percentile(
                    np.abs(acc_jerk),
                    95
                )
            ])

        else:

            f.extend([
                0,
                0,
                0,
                0
            ])

        # ====================================================
        # PEAK LOCATIONS
        # ====================================================

        acc_peak_index = np.argmax(acc_mag)

        gyro_peak_index = np.argmax(gyro_mag)

        f.extend([
            acc_peak_index / len(acc_mag),
            gyro_peak_index / len(gyro_mag),
            abs(
                acc_peak_index -
                gyro_peak_index
            ) / len(acc_mag)
        ])

        # ====================================================
        # PRE / POST IMPACT
        # ====================================================

        peak = acc_peak_index

        before_start = max(
            0,
            peak - int(0.5 * training_fs)
        )

        before = acc_mag[
            before_start:peak
        ]

        after_end = min(
            len(acc_mag),
            peak + int(0.5 * training_fs)
        )

        after = acc_mag[
            peak:after_end
        ]

        if len(before) > 0:

            f.extend([
                np.mean(before),
                np.min(before),
                np.std(before)
            ])

        else:

            f.extend([
                0,
                0,
                0
            ])

        if len(after) > 0:

            f.extend([
                np.mean(after),
                np.min(after),
                np.std(after)
            ])

        else:

            f.extend([
                0,
                0,
                0
            ])

        features.append(f)

    return np.asarray(
        features,
        dtype=np.float32
    )


# ------------------------------------------------------------
# 6. EXTRACT MPU FEATURES
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("FEATURE EXTRACTION")
print("=" * 75)

print(
    "\nExtracting features from MPU test windows..."
)

F_test = extract_features(X_test)

print(
    f"Feature matrix: {F_test.shape}"
)


# ------------------------------------------------------------
# 7. FEATURE COMPATIBILITY CHECK
# ------------------------------------------------------------

if F_test.shape[1] != len(feature_names):

    raise RuntimeError(
        f"""
FEATURE COUNT MISMATCH

Model expects : {len(feature_names)}
MPU provides  : {F_test.shape[1]}

Cannot safely evaluate the model.
"""
    )

print(
    f"Feature count matches model: "
    f"{F_test.shape[1]}"
)


# ------------------------------------------------------------
# 8. PREDICTION
# ------------------------------------------------------------

print("\nRunning zero-shot predictions...")

pred = model.predict(F_test)

prob = model.predict_proba(
    F_test
)[:, 1]


# ------------------------------------------------------------
# 9. METRICS
# ------------------------------------------------------------

accuracy = accuracy_score(
    y_test,
    pred
)

precision = precision_score(
    y_test,
    pred,
    pos_label=1,
    zero_division=0
)

recall = recall_score(
    y_test,
    pred,
    pos_label=1,
    zero_division=0
)

f1 = f1_score(
    y_test,
    pred,
    pos_label=1,
    zero_division=0
)

try:
    auc = roc_auc_score(
        y_test,
        prob
    )
except ValueError:
    auc = float("nan")


# ------------------------------------------------------------
# 10. PRINT METRICS
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("ZERO-SHOT RESULTS")
print("=" * 75)

print(
    f"\nAccuracy : {accuracy:.4f}"
)

print(
    f"Precision: {precision:.4f}"
)

print(
    f"Recall   : {recall:.4f}"
)

print(
    f"F1 Score : {f1:.4f}"
)

print(
    f"ROC-AUC  : {auc:.4f}"
)


# ------------------------------------------------------------
# 11. CONFUSION MATRIX
# ------------------------------------------------------------

cm = confusion_matrix(
    y_test,
    pred
)

print("\n" + "=" * 75)
print("CONFUSION MATRIX")
print("=" * 75)

print("\n                Predicted")
print("              NORMAL  FALL")

print(
    f"Actual NORMAL   {cm[0,0]:5d}  {cm[0,1]:5d}"
)

print(
    f"Actual FALL     {cm[1,0]:5d}  {cm[1,1]:5d}"
)


# ------------------------------------------------------------
# 12. CLASSIFICATION REPORT
# ------------------------------------------------------------

report = classification_report(
    y_test,
    pred,
    target_names=[
        "NORMAL",
        "FALL"
    ],
    digits=4
)

print("\n" + "=" * 75)
print("CLASSIFICATION REPORT")
print("=" * 75)

print("\n" + report)


# ------------------------------------------------------------
# 13. PER-ACTIVITY RESULTS
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("PER-ACTIVITY RESULTS")
print("=" * 75)

activity_results = []

for activity in sorted(
    metadata_test["activity"].unique()
):

    mask = (
        metadata_test["activity"].values
        == activity
    )

    actual = y_test[mask]
    predicted = pred[mask]

    total = len(actual)

    correct = np.sum(
        actual == predicted
    )

    false_positives = np.sum(
        (actual == 0) &
        (predicted == 1)
    )

    false_negatives = np.sum(
        (actual == 1) &
        (predicted == 0)
    )

    activity_results.append({
        "activity": activity,
        "windows": total,
        "correct": correct,
        "accuracy": correct / total
        if total > 0 else 0,
        "false_positives": false_positives,
        "false_negatives": false_negatives
    })

    print(
        f"\n{activity}"
    )

    print(
        f"  Windows          : {total}"
    )

    print(
        f"  Correct          : {correct}"
    )

    print(
        f"  Accuracy         : "
        f"{correct / total:.4f}"
        if total > 0
        else "  Accuracy         : N/A"
    )

    print(
        f"  False positives  : "
        f"{false_positives}"
    )

    print(
        f"  False negatives  : "
        f"{false_negatives}"
    )


activity_df = pd.DataFrame(
    activity_results
)

activity_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "per_activity_results.csv"
    ),
    index=False
)


# ------------------------------------------------------------
# 14. SAVE ALL PREDICTIONS
# ------------------------------------------------------------

predictions = metadata_test.copy()

predictions["actual"] = y_test

predictions["predicted"] = pred

predictions["fall_probability"] = prob

predictions.to_csv(
    os.path.join(
        RESULT_DIR,
        "mpu_zero_shot_predictions.csv"
    ),
    index=False
)


# ------------------------------------------------------------
# 15. SAVE SUMMARY
# ------------------------------------------------------------

summary = pd.DataFrame({
    "metric": [
        "accuracy",
        "precision",
        "recall",
        "f1",
        "roc_auc",
        "test_windows",
        "test_fall_windows",
        "test_normal_windows",
        "false_positives",
        "false_negatives"
    ],
    "value": [
        accuracy,
        precision,
        recall,
        f1,
        auc,
        len(y_test),
        np.sum(y_test == 1),
        np.sum(y_test == 0),
        cm[0, 1],
        cm[1, 0]
    ]
})

summary.to_csv(
    os.path.join(
        RESULT_DIR,
        "zero_shot_summary.csv"
    ),
    index=False
)


# ------------------------------------------------------------
# 16. SAVE TEXT REPORT
# ------------------------------------------------------------

report_path = os.path.join(
    RESULT_DIR,
    "zero_shot_report.txt"
)

with open(
    report_path,
    "w"
) as f:

    f.write(
        "Guardian 360 - SisFall -> MPU Zero-Shot Test\n"
    )

    f.write(
        "=============================================\n\n"
    )

    f.write(
        "Model: SisFall-trained Random Forest\n"
    )

    f.write(
        f"Training sampling rate: {training_fs} Hz\n"
    )

    f.write(
        f"MPU windows: {len(X_test)}\n\n"
    )

    f.write(
        f"Accuracy : {accuracy:.4f}\n"
    )

    f.write(
        f"Precision: {precision:.4f}\n"
    )

    f.write(
        f"Recall   : {recall:.4f}\n"
    )

    f.write(
        f"F1 Score : {f1:.4f}\n"
    )

    f.write(
        f"ROC-AUC  : {auc:.4f}\n\n"
    )

    f.write(
        "Confusion Matrix:\n"
    )

    f.write(
        str(cm)
    )

    f.write(
        "\n\nClassification Report:\n"
    )

    f.write(
        report
    )


# ------------------------------------------------------------
# 17. FINAL
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("ZERO-SHOT EVALUATION COMPLETE")
print("=" * 75)

print(
    f"""
Model:
    {MODEL_PATH}

MPU test data:
    {test_file}

Results:
    {RESULT_DIR}

The model was NOT retrained.
The MPU test data was completely unseen.
"""
)

print("=" * 75)