import os
import pandas as pd
import numpy as np

BASE_DIR = r"D:\Guardian360"

RESULT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "mpu_threshold_tuning"
)

PRED_FILE = os.path.join(
    RESULT_DIR,
    "mpu_validation_predictions.csv"
)

df = pd.read_csv(PRED_FILE)

print("\n" + "=" * 75)
print("GUARDIAN 360 - MPU VALIDATION FALL ANALYSIS")
print("=" * 75)

print("\nTotal validation windows:", len(df))

# ------------------------------------------------------------
# Basic label cleanup
# ------------------------------------------------------------

df["actual"] = pd.to_numeric(df["actual"])
df["predicted"] = pd.to_numeric(df["predicted"])
df["fall_probability"] = pd.to_numeric(
    df["fall_probability"]
)

# ------------------------------------------------------------
# FALL windows
# ------------------------------------------------------------

falls = df[df["actual"] == 1].copy()

detected = falls[
    falls["predicted"] == 1
].copy()

missed = falls[
    falls["predicted"] == 0
].copy()

print("\nFALL windows:")
print("Total   :", len(falls))
print("Detected:", len(detected))
print("Missed  :", len(missed))

# ------------------------------------------------------------
# Probability statistics
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("FALL PROBABILITY DISTRIBUTION")
print("=" * 75)

print("\nCorrectly detected FALLs:")

print(
    detected["fall_probability"].describe()
)

print("\nMissed FALLs:")

print(
    missed["fall_probability"].describe()
)

# ------------------------------------------------------------
# Missed FALL details
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("MISSED FALL WINDOWS")
print("=" * 75)

columns = [
    "source_file",
    "activity",
    "fall_probability"
]

available_columns = [
    c for c in columns
    if c in missed.columns
]

print(
    missed[
        available_columns
    ]
    .sort_values(
        "fall_probability"
    )
    .to_string(index=False)
)

# ------------------------------------------------------------
# Missed falls by activity
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("MISSED FALLS BY ACTIVITY")
print("=" * 75)

print(
    missed[
        "activity"
    ]
    .value_counts()
    .to_string()
)

# ------------------------------------------------------------
# All FALL windows by activity
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("FALL DETECTION BY ACTIVITY")
print("=" * 75)

activity_stats = []

for activity, group in falls.groupby("activity"):

    total = len(group)

    detected_count = np.sum(
        group["predicted"] == 1
    )

    missed_count = np.sum(
        group["predicted"] == 0
    )

    recall = detected_count / total

    activity_stats.append({
        "activity": activity,
        "total_fall_windows": total,
        "detected": detected_count,
        "missed": missed_count,
        "recall": recall,
        "mean_probability": group[
            "fall_probability"
        ].mean(),
        "min_probability": group[
            "fall_probability"
        ].min(),
        "max_probability": group[
            "fall_probability"
        ].max()
    })

activity_df = pd.DataFrame(
    activity_stats
)

activity_df = activity_df.sort_values(
    "recall"
)

print(
    activity_df.to_string(
        index=False
    )
)

# ------------------------------------------------------------
# Recording-level analysis
# ------------------------------------------------------------

print("\n" + "=" * 75)
print("RECORDING-LEVEL FALL ANALYSIS")
print("=" * 75)

recording_stats = []

for source_file, group in falls.groupby(
    "source_file"
):

    activity = group[
        "activity"
    ].iloc[0]

    total_windows = len(group)

    detected_windows = np.sum(
        group["predicted"] == 1
    )

    missed_windows = np.sum(
        group["predicted"] == 0
    )

    recording_stats.append({
        "source_file": source_file,
        "activity": activity,
        "windows": total_windows,
        "detected": detected_windows,
        "missed": missed_windows,
        "detection_rate":
            detected_windows / total_windows,
        "min_probability":
            group["fall_probability"].min(),
        "mean_probability":
            group["fall_probability"].mean(),
        "max_probability":
            group["fall_probability"].max()
    })

recording_df = pd.DataFrame(
    recording_stats
)

# ------------------------------------------------------------
# Hardest recordings
# ------------------------------------------------------------

print("\nHardest FALL recordings:")

hardest = recording_df.sort_values(
    [
        "detection_rate",
        "mean_probability"
    ],
    ascending=[
        True,
        True
    ]
)

print(
    hardest.head(25).to_string(
        index=False
    )
)

# ------------------------------------------------------------
# Save reports
# ------------------------------------------------------------

activity_path = os.path.join(
    RESULT_DIR,
    "fall_activity_analysis.csv"
)

recording_path = os.path.join(
    RESULT_DIR,
    "fall_recording_analysis.csv"
)

missed_path = os.path.join(
    RESULT_DIR,
    "missed_falls_detailed.csv"
)

activity_df.to_csv(
    activity_path,
    index=False
)

recording_df.to_csv(
    recording_path,
    index=False
)

missed.to_csv(
    missed_path,
    index=False
)

print("\n" + "=" * 75)
print("DONE")
print("=" * 75)

print("\nSaved:")

print(activity_path)
print(recording_path)
print(missed_path)