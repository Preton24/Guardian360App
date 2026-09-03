import speech_recognition as sr

def get_mic_index():
    for i, name in enumerate(sr.Microphone.list_microphone_names()):
        if ("microphone" in name.lower() or "mic" in name.lower()) and "stereo mix" not in name.lower():
            print(f"Selected Microphone Device [Index {i}]: {name}")
            return i
    return None

MICROPHONE_INDEX = 2

mic_idx = MICROPHONE_INDEX if MICROPHONE_INDEX is not None else get_mic_index()
print(f"Using Microphone Device Index: {mic_idx}")
recognizer = sr.Recognizer()
recognizer.energy_threshold = 300
recognizer.dynamic_energy_threshold = True

print("Speak after the message...")

try:
    with sr.Microphone(device_index=mic_idx) as source:
        print("Calibrating ambient noise...")
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        print("Speak now...")
        audio = recognizer.listen(source, timeout=12, phrase_time_limit=5)

    with open("default_mic_test.wav", "wb") as file:
        file.write(audio.get_wav_data())

    print("Recording successful. File saved as default_mic_test.wav")

except Exception as error:
    print("Mic failed:", error)