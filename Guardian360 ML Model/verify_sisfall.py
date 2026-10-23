from pathlib import Path

# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

DATASET_PATH = Path("SisFall_dataset")

# --------------------------------------------------
# CHECK DATASET
# --------------------------------------------------

if not DATASET_PATH.exists():
    print("❌ SisFall_dataset folder not found!")
    print("Expected:")
    print("Guardian360/")
    print("    SisFall_dataset/")
    raise SystemExit

print("=" * 60)
print("          SISFALL DATASET VERIFICATION")
print("=" * 60)

# --------------------------------------------------
# SUBJECT FOLDERS
# --------------------------------------------------

subject_folders = sorted([
    folder for folder in DATASET_PATH.iterdir()
    if folder.is_dir()
])

print(f"\nSubject folders found : {len(subject_folders)}")

print("\nSubjects:")
for folder in subject_folders:
    print(" ", folder.name)

# --------------------------------------------------
# FIND DATA FILES
# --------------------------------------------------

txt_files = list(DATASET_PATH.rglob("*.txt"))

data_files = [
    f for f in txt_files
    if f.name.lower() not in ["readme.txt", "readme"]
]

print("\n" + "-" * 60)
print(f"Total TXT data files : {len(data_files)}")

# --------------------------------------------------
# FALL / ADL COUNT
# --------------------------------------------------

fall_files = []
adl_files = []

for file in data_files:

    filename = file.name.upper()

    if filename.startswith("F"):
        fall_files.append(file)

    elif filename.startswith("D"):
        adl_files.append(file)

print(f"Fall trials          : {len(fall_files)}")
print(f"ADL trials           : {len(adl_files)}")

# --------------------------------------------------
# EXAMPLES
# --------------------------------------------------

print("\n" + "-" * 60)

print("\nExample FALL files:")

for file in fall_files[:5]:
    print(" ", file.relative_to(DATASET_PATH))

print("\nExample ADL files:")

for file in adl_files[:5]:
    print(" ", file.relative_to(DATASET_PATH))

# --------------------------------------------------
# READ ONE DATA FILE
# --------------------------------------------------

if data_files:

    sample_file = data_files[0]

    print("\n" + "-" * 60)
    print("SAMPLE FILE")
    print("-" * 60)

    print("File:", sample_file.relative_to(DATASET_PATH))

    with open(sample_file, "r") as f:
        lines = f.readlines()

    print("Number of rows:", len(lines))

    print("\nFirst 5 rows:")

    for line in lines[:5]:
        print(line.strip())

    # Check number of values
    first_data_line = lines[0].strip()
    values = first_data_line.split(",")

    print("\nValues in first row:", len(values))

    print("\nExpected:")
    print("AX, AY, AZ, GX, GY, GZ")

# --------------------------------------------------
# SUMMARY
# --------------------------------------------------

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)