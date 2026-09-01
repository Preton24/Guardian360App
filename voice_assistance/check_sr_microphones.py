import speech_recognition as sr

print("SpeechRecognition microphones:")
print("--------------------------------")

for index, name in enumerate(sr.Microphone.list_microphone_names()):
    print(index, name)