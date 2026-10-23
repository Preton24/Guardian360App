import os
import warnings
import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
    roc_auc_score
)

warnings.filterwarnings("ignore")


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = r"D:\Guardian360"

WINDOW_DIR = os.path.join(
    BASE_DIR,
    "results",
    "windows_v2"
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

RESULT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "random_forest"
)

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(RESULT_DIR, exist_ok=True)

FS = 100


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 75)
print("GUARDIAN 360 - RANDOM FOREST BASELINE")
print("=" * 75)

print("\nLoading V2 windows...")

X_train = np.load(
    os.path.join(WINDOW_DIR, "X_train.npz")
)["X"]

y_train = np.load(
    os.path.join(WINDOW_DIR, "y_train.npz")
)["y"]

X_val = np.load(
    os.path.join(WINDOW_DIR, "X_val.npz")
)["X"]

y_val = np.load(
    os.path.join(WINDOW_DIR, "y_val.npz")
)["y"]

X_test = np.load(
    os.path.join(WINDOW_DIR, "X_test.npz")
)["X"]

y_test = np.load(
    os.path.join(WINDOW_DIR, "y_test.npz")
)["y"]


print("\nDataset shapes:")
print("X_train:", X_train.shape)
print("y_train:", y_train.shape)
print("X_val  :", X_val.shape)
print("y_val  :", y_val.shape)
print("X_test :", X_test.shape)
print("y_test :", y_test.shape)


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def extract_features(X):
    """
    Extract statistical and temporal features from
    2-second, 6-channel sensor windows.

    Channels:
        0 = ax
        1 = ay
        2 = az
        3 = gx
        4 = gy
        5 = gz
    """

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
        # Jerk
        # ----------------------------------------------------

        acc_jerk = np.diff(acc_mag) * FS

        # ----------------------------------------------------
        # Feature list
        # ----------------------------------------------------

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
        # IMPACT / FREE-FALL FEATURES
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
        # JERK FEATURES
        # ====================================================

        if len(acc_jerk) > 0:

            f.extend([
                np.mean(np.abs(acc_jerk)),
                np.std(acc_jerk),
                np.max(np.abs(acc_jerk)),
                np.percentile(
                    np.abs(acc_jerk), 95
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

        acc_peak_index = np.argmax(
            acc_mag
        )

        gyro_peak_index = np.argmax(
            gyro_mag
        )

        f.extend([
            acc_peak_index / len(acc_mag),
            gyro_peak_index / len(gyro_mag),

            abs(
                acc_peak_index -
                gyro_peak_index
            ) / len(acc_mag)
        ])

        # ====================================================
        # PRE / POST IMPACT FEATURES
        # ====================================================

        peak = acc_peak_index

        before_start = max(
            0,
            peak - int(0.5 * FS)
        )

        before = acc_mag[
            before_start:peak
        ]

        after_end = min(
            len(acc_mag),
            peak + int(0.5 * FS)
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


# ============================================================
# EXTRACT FEATURES
# ============================================================

print("\n" + "=" * 75)
print("FEATURE EXTRACTION")
print("=" * 75)

print("\nExtracting TRAIN features...")

F_train = extract_features(X_train)

print(
    "TRAIN feature matrix:",
    F_train.shape
)

print("\nExtracting VALIDATION features...")

F_val = extract_features(X_val)

print(
    "VALIDATION feature matrix:",
    F_val.shape
)

print("\nExtracting TEST features...")

F_test = extract_features(X_test)

print(
    "TEST feature matrix:",
    F_test.shape
)


# ============================================================
# FEATURE NAMES
# ============================================================

feature_names = []

axis_names = [
    "ax",
    "ay",
    "az",
    "gx",
    "gy",
    "gz"
]

stat_names = [
    "mean",
    "std",
    "min",
    "max",
    "range",
    "rms",
    "p25",
    "median",
    "p75"
]

for axis in axis_names:

    for stat in stat_names:

        feature_names.append(
            f"{axis}_{stat}"
        )


mag_stats = [
    "mean",
    "std",
    "min",
    "max",
    "range",
    "rms",
    "p10",
    "p25",
    "median",
    "p75",
    "p90",
    "p95"
]

for stat in mag_stats:

    feature_names.append(
        f"acc_mag_{stat}"
    )

for stat in mag_stats:

    feature_names.append(
        f"gyro_mag_{stat}"
    )


feature_names.extend([
    "acc_below_0.5g",
    "acc_below_0.7g",
    "acc_below_0.8g",
    "acc_above_1.5g",
    "acc_above_2g",
    "acc_above_3g",
    "acc_above_4g",
    "acc_above_5g",

    "gyro_above_30",
    "gyro_above_60",
    "gyro_above_100",
    "gyro_above_150",
    "gyro_above_200",

    "jerk_mean_abs",
    "jerk_std",
    "jerk_max_abs",
    "jerk_p95_abs",

    "acc_peak_position",
    "gyro_peak_position",
    "acc_gyro_peak_distance",

    "acc_before_mean",
    "acc_before_min",
    "acc_before_std",

    "acc_after_mean",
    "acc_after_min",
    "acc_after_std"
])


print(
    "\nNumber of features:",
    len(feature_names)
)


# ============================================================
# CHECK
# ============================================================

if F_train.shape[1] != len(feature_names):

    raise RuntimeError(
        f"Feature count mismatch: "
        f"{F_train.shape[1]} vs "
        f"{len(feature_names)}"
    )


# ============================================================
# SAVE FEATURE DATA
# ============================================================

train_features_df = pd.DataFrame(
    F_train,
    columns=feature_names
)

train_features_df["label"] = y_train

val_features_df = pd.DataFrame(
    F_val,
    columns=feature_names
)

val_features_df["label"] = y_val

test_features_df = pd.DataFrame(
    F_test,
    columns=feature_names
)

test_features_df["label"] = y_test


train_features_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "train_features.csv"
    ),
    index=False
)

val_features_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "validation_features.csv"
    ),
    index=False
)

test_features_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "test_features.csv"
    ),
    index=False
)


# ============================================================
# LABEL DISTRIBUTION
# ============================================================

print("\n" + "=" * 75)
print("LABEL DISTRIBUTION")
print("=" * 75)

print("\nTRAIN:")
print(
    pd.Series(y_train).value_counts()
)

print("\nVALIDATION:")
print(
    pd.Series(y_val).value_counts()
)

print("\nTEST:")
print(
    pd.Series(y_test).value_counts()
)


# ============================================================
# RANDOM FOREST CANDIDATES
# ============================================================

models = {

    "RF_100": RandomForestClassifier(
        n_estimators=100,
        max_depth=None,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    ),

    "RF_200": RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    ),

    "RF_300": RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
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
print("VALIDATION MODEL SELECTION")
print("=" * 75)

validation_results = []

best_model = None
best_name = None
best_f1 = -1


for name, model in models.items():

    print(
        f"\nTraining {name}..."
    )

    model.fit(
        F_train,
        y_train
    )

    val_pred = model.predict(
        F_val
    )

    f1 = f1_score(
        y_val,
        val_pred,
        pos_label=1
    )

    precision = precision_score(
        y_val,
        val_pred,
        pos_label=1,
        zero_division=0
    )

    recall = recall_score(
        y_val,
        val_pred,
        pos_label=1,
        zero_division=0
    )

    accuracy = accuracy_score(
        y_val,
        val_pred
    )

    validation_results.append({
        "model": name,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1
    })

    print(
        f"Accuracy : {accuracy:.4f}"
    )

    print(
        f"Precision: {precision:.4f}"
    )

    print(
        f"Recall   : {recall:.4f}"
    )

    print(
        f"F1       : {f1:.4f}"
    )

    if f1 > best_f1:

        best_f1 = f1
        best_model = model
        best_name = name


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


print("\n" + "=" * 75)

print(
    f"BEST VALIDATION MODEL: {best_name}"
)

print(
    f"Validation F1: {best_f1:.4f}"
)

print("=" * 75)


# ============================================================
# FINAL MODEL
# ============================================================
#
# Now retrain using TRAIN + VALIDATION.
#
# TEST IS NOT TOUCHED until this point.
# ============================================================

print("\nCombining TRAIN + VALIDATION...")

F_train_final = np.concatenate(
    [
        F_train,
        F_val
    ],
    axis=0
)

y_train_final = np.concatenate(
    [
        y_train,
        y_val
    ],
    axis=0
)

print(
    "Final training features:",
    F_train_final.shape
)


# Create a fresh copy of the selected configuration
final_model = RandomForestClassifier(
    n_estimators=best_model.n_estimators,
    max_depth=best_model.max_depth,
    min_samples_leaf=best_model.min_samples_leaf,
    max_features=best_model.max_features,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)


print("\nTraining final Random Forest...")

final_model.fit(
    F_train_final,
    y_train_final
)


# ============================================================
# TEST
# ============================================================

print("\n" + "=" * 75)
print("FINAL TEST EVALUATION")
print("=" * 75)

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
    pos_label=1,
    zero_division=0
)

recall = recall_score(
    y_test,
    test_pred,
    pos_label=1,
    zero_division=0
)

f1 = f1_score(
    y_test,
    test_pred,
    pos_label=1,
    zero_division=0
)

auc = roc_auc_score(
    y_test,
    test_prob
)


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


# ============================================================
# CONFUSION MATRIX
# ============================================================

cm = confusion_matrix(
    y_test,
    test_pred
)

print("\n" + "=" * 75)
print("CONFUSION MATRIX")
print("=" * 75)

print(
    "\n                Predicted"
)

print(
    "              NORMAL  FALL"
)

print(
    f"Actual NORMAL   {cm[0,0]:5d}  {cm[0,1]:5d}"
)

print(
    f"Actual FALL     {cm[1,0]:5d}  {cm[1,1]:5d}"
)


# ============================================================
# CLASSIFICATION REPORT
# ============================================================

print("\n" + "=" * 75)
print("CLASSIFICATION REPORT")
print("=" * 75)

report = classification_report(
    y_test,
    test_pred,
    target_names=[
        "NORMAL",
        "FALL"
    ],
    digits=4
)

print("\n" + report)


# ============================================================
# SAVE CLASSIFICATION REPORT
# ============================================================

with open(
    os.path.join(
        RESULT_DIR,
        "classification_report.txt"
    ),
    "w"
) as f:

    f.write(
        "Guardian 360 Random Forest\n"
    )

    f.write(
        "==========================\n\n"
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


# ============================================================
# FEATURE IMPORTANCE
# ============================================================

print("\n" + "=" * 75)
print("TOP FEATURE IMPORTANCE")
print("=" * 75)

importance_df = pd.DataFrame({
    "feature": feature_names,
    "importance": final_model.feature_importances_
})

importance_df = importance_df.sort_values(
    "importance",
    ascending=False
)

print(
    "\n",
    importance_df.head(20).to_string(
        index=False
    )
)

importance_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "feature_importance.csv"
    ),
    index=False
)


# ============================================================
# SAVE MODEL
# ============================================================

model_path = os.path.join(
    MODEL_DIR,
    "guardian360_random_forest.joblib"
)

joblib.dump(
    {
        "model": final_model,
        "feature_names": feature_names,
        "sampling_rate": FS
    },
    model_path
)


# ============================================================
# SAVE TEST PREDICTIONS
# ============================================================

predictions_df = pd.DataFrame({

    "actual": y_test,

    "predicted": test_pred,

    "fall_probability": test_prob

})

predictions_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "test_predictions.csv"
    ),
    index=False
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "=" * 75)
print("TRAINING COMPLETE")
print("=" * 75)

print(
    f"""
Best validation model:
    {best_name}

FINAL TEST:

Accuracy : {accuracy:.4f}
Precision: {precision:.4f}
Recall   : {recall:.4f}
F1 Score : {f1:.4f}
ROC-AUC  : {auc:.4f}

Model saved to:

{model_path}

Results saved to:

{RESULT_DIR}
"""
)

print("=" * 75)