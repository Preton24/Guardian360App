import os
import random
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = r"D:\Guardian360"
WINDOW_DIR = os.path.join(
    BASE_DIR,
    "results",
    "windows_v2"
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "window_analysis_v2"
)

os.makedirs(OUTPUT_DIR, exist_ok=True)

FS = 100
RANDOM_SEED = 42

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


# ============================================================
# LOAD TEST DATA
# ============================================================

print("=" * 70)
print("GUARDIAN 360 - V2 WINDOW ANALYSIS")
print("=" * 70)

X = np.load(
    os.path.join(WINDOW_DIR, "X_test.npz")
)["X"]

y = np.load(
    os.path.join(WINDOW_DIR, "y_test.npz")
)["y"]

metadata = pd.read_csv(
    os.path.join(WINDOW_DIR, "window_metadata.csv")
)

print("\nLoaded:")
print("X:", X.shape)
print("y:", y.shape)
print("metadata:", metadata.shape)


# ============================================================
# IMPORTANT:
# Metadata contains train + validation + test rows.
# Select only TEST metadata.
# ============================================================

if "split" in metadata.columns:

    test_metadata = metadata[
        metadata["split"] == "test"
    ].reset_index(drop=True)

else:

    test_metadata = metadata.copy()


print(
    "\nTest metadata:",
    test_metadata.shape
)


# ============================================================
# MAGNITUDES
# ============================================================

acc_mag = np.sqrt(
    X[:, :, 0] ** 2 +
    X[:, :, 1] ** 2 +
    X[:, :, 2] ** 2
)

gyro_mag = np.sqrt(
    X[:, :, 3] ** 2 +
    X[:, :, 4] ** 2 +
    X[:, :, 5] ** 2
)


# ============================================================
# FEATURE SUMMARY
# ============================================================

features = pd.DataFrame({

    "acc_mean": np.mean(acc_mag, axis=1),

    "acc_std": np.std(acc_mag, axis=1),

    "acc_min": np.min(acc_mag, axis=1),

    "acc_max": np.max(acc_mag, axis=1),

    "gyro_mean": np.mean(gyro_mag, axis=1),

    "gyro_std": np.std(gyro_mag, axis=1),

    "gyro_max": np.max(gyro_mag, axis=1),

    "acc_below_07g": np.mean(
        acc_mag < 0.7,
        axis=1
    ),

    "acc_above_2g": np.mean(
        acc_mag > 2.0,
        axis=1
    ),

    "label": y
})


print("\n" + "=" * 70)
print("FEATURE COMPARISON")
print("=" * 70)

print("\nNORMAL:")
print(
    features[
        features["label"] == 0
    ]
    .drop(columns="label")
    .describe()
    .round(3)
)

print("\nFALL:")
print(
    features[
        features["label"] == 1
    ]
    .drop(columns="label")
    .describe()
    .round(3)
)


# ============================================================
# RANDOM EXAMPLES
# ============================================================

normal_indices = np.where(y == 0)[0]
fall_indices = np.where(y == 1)[0]

normal_selected = random.sample(
    list(normal_indices),
    min(4, len(normal_indices))
)

fall_selected = random.sample(
    list(fall_indices),
    min(6, len(fall_indices))
)


# ============================================================
# PLOT FUNCTION
# ============================================================

def plot_window(index):

    label = int(y[index])

    if label == 1:
        name = "FALL"
    else:
        name = "NORMAL"

    time = np.arange(
        X.shape[1]
    ) / FS

    # --------------------------------------------------------
    # ACCELERATION
    # --------------------------------------------------------

    plt.figure(figsize=(10, 5))

    plt.plot(
        time,
        acc_mag[index]
    )

    plt.axhline(
        1.0,
        linestyle="--",
        linewidth=1
    )

    plt.axhline(
        2.0,
        linestyle=":",
        linewidth=1
    )

    plt.title(
        f"V2 {name} #{index} - Acceleration"
    )

    plt.xlabel("Time (seconds)")
    plt.ylabel("Acceleration Magnitude (g)")

    plt.grid(True)

    plt.savefig(
        os.path.join(
            OUTPUT_DIR,
            f"{name}_{index}_acceleration.png"
        ),
        dpi=150,
        bbox_inches="tight"
    )

    plt.close()

    # --------------------------------------------------------
    # GYRO
    # --------------------------------------------------------

    plt.figure(figsize=(10, 5))

    plt.plot(
        time,
        gyro_mag[index]
    )

    plt.title(
        f"V2 {name} #{index} - Gyroscope"
    )

    plt.xlabel("Time (seconds)")
    plt.ylabel(
        "Gyroscope Magnitude (deg/s)"
    )

    plt.grid(True)

    plt.savefig(
        os.path.join(
            OUTPUT_DIR,
            f"{name}_{index}_gyro.png"
        ),
        dpi=150,
        bbox_inches="tight"
    )

    plt.close()


# ============================================================
# GENERATE RANDOM PLOTS
# ============================================================

print("\nCreating random FALL plots...")

for index in fall_selected:
    plot_window(index)

print("Creating random NORMAL plots...")

for index in normal_selected:
    plot_window(index)


# ============================================================
# STRONGEST FALL EVENTS
# ============================================================

fall_features = features[
    features["label"] == 1
].copy()

fall_features["index"] = fall_features.index


print("\n" + "=" * 70)
print("STRONGEST FALL WINDOWS")
print("=" * 70)

print("\nHighest acceleration:")

print(
    fall_features
    .sort_values(
        "acc_max",
        ascending=False
    )
    [
        [
            "index",
            "acc_min",
            "acc_max",
            "gyro_max",
            "acc_below_07g"
        ]
    ]
    .head(10)
    .round(3)
    .to_string(index=False)
)


print("\nHighest gyroscope:")

print(
    fall_features
    .sort_values(
        "gyro_max",
        ascending=False
    )
    [
        [
            "index",
            "acc_min",
            "acc_max",
            "gyro_max",
            "acc_below_07g"
        ]
    ]
    .head(10)
    .round(3)
    .to_string(index=False)
)


# ============================================================
# SAVE FEATURES
# ============================================================

features.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "v2_test_features.csv"
    ),
    index=False
)


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("ANALYSIS COMPLETE")
print("=" * 70)

print(
    f"""
Plots saved to:

{OUTPUT_DIR}

Look at:

FALL_*_acceleration.png
FALL_*_gyro.png

NORMAL_*_acceleration.png
NORMAL_*_gyro.png

Also check the terminal output for:

- acc_max
- acc_min
- gyro_max
- acc_below_07g
"""
)