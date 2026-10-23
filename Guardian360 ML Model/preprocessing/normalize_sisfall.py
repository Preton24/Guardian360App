from pathlib import Path
import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

INPUT_PATH = Path("../results/sisfall_raw.csv")
OUTPUT_PATH = Path("../results/sisfall_normalized.csv")


# ============================================================
# SISFALL SENSOR SCALE FACTORS
# ============================================================

# ADXL345
# Resolution = 13 bits
# Range = +/-16 g
#
# g/bit = (2 * 16) / (2^13)

ADXL345_SCALE = (2 * 16) / (2 ** 13)


# ITG3200
# Resolution = 16 bits
# Range = +/-2000 deg/s
#
# deg/s per bit = (2 * 2000) / (2^16)

ITG3200_SCALE = (2 * 2000) / (2 ** 16)


# ============================================================
# CHECK INPUT
# ============================================================

print("=" * 70)
print("          SISFALL SENSOR NORMALIZATION")
print("=" * 70)

print("\nInput :", INPUT_PATH.absolute())
print("Output:", OUTPUT_PATH.absolute())

if not INPUT_PATH.exists():
    print("\n❌ Input file not found!")
    raise SystemExit


# ============================================================
# DISPLAY SCALE FACTORS
# ============================================================

print("\nScale factors:")
print(f"ADXL345 : {ADXL345_SCALE:.10f} g/bit")
print(f"ITG3200 : {ITG3200_SCALE:.10f} deg/s per bit")


# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading dataset...")

df = pd.read_csv(INPUT_PATH)

print(f"Rows loaded: {len(df):,}")


# ============================================================
# CONVERT ACCELEROMETER
# ============================================================

print("\nConverting ADXL345 acceleration...")

df["ax_g"] = df["ax"] * ADXL345_SCALE
df["ay_g"] = df["ay"] * ADXL345_SCALE
df["az_g"] = df["az"] * ADXL345_SCALE


# ============================================================
# CONVERT GYROSCOPE
# ============================================================

print("Converting ITG3200 gyroscope...")

df["gx_dps"] = df["gx"] * ITG3200_SCALE
df["gy_dps"] = df["gy"] * ITG3200_SCALE
df["gz_dps"] = df["gz"] * ITG3200_SCALE


# ============================================================
# CALCULATE MAGNITUDES
# ============================================================

print("Calculating sensor magnitudes...")

df["acc_mag_g"] = (
    df["ax_g"] ** 2
    + df["ay_g"] ** 2
    + df["az_g"] ** 2
) ** 0.5


df["gyro_mag_dps"] = (
    df["gx_dps"] ** 2
    + df["gy_dps"] ** 2
    + df["gz_dps"] ** 2
) ** 0.5


# ============================================================
# SELECT FINAL COLUMNS
# ============================================================

columns = [
    "ax_g",
    "ay_g",
    "az_g",

    "gx_dps",
    "gy_dps",
    "gz_dps",

    "acc_mag_g",
    "gyro_mag_dps",

    "activity",
    "subject",
    "trial",
    "label",
    "source_file"
]

normalized = df[columns].copy()


# ============================================================
# SAVE
# ============================================================

OUTPUT_PATH.parent.mkdir(
    parents=True,
    exist_ok=True
)

normalized.to_csv(
    OUTPUT_PATH,
    index=False
)


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("              NORMALIZATION COMPLETE")
print("=" * 70)

print(f"\nRows              : {len(normalized):,}")
print(f"Columns           : {len(normalized.columns)}")

print("\nOutput columns:")

for column in normalized.columns:
    print(" ", column)


# ============================================================
# LABEL DISTRIBUTION
# ============================================================

print("\n" + "-" * 70)
print("LABEL DISTRIBUTION")
print("-" * 70)

print(
    normalized["label"].value_counts()
)


# ============================================================
# SENSOR STATISTICS
# ============================================================

print("\n" + "-" * 70)
print("SENSOR STATISTICS")
print("-" * 70)

print(
    normalized[
        [
            "ax_g",
            "ay_g",
            "az_g",
            "gx_dps",
            "gy_dps",
            "gz_dps",
            "acc_mag_g",
            "gyro_mag_dps"
        ]
    ].describe().round(3)
)


# ============================================================
# SAMPLE
# ============================================================

print("\n" + "-" * 70)
print("FIRST 5 NORMALIZED ROWS")
print("-" * 70)

print(
    normalized.head().to_string(index=False)
)


print("\nSaved to:")
print(OUTPUT_PATH.absolute())

print("\nNext:")
print("Create fixed-length windows for machine learning.")