import os
import numpy as np
import pandas as pd

from scipy.signal import resample_poly
from sklearn.model_selection import train_test_split


# ============================================================
# Guardian 360 - SisFall Window Creation
# ============================================================
# Input:
#   results/sisfall_normalized.csv
#
# Output:
#   results/windows/
#       X_train.npz
#       y_train.npz
#       X_val.npz
#       y_val.npz
#       X_test.npz
#       y_test.npz
#       train_subjects.txt
#       val_subjects.txt
#       test_subjects.txt
#       window_metadata.csv
#
# Configuration:
#   Original sampling rate : 200 Hz
#   Target sampling rate   : 100 Hz
#   Window duration         : 2 seconds
#   Window size             : 200 samples
#   Overlap                 : 50%
#   Step size               : 100 samples
#
# Channels:
#   ax_g, ay_g, az_g
#   gx_dps, gy_dps, gz_dps
# ============================================================


# ------------------------------------------------------------
# PATHS
# ------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INPUT_FILE = os.path.join(
    BASE_DIR,
    "results",
    "sisfall_normalized.csv"
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "results",
    "windows"
)

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ------------------------------------------------------------
# CONFIGURATION
# ------------------------------------------------------------

ORIGINAL_FS = 200
TARGET_FS = 100

WINDOW_SECONDS = 2
WINDOW_SIZE = TARGET_FS * WINDOW_SECONDS

OVERLAP = 0.50
STEP_SIZE = int(WINDOW_SIZE * (1 - OVERLAP))

RANDOM_STATE = 42

CHANNELS = [
    "ax_g",
    "ay_g",
    "az_g",
    "gx_dps",
    "gy_dps",
    "gz_dps"
]

REQUIRED_COLUMNS = CHANNELS + [
    "activity",
    "subject",
    "trial",
    "label",
    "source_file"
]


# ------------------------------------------------------------
# HELPER: GET UNIQUE SUBJECTS
# ------------------------------------------------------------

def get_subjects():
    """
    Read only the subject column to determine all subjects.
    This avoids loading the entire dataset into memory.
    """

    print("\n" + "=" * 70)
    print("STEP 1: FINDING SUBJECTS")
    print("=" * 70)

    subjects = set()

    for chunk in pd.read_csv(
        INPUT_FILE,
        usecols=["subject"],
        chunksize=500_000
    ):
        subjects.update(chunk["subject"].dropna().unique())

    subjects = sorted(subjects)

    print(f"Total subjects found : {len(subjects)}")
    print("Subjects:")

    for subject in subjects:
        print(f"  {subject}")

    return subjects


# ------------------------------------------------------------
# HELPER: SPLIT SUBJECTS
# ------------------------------------------------------------

def create_subject_split(subjects):

    print("\n" + "=" * 70)
    print("STEP 2: SUBJECT-INDEPENDENT TRAIN/VAL/TEST SPLIT")
    print("=" * 70)

    # First: 70% train, 30% temporary
    train_subjects, temp_subjects = train_test_split(
        subjects,
        test_size=0.30,
        random_state=RANDOM_STATE
    )

    # Then split temporary set equally:
    # 15% validation
    # 15% test
    val_subjects, test_subjects = train_test_split(
        temp_subjects,
        test_size=0.50,
        random_state=RANDOM_STATE
    )

    train_subjects = sorted(train_subjects)
    val_subjects = sorted(val_subjects)
    test_subjects = sorted(test_subjects)

    print("\nTRAIN subjects:")
    print(train_subjects)

    print("\nVALIDATION subjects:")
    print(val_subjects)

    print("\nTEST subjects:")
    print(test_subjects)

    print("\nCounts:")
    print(f"  Train      : {len(train_subjects)}")
    print(f"  Validation : {len(val_subjects)}")
    print(f"  Test       : {len(test_subjects)}")

    # --------------------------------------------------------
    # Save split
    # --------------------------------------------------------

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

    return train_subjects, val_subjects, test_subjects


# ------------------------------------------------------------
# HELPER: RESAMPLE TRIAL
# ------------------------------------------------------------

def resample_trial(data):

    """
    Convert 200 Hz -> 100 Hz.

    resample_poly() performs proper filtering before
    downsampling, reducing aliasing compared with simply
    taking every second sample.
    """

    if ORIGINAL_FS == TARGET_FS:
        return data

    if ORIGINAL_FS == 200 and TARGET_FS == 100:

        # Downsample by factor of 2.
        #
        # Shape:
        #   original = samples x channels
        #   result   = samples/2 x channels
        return resample_poly(
            data,
            up=1,
            down=2,
            axis=0
        )

    raise ValueError(
        "Unsupported sampling-rate conversion."
    )


# ------------------------------------------------------------
# HELPER: CREATE WINDOWS
# ------------------------------------------------------------

def make_windows(data):

    """
    Convert one resampled trial into overlapping windows.
    """

    windows = []

    n_samples = len(data)

    if n_samples < WINDOW_SIZE:
        return windows

    for start in range(
        0,
        n_samples - WINDOW_SIZE + 1,
        STEP_SIZE
    ):

        end = start + WINDOW_SIZE

        window = data[start:end]

        # Safety check
        if window.shape == (
            WINDOW_SIZE,
            len(CHANNELS)
        ):
            windows.append(
                window.astype(np.float32)
            )

    return windows


# ------------------------------------------------------------
# MAIN PROCESSING FUNCTION
# ------------------------------------------------------------

def process_dataset(
    train_subjects,
    val_subjects,
    test_subjects
):

    print("\n" + "=" * 70)
    print("STEP 3: CREATING WINDOWS")
    print("=" * 70)

    print(f"Original sampling rate : {ORIGINAL_FS} Hz")
    print(f"Target sampling rate   : {TARGET_FS} Hz")
    print(f"Window duration        : {WINDOW_SECONDS} sec")
    print(f"Window size            : {WINDOW_SIZE} samples")
    print(f"Overlap                : {OVERLAP * 100:.0f}%")
    print(f"Step size              : {STEP_SIZE} samples")

    # --------------------------------------------------------
    # Store windows separately for each split
    # --------------------------------------------------------

    X_train = []
    y_train = []

    X_val = []
    y_val = []

    X_test = []
    y_test = []

    metadata = []

    current_trial = None
    trial_data = []
    trial_info = None

    trial_count = 0

    windows_by_split = {
        "TRAIN": 0,
        "VAL": 0,
        "TEST": 0
    }

    labels_by_split = {
        "TRAIN": {"NORMAL": 0, "FALL": 0},
        "VAL": {"NORMAL": 0, "FALL": 0},
        "TEST": {"NORMAL": 0, "FALL": 0}
    }

    # --------------------------------------------------------
    # Determine split from subject
    # --------------------------------------------------------

    train_set = set(train_subjects)
    val_set = set(val_subjects)
    test_set = set(test_subjects)

    def get_split(subject):

        if subject in train_set:
            return "TRAIN"

        if subject in val_set:
            return "VAL"

        if subject in test_set:
            return "TEST"

        raise ValueError(
            f"Unknown subject encountered: {subject}"
        )

    # --------------------------------------------------------
    # Process one completed trial
    # --------------------------------------------------------

    def process_trial(
        trial_data,
        trial_info
    ):

        nonlocal trial_count

        if not trial_data:
            return

        trial_count += 1

        subject = trial_info["subject"]
        label = trial_info["label"]
        activity = trial_info["activity"]
        trial = trial_info["trial"]
        source_file = trial_info["source_file"]

        split = get_split(subject)

        # Convert list -> numpy array
        data = np.asarray(
            trial_data,
            dtype=np.float32
        )

        # ----------------------------------------------------
        # Resample 200 Hz -> 100 Hz
        # ----------------------------------------------------

        data = resample_trial(data)

        # ----------------------------------------------------
        # Create windows
        # ----------------------------------------------------

        windows = make_windows(data)

        for window in windows:

            # Encode:
            # NORMAL = 0
            # FALL   = 1

            numeric_label = 1 if label == "FALL" else 0

            if split == "TRAIN":

                X_train.append(window)
                y_train.append(numeric_label)

            elif split == "VAL":

                X_val.append(window)
                y_val.append(numeric_label)

            elif split == "TEST":

                X_test.append(window)
                y_test.append(numeric_label)

            windows_by_split[split] += 1

            labels_by_split[split][label] += 1

            metadata.append({
                "split": split,
                "subject": subject,
                "activity": activity,
                "trial": trial,
                "label": label,
                "source_file": source_file
            })

    # --------------------------------------------------------
    # Read normalized CSV in chunks
    # --------------------------------------------------------

    print("\nReading normalized dataset...")

    chunk_number = 0

    for chunk in pd.read_csv(
        INPUT_FILE,
        usecols=REQUIRED_COLUMNS,
        chunksize=500_000
    ):

        chunk_number += 1

        print(
            f"Processing CSV chunk {chunk_number}..."
        )

        # ----------------------------------------------------
        # Process rows
        #
        # The converter generated the CSV grouped by
        # source_file, so a trial's rows are consecutive.
        # ----------------------------------------------------

        for row in chunk.itertuples(
            index=False,
            name=None
        ):

            (
                ax,
                ay,
                az,
                gx,
                gy,
                gz,
                activity,
                subject,
                trial,
                label,
                source_file
            ) = row

            # ------------------------------------------------
            # Detect beginning of a new trial
            # ------------------------------------------------

            if current_trial is None:

                current_trial = source_file

                trial_info = {
                    "subject": subject,
                    "activity": activity,
                    "trial": trial,
                    "label": label,
                    "source_file": source_file
                }

            elif source_file != current_trial:

                # Finish previous trial
                process_trial(
                    trial_data,
                    trial_info
                )

                # Start new trial
                current_trial = source_file

                trial_info = {
                    "subject": subject,
                    "activity": activity,
                    "trial": trial,
                    "label": label,
                    "source_file": source_file
                }

                trial_data = []

            # Add six selected channels
            trial_data.append([
                ax,
                ay,
                az,
                gx,
                gy,
                gz
            ])

    # --------------------------------------------------------
    # Process final trial
    # --------------------------------------------------------

    process_trial(
        trial_data,
        trial_info
    )

    print("\nFinished processing all trials.")

    # --------------------------------------------------------
    # Convert to numpy arrays
    # --------------------------------------------------------

    print("\nConverting windows to NumPy arrays...")

    X_train = np.asarray(
        X_train,
        dtype=np.float32
    )

    y_train = np.asarray(
        y_train,
        dtype=np.int8
    )

    X_val = np.asarray(
        X_val,
        dtype=np.float32
    )

    y_val = np.asarray(
        y_val,
        dtype=np.int8
    )

    X_test = np.asarray(
        X_test,
        dtype=np.float32
    )

    y_test = np.asarray(
        y_test,
        dtype=np.int8
    )

    # --------------------------------------------------------
    # Save arrays
    # --------------------------------------------------------

    print("\nSaving window datasets...")

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

    # --------------------------------------------------------
    # Save metadata
    # --------------------------------------------------------

    metadata_df = pd.DataFrame(metadata)

    metadata_df.to_csv(
        os.path.join(
            OUTPUT_DIR,
            "window_metadata.csv"
        ),
        index=False
    )

    # --------------------------------------------------------
    # Print results
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("WINDOW CREATION COMPLETE")
    print("=" * 70)

    print(f"\nTrials processed : {trial_count}")

    print("\nWindow shapes:")

    print(
        f"  X_train : {X_train.shape}"
    )

    print(
        f"  X_val   : {X_val.shape}"
    )

    print(
        f"  X_test  : {X_test.shape}"
    )

    print("\nWindow counts:")

    for split in [
        "TRAIN",
        "VAL",
        "TEST"
    ]:
        print(
            f"  {split:5s} : "
            f"{windows_by_split[split]}"
        )

    print("\nLabel distribution:")

    for split in [
        "TRAIN",
        "VAL",
        "TEST"
    ]:

        normal = labels_by_split[split]["NORMAL"]
        fall = labels_by_split[split]["FALL"]

        total = normal + fall

        print(f"\n{split}")
        print(f"  NORMAL : {normal}")
        print(f"  FALL   : {fall}")
        print(f"  TOTAL  : {total}")

        if total > 0:
            print(
                f"  FALL % : "
                f"{fall / total * 100:.2f}%"
            )

    print("\nOutput directory:")
    print(OUTPUT_DIR)

    print("\nFiles created:")

    for filename in sorted(
        os.listdir(OUTPUT_DIR)
    ):
        print(f"  {filename}")

    print("\n" + "=" * 70)
    print("NEXT STEP")
    print("=" * 70)

    print(
        "\nInspect the window counts and label distribution "
        "before training the ML model."
    )


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    print("\n" + "=" * 70)
    print("GUARDIAN 360 - SISFALL WINDOW GENERATION")
    print("=" * 70)

    # --------------------------------------------------------
    # Check input
    # --------------------------------------------------------

    if not os.path.exists(INPUT_FILE):

        print("\nERROR:")
        print(
            "Normalized dataset not found:"
        )
        print(INPUT_FILE)

        raise SystemExit(1)

    print("\nInput:")
    print(INPUT_FILE)

    print("\nOutput:")
    print(OUTPUT_DIR)

    # --------------------------------------------------------
    # Find subjects
    # --------------------------------------------------------

    subjects = get_subjects()

    if len(subjects) < 10:

        print(
            "\nERROR: Too few subjects found."
        )

        raise SystemExit(1)

    # --------------------------------------------------------
    # Create subject split
    # --------------------------------------------------------

    (
        train_subjects,
        val_subjects,
        test_subjects
    ) = create_subject_split(subjects)

    # --------------------------------------------------------
    # Process dataset
    # --------------------------------------------------------

    process_dataset(
        train_subjects,
        val_subjects,
        test_subjects
    )