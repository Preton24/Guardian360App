import os
import numpy as np
import pandas as pd

# ============================================================
# GUARDIAN 360 - MPU DATASET WINDOW CREATION
# ============================================================
#
# Creates native-rate 2-second windows from the MPU dataset.
#
# IMPORTANT:
# - We DO NOT upsample the ~10 Hz data.
# - 2 seconds ~= 20 samples.
# - Windows are created separately within each recording.
# - Train/test split is inherited from the recording.
#
# Input:
#   D:\Guardian360\results\mpu_dataset\mpu_normalized.csv
#
# Output:
#   D:\Guardian360\results\mpu_dataset\windows
#
# ============================================================


# ------------------------------------------------------------
# 1. Paths
# ------------------------------------------------------------

INPUT_FILE = r"D:\Guardian360\results\mpu_dataset\mpu_normalized.csv"

OUTPUT_DIR = r"D:\Guardian360\results\mpu_dataset\windows"

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ------------------------------------------------------------
# 2. Configuration
# ------------------------------------------------------------

# Dataset is approximately 9.9 Hz.
# Therefore 2 seconds is approximately 20 samples.
WINDOW_SIZE = 20

# 50% overlap
STEP_SIZE = 10

CHANNELS = [
    "ax_g",
    "ay_g",
    "az_g",
    "gx_dps",
    "gy_dps",
    "gz_dps"
]


# ------------------------------------------------------------
# 3. Load data
# ------------------------------------------------------------

print("=" * 70)
print("GUARDIAN 360 - MPU WINDOW CREATION")
print("=" * 70)

print("\nLoading dataset...")

df = pd.read_csv(INPUT_FILE)

print(f"Total rows: {len(df):,}")
print(f"Columns: {list(df.columns)}")


# ------------------------------------------------------------
# 4. Check required columns
# ------------------------------------------------------------

required_columns = [
    "source_file",
    "activity",
    "label",
    "split"
] + CHANNELS

missing = [
    col for col in required_columns
    if col not in df.columns
]

if missing:
    raise ValueError(
        f"Missing required columns: {missing}"
    )


# ------------------------------------------------------------
# 5. Remove invalid sensor rows
# ------------------------------------------------------------

before = len(df)

df = df.dropna(
    subset=CHANNELS
).reset_index(drop=True)

after = len(df)

print(
    f"\nRemoved invalid sensor rows: "
    f"{before - after:,}"
)


# ------------------------------------------------------------
# 6. Create windows
# ------------------------------------------------------------

X = []
y = []

metadata = []

recording_count = 0
window_count = 0

print("\nCreating windows...")


# Group by recording.
#
# source_file uniquely identifies a recording.
#
# We also retain activity, label and split.

groups = df.groupby(
    ["source_file", "activity", "label", "split"],
    sort=False
)


for (
    (source_file, activity, label, split),
    recording
) in groups:

    recording_count += 1

    # --------------------------------------------------------
    # Extract sensor values
    # --------------------------------------------------------

    data = recording[CHANNELS].to_numpy(
        dtype=np.float32
    )

    n_samples = len(data)

    # --------------------------------------------------------
    # Need at least one complete 2-second window
    # --------------------------------------------------------

    if n_samples < WINDOW_SIZE:
        continue

    # --------------------------------------------------------
    # Sliding windows
    # --------------------------------------------------------

    for start in range(
        0,
        n_samples - WINDOW_SIZE + 1,
        STEP_SIZE
    ):

        end = start + WINDOW_SIZE

        window = data[start:end]

        # Safety check
        if window.shape != (
            WINDOW_SIZE,
            len(CHANNELS)
        ):
            continue

        X.append(window)

        y.append(
            1 if label == "FALL" else 0
        )

        metadata.append({
            "source_file": source_file,
            "activity": activity,
            "label": label,
            "split": split,
            "start_sample": start,
            "end_sample": end - 1
        })

        window_count += 1


# ------------------------------------------------------------
# 7. Convert to numpy
# ------------------------------------------------------------

X = np.asarray(
    X,
    dtype=np.float32
)

y = np.asarray(
    y,
    dtype=np.int8
)

metadata = pd.DataFrame(metadata)


# ------------------------------------------------------------
# 8. Print results
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("WINDOW CREATION RESULTS")
print("=" * 70)

print(
    f"\nRecordings processed : {recording_count}"
)

print(
    f"Total windows        : {len(X):,}"
)

print(
    f"Window shape         : {X.shape}"
)

print(
    f"Window duration      : ~2.0 seconds"
)

print(
    f"Window samples       : {WINDOW_SIZE}"
)

print(
    f"Step size            : {STEP_SIZE}"
)

print(
    f"Approx. overlap      : 50%"
)


# ------------------------------------------------------------
# 9. Label distribution
# ------------------------------------------------------------

print("\nWINDOW LABEL DISTRIBUTION")

unique, counts = np.unique(
    y,
    return_counts=True
)

for value, count in zip(unique, counts):

    label_name = (
        "FALL"
        if value == 1
        else "NORMAL"
    )

    print(
        f"  {label_name:<10} {count:,}"
    )


# ------------------------------------------------------------
# 10. Split distribution
# ------------------------------------------------------------

print("\nWINDOW SPLIT DISTRIBUTION")

print(
    metadata["split"]
    .value_counts()
    .sort_index()
)


# ------------------------------------------------------------
# 11. Activity distribution
# ------------------------------------------------------------

print("\nWINDOW ACTIVITY DISTRIBUTION")

print(
    metadata["activity"]
    .value_counts()
    .sort_index()
)


# ------------------------------------------------------------
# 12. Save complete dataset
# ------------------------------------------------------------

complete_file = os.path.join(
    OUTPUT_DIR,
    "mpu_windows.npz"
)

np.savez_compressed(
    complete_file,
    X=X,
    y=y
)


metadata_file = os.path.join(
    OUTPUT_DIR,
    "mpu_windows_metadata.csv"
)

metadata.to_csv(
    metadata_file,
    index=False
)


# ------------------------------------------------------------
# 13. Save train / validation / test separately
# ------------------------------------------------------------

for split_name in ["train", "test"]:

    mask = (
        metadata["split"].values
        == split_name
    )

    X_split = X[mask]
    y_split = y[mask]

    split_file = os.path.join(
        OUTPUT_DIR,
        f"mpu_windows_{split_name}.npz"
    )

    np.savez_compressed(
        split_file,
        X=X_split,
        y=y_split
    )

    print(
        f"\n{split_name.upper()}:"
    )

    print(
        f"  Windows : {len(X_split):,}"
    )

    print(
        f"  FALL    : {np.sum(y_split == 1):,}"
    )

    print(
        f"  NORMAL  : {np.sum(y_split == 0):,}"
    )


# ------------------------------------------------------------
# 14. Save summary
# ------------------------------------------------------------

summary = pd.DataFrame({
    "total_recordings": [recording_count],
    "total_windows": [len(X)],
    "window_size_samples": [WINDOW_SIZE],
    "step_size_samples": [STEP_SIZE],
    "channels": [len(CHANNELS)],
    "fall_windows": [np.sum(y == 1)],
    "normal_windows": [np.sum(y == 0)]
})

summary_file = os.path.join(
    OUTPUT_DIR,
    "window_summary.csv"
)

summary.to_csv(
    summary_file,
    index=False
)


# ------------------------------------------------------------
# 15. Final output
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)

print("\nFiles created:")

print(
    f"  {complete_file}"
)

print(
    f"  {metadata_file}"
)

print(
    f"  {os.path.join(OUTPUT_DIR, 'mpu_windows_train.npz')}"
)

print(
    f"  {os.path.join(OUTPUT_DIR, 'mpu_windows_test.npz')}"
)

print(
    f"  {summary_file}"
)

print("\nIMPORTANT:")
print(
    "Windows from the same recording remain in the same split."
)

print(
    "No artificial upsampling was performed."
)