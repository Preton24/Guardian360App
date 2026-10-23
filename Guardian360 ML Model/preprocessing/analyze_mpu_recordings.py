import pandas as pd
import numpy as np

INPUT = r"D:\Guardian360\results\mpu_dataset\mpu_normalized.csv"

df = pd.read_csv(INPUT)

print("=" * 70)
print("GUARDIAN 360 - MPU RECORDING ANALYSIS")
print("=" * 70)

# ------------------------------------------------------------
# Recording lengths
# ------------------------------------------------------------

recordings = (
    df.groupby(
        [
            "source_file",
            "activity",
            "label",
            "split"
        ]
    )
    .agg(
        samples=("timestamp", "count"),
        duration_ms=("timestamp", lambda x: x.max() - x.min())
    )
    .reset_index()
)

recordings["duration_sec"] = (
    recordings["duration_ms"] / 1000.0
)

print(
    f"\nUsable recordings: "
    f"{len(recordings)}"
)

print("\nSamples per recording:")
print(
    recordings["samples"].describe()
)

print("\nDuration per recording (seconds):")
print(
    recordings["duration_sec"].describe()
)

# ------------------------------------------------------------
# By activity
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("BY ACTIVITY")
print("=" * 70)

summary = (
    recordings
    .groupby("activity")
    .agg(
        recordings=("samples", "count"),
        min_samples=("samples", "min"),
        median_samples=("samples", "median"),
        max_samples=("samples", "max"),
        median_duration_sec=(
            "duration_sec",
            "median"
        )
    )
)

print(summary.to_string())

# ------------------------------------------------------------
# By label
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("BY LABEL")
print("=" * 70)

summary = (
    recordings
    .groupby("label")
    .agg(
        recordings=("samples", "count"),
        min_samples=("samples", "min"),
        median_samples=("samples", "median"),
        max_samples=("samples", "max"),
        median_duration_sec=(
            "duration_sec",
            "median"
        )
    )
)

print(summary.to_string())

# ------------------------------------------------------------
# Check whether 2-second windows are possible
# ------------------------------------------------------------

WINDOW_SAMPLES = 20

print("\n" + "=" * 70)
print("2-SECOND WINDOW CHECK")
print("=" * 70)

for activity, group in recordings.groupby("activity"):

    enough = (
        group["samples"] >= WINDOW_SAMPLES
    ).sum()

    total = len(group)

    print(
        f"{activity:<22} "
        f"{enough:>4}/{total:<4} "
        f"recordings have >= 20 samples"
    )

# ------------------------------------------------------------
# Very short recordings
# ------------------------------------------------------------

short = recordings[
    recordings["samples"] < WINDOW_SAMPLES
]

print("\nRecordings shorter than 2 seconds:")

if len(short) == 0:

    print("None")

else:

    print(
        short[
            [
                "source_file",
                "activity",
                "label",
                "samples",
                "duration_sec"
            ]
        ].to_string(index=False)
    )

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)