from pathlib import Path
import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

DATASET_PATH = Path("../SisFall_dataset")
OUTPUT_PATH = Path("../results/sisfall_raw.csv")


# ============================================================
# SENSOR COLUMN NAMES
# ============================================================

# SisFall format:
#
# 1  2  3  -> ADXL345 accelerometer
# 4  5  6  -> ITG3200 gyroscope
# 7  8  9  -> MMA8451Q accelerometer
#
# For Guardian 360 we initially use:
# ADXL345 + ITG3200
#
# Therefore:
#
# ax = column 1
# ay = column 2
# az = column 3
# gx = column 4
# gy = column 5
# gz = column 6


COLUMNS = [
    "ax",
    "ay",
    "az",
    "gx",
    "gy",
    "gz",
    "mma_ax",
    "mma_ay",
    "mma_az"
]


# ============================================================
# ACTIVITY LABELS
# ============================================================

ADL_CODES = {f"D{i:02d}" for i in range(1, 20)}
FALL_CODES = {f"F{i:02d}" for i in range(1, 16)}


# ============================================================
# STORAGE
# ============================================================

all_data = []

total_files = 0
successful_files = 0
failed_files = 0


# ============================================================
# PROCESS DATASET
# ============================================================

print("=" * 70)
print("              SISFALL DATASET CONVERSION")
print("=" * 70)

print("\nDataset:", DATASET_PATH.absolute())
print("Output :", OUTPUT_PATH.absolute())


# Find all real data files
files = sorted(
    file for file in DATASET_PATH.rglob("*.txt")
    if not file.name.startswith("._")
    and file.name.lower() not in ["readme.txt", "readme"]
)

print("\nData files found:", len(files))


# ============================================================
# READ EACH FILE
# ============================================================

for index, file in enumerate(files, start=1):

    total_files += 1

    try:

        # ----------------------------------------------------
        # Extract filename information
        # ----------------------------------------------------

        filename = file.stem

        # Example:
        # D01_SA01_R01
        #
        # Split:
        # D01
        # SA01
        # R01

        parts = filename.split("_")

        if len(parts) != 3:
            print(f"Skipping unexpected filename: {file.name}")
            failed_files += 1
            continue

        activity_code = parts[0]
        subject_id = parts[1]
        trial_id = parts[2]

        # ----------------------------------------------------
        # Determine label
        # ----------------------------------------------------

        if activity_code in FALL_CODES:
            label = "FALL"

        elif activity_code in ADL_CODES:
            label = "NORMAL"

        else:
            print(f"Unknown activity code: {activity_code}")
            failed_files += 1
            continue

        # ----------------------------------------------------
        # Read sensor data
        # ----------------------------------------------------

        df = pd.read_csv(
            file,
            header=None,
            names=COLUMNS,
            sep=",",
            engine="python"
        )

        # ----------------------------------------------------
        # Clean whitespace
        # ----------------------------------------------------

        for column in COLUMNS:
            df[column] = pd.to_numeric(
                df[column].astype(str).str.strip().str.rstrip(";"),
                errors="coerce"
            )

        # Remove invalid rows
        df = df.dropna()

        if len(df) == 0:
            print(f"Empty/invalid file: {file.name}")
            failed_files += 1
            continue

        # ----------------------------------------------------
        # Add metadata
        # ----------------------------------------------------

        df["activity"] = activity_code
        df["subject"] = subject_id
        df["trial"] = trial_id
        df["label"] = label

        # ----------------------------------------------------
        # Keep source information
        # ----------------------------------------------------

        df["source_file"] = file.name

        all_data.append(df)

        successful_files += 1

        # Progress
        if index % 100 == 0:
            print(
                f"Processed {index}/{len(files)} files..."
            )

    except Exception as e:

        print(f"\nERROR processing {file.name}")
        print("Reason:", e)

        failed_files += 1


# ============================================================
# COMBINE DATA
# ============================================================

print("\n" + "=" * 70)
print("Combining data...")
print("=" * 70)

if not all_data:

    print("\n❌ No data was successfully processed.")
    raise SystemExit


combined = pd.concat(
    all_data,
    ignore_index=True
)


# ============================================================
# SAVE
# ============================================================

OUTPUT_PATH.parent.mkdir(
    parents=True,
    exist_ok=True
)

combined.to_csv(
    OUTPUT_PATH,
    index=False
)


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("              CONVERSION COMPLETE")
print("=" * 70)

print("\nFiles found       :", total_files)
print("Files processed   :", successful_files)
print("Files failed      :", failed_files)

print("\nTotal sensor rows :", len(combined))

print("\nColumns:")

for column in combined.columns:
    print(" ", column)


# ============================================================
# LABEL SUMMARY
# ============================================================

print("\n" + "-" * 70)
print("LABEL DISTRIBUTION")
print("-" * 70)

print(
    combined["label"].value_counts()
)


# ============================================================
# ACTIVITY SUMMARY
# ============================================================

print("\n" + "-" * 70)
print("ACTIVITY DISTRIBUTION")
print("-" * 70)

print(
    combined["activity"].value_counts().sort_index()
)


# ============================================================
# SUBJECT SUMMARY
# ============================================================

print("\n" + "-" * 70)
print("SUBJECTS")
print("-" * 70)

print(
    combined["subject"].unique()
)


# ============================================================
# SAMPLE
# ============================================================

print("\n" + "-" * 70)
print("FIRST 5 ROWS")
print("-" * 70)

print(
    combined.head().to_string(index=False)
)

print("\nSaved to:")
print(OUTPUT_PATH.absolute())

print("\nNext phase:")
print("Convert raw values → physical units")
print("and create fixed-size ML windows.")