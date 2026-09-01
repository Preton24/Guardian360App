import sounddevice as sd

print("Checking audio devices...\n")

devices = sd.query_devices()

print(devices)

print("\nDefault input/output device:")
print(sd.default.device)