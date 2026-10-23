import os

DATA_DIR = r"D:\Guardian360\dataMPU"

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

print("=" * 70)
print("CHECKING MPU DATASET FILES")
print("=" * 70)

total = 0
valid_class = 0

for root, dirs, files in os.walk(DATA_DIR):

    for file in files:

        if not file.lower().endswith(".csv"):
            continue

        total += 1

        relative = os.path.relpath(
            os.path.join(root, file),
            DATA_DIR
        )

        parts = relative.split(os.sep)

        activity = parts[0].lower()

        if activity in FALL_CLASSES or activity in NORMAL_CLASSES:

            valid_class += 1

        else:

            print(
                f"\nUNKNOWN/SKIPPED CLASS:"
            )

            print(
                f"  {relative}"
            )

print("\n" + "=" * 70)

print(f"Total CSV files : {total}")
print(f"Known class     : {valid_class}")
print(f"Unknown class   : {total - valid_class}")

print("=" * 70)