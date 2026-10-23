import os
import random
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = r"D:\Guardian360"
WINDOW_DIR = os.path.join(BASE_DIR, "results", "windows")
OUTPUT_DIR = os.path.join(BASE_DIR, "results", "window_analysis")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Number of examples to plot from each class
N_EXAMPLES = 6

# Reproducible random selection
RANDOM_SEED = 42

CHANNELS = [
    "ax_g",
    "ay_g",
    "az_g",
    "gx_dps",
    "gy_dps",
    "gz_dps"
]


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("GUARDIAN 360 - WINDOW ANALYSIS")
print("=" * 70)

print("\nLoading datasets...")

X_train = np.load(
    os.path.join(WINDOW_DIR, "X_train.npz")
)["X"]

y_train = np.load(
    os.path.join(WINDOW_DIR, "y_train.npz")
)["y"]

X_test = np.load(
    os.path.join(WINDOW_DIR, "X_test.npz")
)["X"]

y_test = np.load(
    os.path.join(WINDOW_DIR, "y_test.npz")
)["y"]

metadata = pd.read_csv(
    os.path.join(WINDOW_DIR, "window_metadata.csv")
)

print("\nLoaded:")
print("X_train:", X_train.shape)
print("y_train:", y_train.shape)
print("X_test :", X_test.shape)
print("y_test :", y_test.shape)
print("Metadata:", metadata.shape)


# ============================================================
# CHECK LABELS
# ============================================================

print("\n" + "=" * 70)
print("LABEL DISTRIBUTION")
print("=" * 70)

print("\nTRAIN")
print(pd.Series(y_train).value_counts().sort_index())

print("\nTEST")
print(pd.Series(y_test).value_counts().sort_index())

print("\nMetadata columns:")
print(list(metadata.columns))


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_magnitudes(X):
    """
    X shape:
        (windows, samples, 6)

    Channels:
        ax, ay, az, gx, gy, gz

    Returns:
        acceleration magnitude
        gyro magnitude
    """

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

    return acc_mag, gyro_mag


def calculate_features(X):
    """
    Calculate simple diagnostic features for every window.
    """

    acc_mag, gyro_mag = calculate_magnitudes(X)

    features = pd.DataFrame({
        "acc_mean": np.mean(acc_mag, axis=1),
        "acc_std": np.std(acc_mag, axis=1),
        "acc_min": np.min(acc_mag, axis=1),
        "acc_max": np.max(acc_mag, axis=1),

        "gyro_mean": np.mean(gyro_mag, axis=1),
        "gyro_std": np.std(gyro_mag, axis=1),
        "gyro_min": np.min(gyro_mag, axis=1),
        "gyro_max": np.max(gyro_mag, axis=1),
    })

    return features


# ============================================================
# FEATURE ANALYSIS
# ============================================================

print("\n" + "=" * 70)
print("WINDOW FEATURE ANALYSIS")
print("=" * 70)

test_features = calculate_features(X_test)
test_features["label"] = y_test

print("\nNORMAL windows:")
print(
    test_features[test_features["label"] == 0]
    .drop(columns=["label"])
    .describe()
    .round(3)
)

print("\nFALL windows:")
print(
    test_features[test_features["label"] == 1]
    .drop(columns=["label"])
    .describe()
    .round(3)
)


# ============================================================
# COMPARE CLASS AVERAGES
# ============================================================

print("\n" + "=" * 70)
print("NORMAL vs FALL")
print("=" * 70)

normal = test_features[test_features["label"] == 0]
fall = test_features[test_features["label"] == 1]

comparison = pd.DataFrame({
    "NORMAL": normal.drop(columns=["label"]).mean(),
    "FALL": fall.drop(columns=["label"]).mean()
})

comparison["Difference"] = (
    comparison["FALL"] - comparison["NORMAL"]
)

print("\n")
print(comparison.round(3))

comparison.to_csv(
    os.path.join(OUTPUT_DIR, "normal_vs_fall_features.csv")
)


# ============================================================
# RANDOM WINDOW PLOTS
# ============================================================

random.seed(RANDOM_SEED)

normal_indices = np.where(y_test == 0)[0].tolist()
fall_indices = np.where(y_test == 1)[0].tolist()

selected_normal = random.sample(
    normal_indices,
    min(N_EXAMPLES, len(normal_indices))
)

selected_fall = random.sample(
    fall_indices,
    min(N_EXAMPLES, len(fall_indices))
)


# ------------------------------------------------------------
# Plot individual windows
# ------------------------------------------------------------

def plot_window(X, index, label, number):

    acc_mag = np.sqrt(
        X[index, :, 0] ** 2 +
        X[index, :, 1] ** 2 +
        X[index, :, 2] ** 2
    )

    gyro_mag = np.sqrt(
        X[index, :, 3] ** 2 +
        X[index, :, 4] ** 2 +
        X[index, :, 5] ** 2
    )

    # 100 Hz -> 0.01 sec/sample
    time = np.arange(X.shape[1]) / 100.0

    label_name = "FALL" if label == 1 else "NORMAL"

    # --------------------------------------------------------
    # Acceleration magnitude
    # --------------------------------------------------------

    plt.figure(figsize=(10, 5))

    plt.plot(time, acc_mag)

    plt.axhline(
        1.0,
        linestyle="--",
        linewidth=1
    )

    plt.title(
        f"{label_name} Window #{index} - Acceleration Magnitude"
    )

    plt.xlabel("Time (seconds)")
    plt.ylabel("Acceleration Magnitude (g)")
    plt.grid(True)

    filename = os.path.join(
        OUTPUT_DIR,
        f"{label_name}_{number}_acceleration.png"
    )

    plt.savefig(filename, dpi=150, bbox_inches="tight")
    plt.close()

    # --------------------------------------------------------
    # Gyroscope magnitude
    # --------------------------------------------------------

    plt.figure(figsize=(10, 5))

    plt.plot(time, gyro_mag)

    plt.title(
        f"{label_name} Window #{index} - Gyroscope Magnitude"
    )

    plt.xlabel("Time (seconds)")
    plt.ylabel("Gyroscope Magnitude (deg/s)")
    plt.grid(True)

    filename = os.path.join(
        OUTPUT_DIR,
        f"{label_name}_{number}_gyro.png"
    )

    plt.savefig(filename, dpi=150, bbox_inches="tight")
    plt.close()


# Generate plots

print("\nCreating individual plots...")

for i, index in enumerate(selected_normal, start=1):
    plot_window(X_test, index, 0, i)

for i, index in enumerate(selected_fall, start=1):
    plot_window(X_test, index, 1, i)

print("Plots saved to:")
print(OUTPUT_DIR)


# ============================================================
# CLASS AVERAGE SIGNAL
# ============================================================

print("\nCreating class-average plots...")

X_normal = X_test[y_test == 0]
X_fall = X_test[y_test == 1]

normal_acc, normal_gyro = calculate_magnitudes(X_normal)
fall_acc, fall_gyro = calculate_magnitudes(X_fall)

time = np.arange(X_test.shape[1]) / 100.0


# ------------------------------------------------------------
# Average acceleration magnitude
# ------------------------------------------------------------

plt.figure(figsize=(10, 5))

plt.plot(
    time,
    np.mean(normal_acc, axis=0),
    label="NORMAL"
)

plt.plot(
    time,
    np.mean(fall_acc, axis=0),
    label="FALL"
)

plt.title("Average Acceleration Magnitude")
plt.xlabel("Time (seconds)")
plt.ylabel("Acceleration Magnitude (g)")
plt.legend()
plt.grid(True)

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "average_acceleration_normal_vs_fall.png"
    ),
    dpi=150,
    bbox_inches="tight"
)

plt.close()


# ------------------------------------------------------------
# Average gyro magnitude
# ------------------------------------------------------------

plt.figure(figsize=(10, 5))

plt.plot(
    time,
    np.mean(normal_gyro, axis=0),
    label="NORMAL"
)

plt.plot(
    time,
    np.mean(fall_gyro, axis=0),
    label="FALL"
)

plt.title("Average Gyroscope Magnitude")
plt.xlabel("Time (seconds)")
plt.ylabel("Gyroscope Magnitude (deg/s)")
plt.legend()
plt.grid(True)

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "average_gyro_normal_vs_fall.png"
    ),
    dpi=150,
    bbox_inches="tight"
)

plt.close()


# ============================================================
# FIND STRONGEST FALL WINDOWS
# ============================================================

print("\n" + "=" * 70)
print("STRONGEST FALL WINDOWS")
print("=" * 70)

fall_features = test_features[
    test_features["label"] == 1
].copy()

fall_features["index"] = fall_features.index

print("\nTop 10 by maximum acceleration:")
print(
    fall_features
    .sort_values("acc_max", ascending=False)
    [["index", "acc_max", "acc_std", "gyro_max"]]
    .head(10)
    .round(3)
    .to_string(index=False)
)

print("\nTop 10 by maximum gyro:")
print(
    fall_features
    .sort_values("gyro_max", ascending=False)
    [["index", "acc_max", "acc_std", "gyro_max"]]
    .head(10)
    .round(3)
    .to_string(index=False)
)


# ============================================================
# SAVE FEATURE DATA
# ============================================================

test_features.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "test_window_features.csv"
    ),
    index=False
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("ANALYSIS COMPLETE")
print("=" * 70)

print(f"""
Results saved in:

{OUTPUT_DIR}

Generated files include:

- NORMAL_*_acceleration.png
- NORMAL_*_gyro.png
- FALL_*_acceleration.png
- FALL_*_gyro.png
- average_acceleration_normal_vs_fall.png
- average_gyro_normal_vs_fall.png
- normal_vs_fall_features.csv
- test_window_features.csv

IMPORTANT:
Do NOT train the final model yet.

First inspect the FALL plots and check whether the FALL-labeled
windows actually contain recognizable impact/fall behavior.
""")