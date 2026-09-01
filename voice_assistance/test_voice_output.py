import subprocess

message = "Guardian 360 reminder test successful."

subprocess.run(
    [
        "powershell",
        "-Command",
        f"Add-Type -AssemblyName System.Speech; "
        f"$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        f"$speak.Speak('{message}')"
    ]
)