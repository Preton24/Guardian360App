import sounddevice as sd

print("Checking audio devices...\n")

devices = sd.query_devices()

for i, device in enumerate(devices):
    print(f"{i}: {device['name']}")

print("\nDefault input device (by index):", sd.default.device[0])
print("Default output device (by index):", sd.default.device[1])