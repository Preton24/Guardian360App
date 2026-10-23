import os
import math
import pandas as pd
import numpy as np

# ============================================================
# CONFIGURATION
# ============================================================

DATA_DIR = r"D:\Guardian360\dataMPU"
OUTPUT_DIR = r"D:\Guardian360\results\mpu_dataset"

FALL_CLASSES = {
    "fall-standup",
    "fall-unconcious"
}

NORMAL_CLASSES = {
    "idle",
    "run",
    "stair",
    "walk",
    "exercise"
}

REQUIRED_COLUMNS = [
    "timestamp",
    "ax",
    "ay",
    "az",
    "gx",
    "gy",
    "gz"
]

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 70)
print("GUARDIAN 360 - ROBUST MPU DATASET CONVERTER")
print("=" * 70)

# ============================================================
# FIND ALL CSV FILES
# ============================================================

all_files = []

for root, dirs, files in os.walk(DATA_DIR):
    for file in files:
        if file.lower().endswith(".csv"):
            all_files.append(os.path.join(root, file))

print(f"\nCSV files found: {len(all_files)}")

# ============================================================
# STORAGE
# ============================================================

converted_data = []

activity_counts = {}
label_counts = {}
split_counts = {}

file_status = []
bad_rows = []

sampling_intervals = []

# ============================================================
# PROCESS FILES
# ============================================================

for index, filepath in enumerate(all_files, start=1):

    relative = os.path.relpath(filepath, DATA_DIR)
    parts = relative.split(os.sep)

    activity = parts[0].lower()

    # --------------------------------------------------------
    # LABEL
    # --------------------------------------------------------

    if activity in FALL_CLASSES:
        label = "FALL"

    elif activity in NORMAL_CLASSES:
        label = "NORMAL"

    else:
        file_status.append(
            (relative, "UNKNOWN_CLASS")
        )
        continue

    # --------------------------------------------------------
    # TRAIN / TEST
    # --------------------------------------------------------

    split = "unknown"

    for part in parts:
        if part.lower() in [
            "train",
            "test",
            "validation",
            "val"
        ]:
            split = part.lower()
            break

    # --------------------------------------------------------
    # READ CSV
    #
    # on_bad_lines='skip' allows valid rows to survive.
    # --------------------------------------------------------

    try:

        df = pd.read_csv(
            filepath,
            on_bad_lines="skip"
        )

    except Exception as e:

        print(f"\nFAILED: {relative}")
        print(str(e))

        file_status.append(
            (relative, "READ_ERROR")
        )

        continue

    # --------------------------------------------------------
    # NORMALIZE COLUMN NAMES
    # --------------------------------------------------------

    df.columns = [
        str(c).strip().lower()
        for c in df.columns
    ]

    # --------------------------------------------------------
    # CHECK REQUIRED COLUMNS
    # --------------------------------------------------------

    missing = [
        col
        for col in REQUIRED_COLUMNS
        if col not in df.columns
    ]

    if missing:

        print(f"\nFAILED: {relative}")
        print("Missing:", missing)

        file_status.append(
            (
                relative,
                "MISSING_COLUMNS"
            )
        )

        continue

    # --------------------------------------------------------
    # KEEP SENSOR DATA
    # --------------------------------------------------------

    df = df[
        REQUIRED_COLUMNS
    ].copy()

    # --------------------------------------------------------
    # CONVERT TO NUMERIC
    # --------------------------------------------------------

    original_rows = len(df)

    for col in REQUIRED_COLUMNS:

        df[col] = pd.to_numeric(
            df[col],
            errors="coerce"
        )

    # Count invalid rows
    invalid_rows = df.isna().any(axis=1).sum()

    if invalid_rows > 0:

        bad_rows.append(
            (
                relative,
                int(invalid_rows),
                "non-numeric/missing sensor values"
            )
        )

    df = df.dropna()

    if len(df) < 2:

        file_status.append(
            (
                relative,
                "TOO_FEW_VALID_ROWS"
            )
        )

        continue

    # --------------------------------------------------------
    # SAMPLING INTERVAL
    # --------------------------------------------------------

    timestamps = df[
        "timestamp"
    ].values

    diffs = np.diff(timestamps)

    valid_diffs = diffs[
        np.isfinite(diffs) &
        (diffs > 0)
    ]

    if len(valid_diffs) > 0:

        sampling_intervals.append(
            np.median(valid_diffs)
        )

    # ========================================================
    # UNIT CONVERSION
    #
    # Acceleration:
    #     m/s² -> g
    #
    # Gyroscope:
    #     rad/s -> deg/s
    # ========================================================

    df["ax_g"] = (
        df["ax"] / 9.80665
    )

    df["ay_g"] = (
        df["ay"] / 9.80665
    )

    df["az_g"] = (
        df["az"] / 9.80665
    )

    df["gx_dps"] = (
        df["gx"] * 180.0 / math.pi
    )

    df["gy_dps"] = (
        df["gy"] * 180.0 / math.pi
    )

    df["gz_dps"] = (
        df["gz"] * 180.0 / math.pi
    )

    # ========================================================
    # MAGNITUDES
    # ========================================================

    df["acc_mag_g"] = np.sqrt(
        df["ax_g"] ** 2 +
        df["ay_g"] ** 2 +
        df["az_g"] ** 2
    )

    df["gyro_mag_dps"] = np.sqrt(
        df["gx_dps"] ** 2 +
        df["gy_dps"] ** 2 +
        df["gz_dps"] ** 2
    )

    # ========================================================
    # METADATA
    # ========================================================

    filename = os.path.basename(filepath)

    df["activity"] = activity
    df["split"] = split
    df["label"] = label
    df["trial"] = os.path.splitext(filename)[0]
    df["source_file"] = relative

    # ========================================================
    # FINAL CANONICAL FORMAT
    # ========================================================

    df = df[
        [
            "timestamp",
            "ax_g",
            "ay_g",
            "az_g",
            "gx_dps",
            "gy_dps",
            "gz_dps",
            "acc_mag_g",
            "gyro_mag_dps",
            "activity",
            "split",
            "label",
            "trial",
            "source_file"
        ]
    ]

    converted_data.append(df)

    # ========================================================
    # COUNTS
    # ========================================================

    activity_counts[activity] = (
        activity_counts.get(activity, 0) + 1
    )

    label_counts[label] = (
        label_counts.get(label, 0) + 1
    )

    split_counts[split] = (
        split_counts.get(split, 0) + 1
    )

    status = "OK"

    if invalid_rows > 0:
        status = f"OK_WITH_{invalid_rows}_INVALID_ROWS"

    file_status.append(
        (relative, status)
    )

    # --------------------------------------------------------
    # PROGRESS
    # --------------------------------------------------------

    if index % 25 == 0:

        print(
            f"Processed "
            f"{index}/{len(all_files)} files..."
        )

# ============================================================
# COMBINE
# ============================================================

if not converted_data:

    print("\nERROR: No usable data.")
    raise SystemExit

print("\nCombining data...")

combined = pd.concat(
    converted_data,
    ignore_index=True
)

# ============================================================
# SAVE NORMALIZED DATA
# ============================================================

output_file = os.path.join(
    OUTPUT_DIR,
    "mpu_normalized.csv"
)

combined.to_csv(
    output_file,
    index=False
)

# ============================================================
# SAVE FILE STATUS
# ============================================================

status_file = os.path.join(
    OUTPUT_DIR,
    "file_status.csv"
)

status_df = pd.DataFrame(
    file_status,
    columns=[
        "source_file",
        "status"
    ]
)

status_df.to_csv(
    status_file,
    index=False
)

# ============================================================
# SAVE BAD ROW REPORT
# ============================================================

bad_row_file = os.path.join(
    OUTPUT_DIR,
    "bad_rows.csv"
)

if bad_rows:

    bad_df = pd.DataFrame(
        bad_rows,
        columns=[
            "source_file",
            "invalid_rows",
            "reason"
        ]
    )

    bad_df.to_csv(
        bad_row_file,
        index=False
    )

# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("DATASET SUMMARY")
print("=" * 70)

print(
    f"\nCSV files found       : "
    f"{len(all_files):,}"
)

print(
    f"Files processed       : "
    f"{len(activity_counts) if False else sum(activity_counts.values()):,}"
)

print(
    f"Total sensor rows     : "
    f"{len(combined):,}"
)

print(
    f"Files with bad rows   : "
    f"{len(bad_rows):,}"
)

print("\nRecordings by activity:")

for activity in sorted(activity_counts):

    print(
        f"  {activity:<22}"
        f"{activity_counts[activity]:>6}"
    )

print("\nRecordings by label:")

for label in sorted(label_counts):

    print(
        f"  {label:<22}"
        f"{label_counts[label]:>6}"
    )

print("\nRecordings by split:")

for split in sorted(split_counts):

    print(
        f"  {split:<22}"
        f"{split_counts[split]:>6}"
    )

# ============================================================
# SAMPLING
# ============================================================

if sampling_intervals:

    median_interval = np.median(
        sampling_intervals
    )

    estimated_hz = (
        1000.0 / median_interval
    )

    print("\nSampling information:")

    print(
        f"Median interval : "
        f"{median_interval:.2f} ms"
    )

    print(
        f"Estimated rate  : "
        f"{estimated_hz:.2f} Hz"
    )

# ============================================================
# SENSOR STATISTICS
# ============================================================

print("\nAcceleration magnitude:")

print(
    combined["acc_mag_g"].describe()
)

print("\nGyroscope magnitude:")

print(
    combined["gyro_mag_dps"].describe()
)

# ============================================================
# FILE STATUS SUMMARY
# ============================================================

status_counts = (
    status_df["status"]
    .value_counts()
)

print("\nFile status:")

for status, count in status_counts.items():

    print(
        f"  {status:<35}"
        f"{count:>6}"
    )

# ============================================================
# OUTPUT
# ============================================================

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)

print("\nNormalized dataset:")
print(output_file)

print("\nFile status report:")
print(status_file)

if bad_rows:
    print("\nBad-row report:")
    print(bad_row_file)

print("\nCanonical format:")
print(
    "ax_g ay_g az_g "
    "gx_dps gy_dps gz_dps"
)