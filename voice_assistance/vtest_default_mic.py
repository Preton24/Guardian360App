import speech_recognition as sr

recognizer = sr.Recognizer()

print("Using default microphone.")
print("Speak after the message...")

try:
    with sr.Microphone() as source:
        recognizer.adjust_for_ambient_noise(source, duration=1)
        print("Speak now...")
        audio = recognizer.listen(source, timeout=10, phrase_time_limit=5)

    with open("default_mic_test.wav", "wb") as file:
        file.write(audio.get_wav_data())

    print("Recording successful. File saved as default_mic_test.wav")

except Exception as error:
    print("Mic failed:", error)