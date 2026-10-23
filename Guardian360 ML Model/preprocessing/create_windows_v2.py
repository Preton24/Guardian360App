import os
import random
import numpy as np
import pandas as pd

from scipy.signal import resample_poly
from sklearn.model_selection import train_test_split


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = r"D:\Guardian360"

INPUT_FILE = os.path.join(
    BASE_DIR,
    "results",
    "sisfall_normalized.csv"
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "windows_v2"
)

os.makedirs(OUTPUT_DIR, exist_ok=True)


# SisFall original sampling rate
ORIGINAL_FS = 200

# Guardian 360 target sampling rate
TARGET_FS = 100

# Window length
WINDOW_SECONDS = 2

WINDOW_SIZE = TARGET_FS * WINDOW_SECONDS

# ------------------------------------------------------------
# FALL WINDOW POSITIONS
#
# We want the impact to occur inside the window, not at the
# very beginning or very end.
#
# These are offsets BEFORE the detected impact.
# ------------------------------------------------------------

FALL_START_OFFSETS = [
    0.9,
    0.5
]

# Number of NORMAL windows sampled from each ADL trial
NORMAL_WINDOWS_PER_TRIAL = 2

# Reproducibility
RANDOM_SEED = 42

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


# ============================================================
# CHANNELS
# ============================================================

CHANNELS = [
    "ax_g",
    "ay_g",
    "az_g",
    "gx_dps",
    "gy_dps",
    "gz_dps"
]


# ============================================================
# SUBJECT SPLIT
# ============================================================

# Discover subjects from the CSV.
print("=" * 70)
print("GUARDIAN 360 - EVENT CENTERED WINDOW GENERATION V2")
print("=" * 70)

print("\nReading subject information...")

subjects = set()

for chunk in pd.read_csv(
    INPUT_FILE,
    usecols=["subject"],
    chunksize=200000
):
    subjects.update(chunk["subject"].dropna().unique())

subjects = sorted(subjects)

print(f"Found {len(subjects)} subjects")

# ------------------------------------------------------------
# 70% train
# 15% validation
# 15% test
# ------------------------------------------------------------

train_subjects, temp_subjects = train_test_split(
    subjects,
    test_size=0.30,
    random_state=RANDOM_SEED
)

val_subjects, test_subjects = train_test_split(
    temp_subjects,
    test_size=0.50,
    random_state=RANDOM_SEED
)

train_subjects = sorted(train_subjects)
val_subjects = sorted(val_subjects)
test_subjects = sorted(test_subjects)

print("\nTRAIN SUBJECTS:")
print(train_subjects)

print("\nVALIDATION SUBJECTS:")
print(val_subjects)

print("\nTEST SUBJECTS:")
print(test_subjects)

print(
    f"\nSplit: "
    f"{len(train_subjects)} train / "
    f"{len(val_subjects)} validation / "
    f"{len(test_subjects)} test"
)


# ============================================================
# SAVE SUBJECT SPLITS
# ============================================================

with open(
    os.path.join(OUTPUT_DIR, "train_subjects.txt"),
    "w"
) as f:
    for subject in train_subjects:
        f.write(subject + "\n")

with open(
    os.path.join(OUTPUT_DIR, "val_subjects.txt"),
    "w"
) as f:
    for subject in val_subjects:
        f.write(subject + "\n")

with open(
    os.path.join(OUTPUT_DIR, "test_subjects.txt"),
    "w"
) as f:
    for subject in test_subjects:
        f.write(subject + "\n")


SUBJECT_TO_SPLIT = {}

for s in train_subjects:
    SUBJECT_TO_SPLIT[s] = "train"

for s in val_subjects:
    SUBJECT_TO_SPLIT[s] = "val"

for s in test_subjects:
    SUBJECT_TO_SPLIT[s] = "test"


# ============================================================
# STORAGE
# ============================================================

X_train = []
y_train = []
metadata_train = []

X_val = []
y_val = []
metadata_val = []

X_test = []
y_test = []
metadata_test = []


# ============================================================
# STATISTICS
# ============================================================

stats = {
    "trials": 0,
    "fall_trials": 0,
    "normal_trials": 0,
    "fall_events_found": 0,
    "fall_fallback_events": 0,
    "fall_windows": 0,
    "normal_windows": 0
}


# ============================================================
# HELPER: RESAMPLE
# ============================================================

def resample_trial(data):
    """
    Resample 200 Hz -> 100 Hz.

    data shape:
        (samples, 6)
    """

    if ORIGINAL_FS == TARGET_FS:
        return data

    return resample_poly(
        data,
        up=TARGET_FS,
        down=ORIGINAL_FS,
        axis=0
    )


# ============================================================
# HELPER: FIND FALL EVENT
# ============================================================

def find_fall_event(data):
    """
    Locate the most likely impact point in a FALL trial.

    Uses:
        - acceleration magnitude
        - gyro magnitude
        - possible pre-impact low acceleration

    Returns:
        impact_index
        method_used
    """

    ax = data[:, 0]
    ay = data[:, 1]
    az = data[:, 2]

    gx = data[:, 3]
    gy = data[:, 4]
    gz = data[:, 5]

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

    n = len(data)

    # --------------------------------------------------------
    # Candidate impact threshold
    # --------------------------------------------------------

    # At least 2g.
    # Also use a high percentile so the strongest event is
    # emphasized even if the exact amplitude varies.
    percentile_threshold = np.percentile(
        acc_mag,
        99
    )

    impact_threshold = max(
        2.0,
        percentile_threshold
    )

    candidates = np.where(
        acc_mag >= impact_threshold
    )[0]

    # --------------------------------------------------------
    # If there are no strong acceleration candidates,
    # use the strongest acceleration point.
    # --------------------------------------------------------

    if len(candidates) == 0:

        impact_index = int(
            np.argmax(acc_mag)
        )

        return impact_index, "acceleration_fallback"

    # --------------------------------------------------------
    # Score candidate impacts.
    #
    # We reward:
    #   1. High acceleration
    #   2. High gyro
    #   3. Low acceleration shortly BEFORE impact
    # --------------------------------------------------------

    best_score = -np.inf
    best_index = int(candidates[0])

    for idx in candidates:

        # Ignore extremely early points because we want
        # enough pre-event samples for the window.
        if idx < int(0.5 * TARGET_FS):
            continue

        # Acceleration contribution
        acc_score = min(
            acc_mag[idx] / 5.0,
            3.0
        )

        # Gyro contribution
        gyro_score = min(
            gyro_mag[idx] / 150.0,
            2.0
        )

        # Look 0.1 - 0.5 sec before impact
        pre_start = max(
            0,
            idx - int(0.5 * TARGET_FS)
        )

        pre_end = max(
            pre_start + 1,
            idx - int(0.1 * TARGET_FS)
        )

        pre_acc_min = np.min(
            acc_mag[pre_start:pre_end]
        )

        # Reward free-fall/unloading.
        if pre_acc_min < 0.7:
            freefall_score = 2.0
        elif pre_acc_min < 0.85:
            freefall_score = 1.0
        else:
            freefall_score = 0.0

        score = (
            acc_score +
            gyro_score +
            freefall_score
        )

        if score > best_score:
            best_score = score
            best_index = int(idx)

    return best_index, "event_score"


# ============================================================
# HELPER: ADD WINDOW
# ============================================================

def add_window(
    split,
    window,
    label,
    metadata
):

    if split == "train":

        X_train.append(window)
        y_train.append(label)
        metadata_train.append(metadata)

    elif split == "val":

        X_val.append(window)
        y_val.append(label)
        metadata_val.append(metadata)

    elif split == "test":

        X_test.append(window)
        y_test.append(label)
        metadata_test.append(metadata)


# ============================================================
# PROCESS ONE TRIAL
# ============================================================

def process_trial(
    trial_df,
    source_file
):

    subject = str(
        trial_df["subject"].iloc[0]
    )

    activity = str(
        trial_df["activity"].iloc[0]
    )

    label_name = str(
        trial_df["label"].iloc[0]
    )

    split = SUBJECT_TO_SPLIT[subject]

    stats["trials"] += 1

    # --------------------------------------------------------
    # Extract six channels
    # --------------------------------------------------------

    data = trial_df[
        CHANNELS
    ].to_numpy(
        dtype=np.float32
    )

    # Need enough samples for a 2 sec window.
    if len(data) < ORIGINAL_FS * WINDOW_SECONDS:
        return

    # --------------------------------------------------------
    # Resample
    # --------------------------------------------------------

    data = resample_trial(data)

    if len(data) < WINDOW_SIZE:
        return

    # --------------------------------------------------------
    # FALL TRIAL
    # --------------------------------------------------------

    if label_name == "FALL":

        stats["fall_trials"] += 1

        impact_index, method = find_fall_event(data)

        if method == "acceleration_fallback":
            stats["fall_fallback_events"] += 1

        stats["fall_events_found"] += 1

        # ----------------------------------------------------
        # Generate event-centered FALL windows
        # ----------------------------------------------------

        used_starts = set()

        for offset in FALL_START_OFFSETS:

            start = int(
                impact_index -
                offset * TARGET_FS
            )

            end = start + WINDOW_SIZE

            # Keep window inside trial
            if start < 0:
                start = 0
                end = WINDOW_SIZE

            if end > len(data):
                end = len(data)
                start = end - WINDOW_SIZE

            if start < 0 or end > len(data):
                continue

            # Avoid duplicates
            if start in used_starts:
                continue

            used_starts.add(start)

            window = data[
                start:end
            ]

            if len(window) != WINDOW_SIZE:
                continue

            metadata = {
                "subject": subject,
                "activity": activity,
                "trial": str(
                    trial_df["trial"].iloc[0]
                ),
                "label": 1,
                "source_file": source_file,
                "split": split,
                "window_start": start,
                "window_end": end,
                "impact_index": impact_index,
                "event_method": method
            }

            add_window(
                split,
                window,
                1,
                metadata
            )

            stats["fall_windows"] += 1

    # --------------------------------------------------------
    # NORMAL / ADL TRIAL
    # --------------------------------------------------------

    else:

        stats["normal_trials"] += 1

        max_start = (
            len(data) -
            WINDOW_SIZE
        )

        if max_start <= 0:
            return

        # ----------------------------------------------------
        # Random normal windows
        # ----------------------------------------------------

        possible_starts = np.arange(
            0,
            max_start + 1,
            WINDOW_SIZE
        )

        # Randomize
        possible_starts = list(
            possible_starts
        )

        random.shuffle(
            possible_starts
        )

        selected_starts = possible_starts[
            :NORMAL_WINDOWS_PER_TRIAL
        ]

        for start in selected_starts:

            end = start + WINDOW_SIZE

            window = data[
                start:end
            ]

            if len(window) != WINDOW_SIZE:
                continue

            metadata = {
                "subject": subject,
                "activity": activity,
                "trial": str(
                    trial_df["trial"].iloc[0]
                ),
                "label": 0,
                "source_file": source_file,
                "split": split,
                "window_start": start,
                "window_end": end,
                "impact_index": -1,
                "event_method": "normal"
            }

            add_window(
                split,
                window,
                0,
                metadata
            )

            stats["normal_windows"] += 1


# ============================================================
# STREAM THROUGH CSV
# ============================================================

print("\nProcessing normalized CSV...")

USECOLS = [
    "ax_g",
    "ay_g",
    "az_g",
    "gx_dps",
    "gy_dps",
    "gz_dps",
    "activity",
    "subject",
    "trial",
    "label",
    "source_file"
]


current_source_file = None
current_trial = []


def finalize_current_trial():

    global current_trial
    global current_source_file

    if not current_trial:
        return

    trial_df = pd.concat(
        current_trial,
        ignore_index=True
    )

    process_trial(
        trial_df,
        current_source_file
    )

    current_trial = []


reader = pd.read_csv(
    INPUT_FILE,
    usecols=USECOLS,
    chunksize=200000
)

for chunk_number, chunk in enumerate(
    reader,
    start=1
):

    print(
        f"\rProcessing chunk {chunk_number}...",
        end=""
    )

    for source_file, group in chunk.groupby(
        "source_file",
        sort=False
    ):

        if current_source_file is None:

            current_source_file = source_file

        elif source_file != current_source_file:

            finalize_current_trial()

            current_source_file = source_file

        current_trial.append(group)


# Final trial
finalize_current_trial()

print("\n")


# ============================================================
# CONVERT TO NUMPY
# ============================================================

def convert_dataset(X, y):

    if len(X) == 0:

        return (
            np.empty(
                (0, WINDOW_SIZE, len(CHANNELS)),
                dtype=np.float32
            ),
            np.empty(
                (0,),
                dtype=np.int8
            )
        )

    return (
        np.asarray(
            X,
            dtype=np.float32
        ),
        np.asarray(
            y,
            dtype=np.int8
        )
    )


X_train, y_train = convert_dataset(
    X_train,
    y_train
)

X_val, y_val = convert_dataset(
    X_val,
    y_val
)

X_test, y_test = convert_dataset(
    X_test,
    y_test
)


# ============================================================
# SAVE DATASETS
# ============================================================

print("=" * 70)
print("SAVING DATA")
print("=" * 70)

np.savez_compressed(
    os.path.join(
        OUTPUT_DIR,
        "X_train.npz"
    ),
    X=X_train
)

np.savez_compressed(
    os.path.join(
        OUTPUT_DIR,
        "y_train.npz"
    ),
    y=y_train
)

np.savez_compressed(
    os.path.join(
        OUTPUT_DIR,
        "X_val.npz"
    ),
    X=X_val
)

np.savez_compressed(
    os.path.join(
        OUTPUT_DIR,
        "y_val.npz"
    ),
    y=y_val
)

np.savez_compressed(
    os.path.join(
        OUTPUT_DIR,
        "X_test.npz"
    ),
    X=X_test
)

np.savez_compressed(
    os.path.join(
        OUTPUT_DIR,
        "y_test.npz"
    ),
    y=y_test
)


# ============================================================
# SAVE METADATA
# ============================================================

all_metadata = (
    metadata_train +
    metadata_val +
    metadata_test
)

metadata_df = pd.DataFrame(
    all_metadata
)

metadata_df.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "window_metadata.csv"
    ),
    index=False
)


# ============================================================
# PRINT RESULTS
# ============================================================

print("\n" + "=" * 70)
print("DATASET SUMMARY")
print("=" * 70)

print("\nTRAIN:")
print("X:", X_train.shape)
print("y:", y_train.shape)

if len(y_train) > 0:
    print(
        pd.Series(y_train)
        .value_counts()
        .sort_index()
        .rename(
            index={
                0: "NORMAL",
                1: "FALL"
            }
        )
    )

print("\nVALIDATION:")
print("X:", X_val.shape)
print("y:", y_val.shape)

if len(y_val) > 0:
    print(
        pd.Series(y_val)
        .value_counts()
        .sort_index()
        .rename(
            index={
                0: "NORMAL",
                1: "FALL"
            }
        )
    )

print("\nTEST:")
print("X:", X_test.shape)
print("y:", y_test.shape)

if len(y_test) > 0:
    print(
        pd.Series(y_test)
        .value_counts()
        .sort_index()
        .rename(
            index={
                0: "NORMAL",
                1: "FALL"
            }
        )
    )


# ============================================================
# STATISTICS
# ============================================================

print("\n" + "=" * 70)
print("PROCESSING STATISTICS")
print("=" * 70)

for key, value in stats.items():
    print(f"{key:25s}: {value}")


# ============================================================
# SAVE SUMMARY
# ============================================================

with open(
    os.path.join(
        OUTPUT_DIR,
        "summary.txt"
    ),
    "w"
) as f:

    f.write(
        "Guardian 360 Event-Centered Windows V2\n"
    )

    f.write(
        "=" * 50 + "\n\n"
    )

    for key, value in stats.items():
        f.write(
            f"{key}: {value}\n"
        )

    f.write("\n")

    f.write(
        f"Train shape: {X_train.shape}\n"
    )

    f.write(
        f"Validation shape: {X_val.shape}\n"
    )

    f.write(
        f"Test shape: {X_test.shape}\n"
    )


print("\n" + "=" * 70)
print("WINDOW GENERATION COMPLETE")
print("=" * 70)

print(
    f"""
Output directory:

{OUTPUT_DIR}

The original windows remain untouched:

results/windows/

New event-centered windows:

results/windows_v2/

Important:
FALL windows are now centered around detected fall events
instead of labeling the entire fall trial as FALL.
"""
)