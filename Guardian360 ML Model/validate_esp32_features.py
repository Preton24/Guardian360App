import numpy as np

# ============================================================
# ESP32 RAW WINDOW
# 20 samples × 6 channels
#
# Order:
# ax, ay, az, gx, gy, gz
# ============================================================

raw = [
    -0.088623,0.983643,0.085937,2.244275,10.396947,-0.534351,
    -0.089600,0.981689,0.089600,2.427481,10.320611,-0.503817,
    -0.087402,0.981934,0.087646,2.229008,10.290076,-0.458015,
    -0.089355,0.982422,0.084961,2.320611,10.366412,-0.458015,
    -0.087402,0.984863,0.089844,2.442748,10.244275,-0.396947,
    -0.088867,0.985352,0.084473,2.259542,10.167939,-0.442748,
    -0.088867,0.985107,0.078125,2.259542,10.290076,-0.549618,
    -0.086426,0.985107,0.078125,2.351145,10.335877,-0.564885,
    -0.087646,0.985596,0.081055,2.290076,10.366412,-0.519084,
    -0.087158,0.985107,0.090576,2.351145,10.274809,-0.366412,
    -0.082764,0.984131,0.083984,2.351145,10.396947,-0.473282,
    -0.082764,0.985840,0.084961,2.366412,10.259542,-0.488550,
    -0.087646,0.984131,0.087402,2.381679,10.229008,-0.503817,
    -0.087891,0.981934,0.089111,2.381679,10.274809,-0.595420,
    -0.086914,0.989014,0.083008,2.396947,10.229008,-0.396947,
    -0.086182,0.985596,0.083252,2.335878,10.351145,-0.488550,
    -0.086426,0.981689,0.086426,2.564885,10.351145,-0.442748,
    -0.088379,0.984619,0.086426,2.351145,10.351145,-0.549618,
    -0.087891,0.984619,0.092285,2.290076,10.351145,-0.564885,
    -0.086182,0.984131,0.078857,2.396947,10.335877,-0.167939
]

X = np.array(raw, dtype=np.float64).reshape(20, 6)

# ============================================================
# SAMPLING RATE
# ============================================================

FS = 9.900990099
DT = 1.0 / FS

# ============================================================
# SAME 104-FEATURE REPRESENTATION USED BY COMBINED RF
# ============================================================

def extract_features(X, fs=FS):

    n = len(X)
    features = []

    # --------------------------------------------------------
    # Acceleration and gyro magnitude
    # --------------------------------------------------------

    acc_mag = np.sqrt(
        X[:, 0]**2 +
        X[:, 1]**2 +
        X[:, 2]**2
    )

    gyro_mag = np.sqrt(
        X[:, 3]**2 +
        X[:, 4]**2 +
        X[:, 5]**2
    )

    # --------------------------------------------------------
    # 0-53: six channels × nine statistics
    # --------------------------------------------------------

    for channel in range(6):

        data = X[:, channel]

        features.extend([
            np.mean(data),
            np.std(data),
            np.min(data),
            np.max(data),
            np.ptp(data),
            np.sqrt(np.mean(data ** 2)),
            np.percentile(data, 25),
            np.percentile(data, 50),
            np.percentile(data, 75)
        ])

    # --------------------------------------------------------
    # 54-65: acceleration magnitude
    # --------------------------------------------------------

    features.extend([
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

    # --------------------------------------------------------
    # 66-77: gyro magnitude
    # --------------------------------------------------------

    features.extend([
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

    # --------------------------------------------------------
    # 78-85: acceleration threshold fractions
    # --------------------------------------------------------

    features.extend([
        np.mean(acc_mag < 0.5),
        np.mean(acc_mag < 0.7),
        np.mean(acc_mag < 0.8),
        np.mean(acc_mag > 1.5),
        np.mean(acc_mag > 2.0),
        np.mean(acc_mag > 3.0),
        np.mean(acc_mag > 4.0),
        np.mean(acc_mag > 5.0)
    ])

    # --------------------------------------------------------
    # 86-90: gyro threshold fractions
    # --------------------------------------------------------

    features.extend([
        np.mean(gyro_mag > 30),
        np.mean(gyro_mag > 60),
        np.mean(gyro_mag > 100),
        np.mean(gyro_mag > 150),
        np.mean(gyro_mag > 200)
    ])

    # --------------------------------------------------------
    # 91-94: sampling-rate-aware jerk
    # --------------------------------------------------------

    jerk = np.diff(acc_mag) / (1.0 / fs)

    features.extend([
        np.mean(np.abs(jerk)),
        np.std(jerk),
        np.max(np.abs(jerk)),
        np.percentile(np.abs(jerk), 95)
    ])

    # --------------------------------------------------------
    # 95-97: peak positions
    # --------------------------------------------------------

    acc_peak_idx = np.argmax(acc_mag)
    gyro_peak_idx = np.argmax(gyro_mag)

    features.extend([
        acc_peak_idx / n,
        gyro_peak_idx / n,
        abs(acc_peak_idx - gyro_peak_idx) / n
    ])

    # --------------------------------------------------------
    # 98-103: 0.5-second before/after acceleration peak
    # --------------------------------------------------------

    half_second_samples = max(
        1,
        int(round(0.5 * fs))
    )

    start_before = max(
        0,
        acc_peak_idx - half_second_samples
    )

    end_after = min(
        n,
        acc_peak_idx + half_second_samples + 1
    )

    before = acc_mag[
        start_before:acc_peak_idx
    ]

    after = acc_mag[
        acc_peak_idx + 1:end_after
    ]

    if len(before) == 0:
        before = acc_mag

    if len(after) == 0:
        after = acc_mag

    features.extend([
        np.mean(before),
        np.min(before),
        np.std(before),
        np.mean(after),
        np.min(after),
        np.std(after)
    ])

    return np.array(features, dtype=np.float64)


# ============================================================
# FEATURES REPORTED BY ESP32
# ============================================================

esp32_features = np.array([
    -0.08721924,0.00178218,-0.08959961,-0.08276367,0.00683594,
    0.08723745,-0.08843994,-0.08752441,-0.08642578,

    0.98432618,0.00173769,0.98168945,0.98901367,0.00732422,
    0.98432773,0.98333740,0.98461914,0.98516846,

    0.08530273,0.00398585,0.07812500,0.09228516,0.01416016,
    0.08539581,0.08319092,0.08544922,0.08801270,

    2.34961843,0.07677733,2.22900772,2.56488538,0.33587766,
    2.35087228,2.29007626,2.35114503,2.38549614,

    10.30916119,0.06046936,10.16793919,10.39694691,0.22900772,
    10.30933762,10.27099228,10.32824421,10.35114479,

    -0.47328243,0.09223699,-0.59541982,-0.16793893,0.42748088,
    0.48218665,-0.53816795,-0.48854962,-0.44274810,

    0.99186754,0.00160283,0.98926896,0.99628931,0.00702035,
    0.99186885,0.98982054,0.99081188,0.99208045,
    0.99283755,0.99296492,0.99325454,

    10.58479118,0.06132299,10.42537975,10.67337227,0.24799252,
    10.58496857,10.51458454,10.53992558,10.61285591,
    10.62902737,10.65184116,10.67014599,

    0.00000000,0.00000000,0.00000000,
    0.00000000,0.00000000,0.00000000,
    0.00000000,0.00000000,

    0.00000000,0.00000000,0.00000000,
    0.00000000,0.00000000,

    0.01696962,0.02292126,0.06347482,0.03828437,

    0.69999999,0.80000001,0.10000000,

    0.99179518,0.98987836,0.00119120,
    0.99166840,0.98926896,0.00136918
], dtype=np.float64)


# ============================================================
# RUN COMPARISON
# ============================================================

python_features = extract_features(X)

print("=" * 70)
print("GUARDIAN 360 - ESP32 / PYTHON FEATURE VALIDATION")
print("=" * 70)

print()
print("Raw window shape:")
print("Expected: (20, 6)")
print("Actual:  ", X.shape)

print()
print("Feature count:")
print("ESP32 : ", len(esp32_features))
print("Python: ", len(python_features))

if len(esp32_features) != 104:
    raise RuntimeError("ESP32 vector must contain exactly 104 features.")

if len(python_features) != 104:
    raise RuntimeError("Python vector must contain exactly 104 features.")

# Absolute differences
difference = np.abs(
    esp32_features - python_features
)

max_difference = np.max(difference)
mean_difference = np.mean(difference)

# Float32 arithmetic on ESP32 can introduce tiny differences.
tolerance = 1e-4

mismatch_indices = np.where(
    difference > tolerance
)[0]

print()
print("Maximum absolute difference:")
print(f"{max_difference:.10f}")

print()
print("Mean absolute difference:")
print(f"{mean_difference:.10f}")

print()
print("Tolerance:")
print(tolerance)

print()
print("Number of mismatches:")
print(len(mismatch_indices))


# ============================================================
# DETAILED RESULTS
# ============================================================

print()
print("=" * 70)
print("FEATURE-BY-FEATURE COMPARISON")
print("=" * 70)

for i in range(104):

    print(
        f"{i:3d} | "
        f"ESP32 = {esp32_features[i]: .10f} | "
        f"Python = {python_features[i]: .10f} | "
        f"Difference = {difference[i]:.10f}"
    )


# ============================================================
# FINAL RESULT
# ============================================================

print()
print("=" * 70)

if len(mismatch_indices) == 0:

    print("RESULT: PASS")
    print()
    print(
        "All 104 ESP32 features agree with the Python "
        "implementation within the selected tolerance."
    )

else:

    print("RESULT: CHECK REQUIRED")
    print()
    print("Features exceeding the tolerance:")

    for i in mismatch_indices:

        print(
            f"Feature {i}: "
            f"ESP32={esp32_features[i]:.10f}, "
            f"Python={python_features[i]:.10f}, "
            f"Difference={difference[i]:.10f}"
        )

print("=" * 70)