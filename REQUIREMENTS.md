# Guardian360 - Project Requirements & Setup Guide

This document outlines the dependencies and environment requirements for all folders in the **Guardian360** application.

---

## Folder Overview

| Folder | Tech Stack | Role | Requirements File |
| :--- | :--- | :--- | :--- |
| **`voice_assistance/`** | Python 3.10+ | Local voice reminders, speech analysis & ML cognitive risk estimation | [`requirements.txt`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/voice_assistance/requirements.txt) |
| **`backend/`** | Node.js (Express, Prisma) + Python | REST API server, PostgreSQL ORM, and Random Forest voice scoring model | [`requirements.txt`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/backend/requirements.txt), [`package.json`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/backend/package.json) |
| **`Guardian360/`** | React Native, Expo, TypeScript | Mobile app for caretakers & elderly users | [`package.json`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/Guardian360/package.json), [`requirements.txt`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/Guardian360/requirements.txt) |
| **Root (`./`)** | Unified | Master project setup | [`requirements.txt`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/requirements.txt) |

---

## 1. Voice Assistance Module (`voice_assistance/`)

### System Prerequisites
- **Python:** `3.10` - `3.13`
- Working microphone and audio output devices
- C++ build tools (for `PyAudio` on Windows if wheels are not prebuilt)

### Python Dependencies
Installed via [`voice_assistance/requirements.txt`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/voice_assistance/requirements.txt):
- **Numerical & Data Processing:** `numpy`, `scipy`, `pandas`
- **Machine Learning & NLP:** `scikit-learn`, `joblib`, `vaderSentiment`
- **Speech & Audio:** `pyttsx3`, `SpeechRecognition`, `sounddevice`, `PyAudio`, `librosa`, `soundfile`
- **Emotion Recognition (Optional Pipeline):** `transformers`, `torch`

```bash
cd voice_assistance
pip install -r requirements.txt
```

---

## 2. Backend Server (`backend/`)

### System Prerequisites
- **Node.js:** `v18.x` or higher
- **PostgreSQL:** Running instance (configurable via `backend/.env` with `DATABASE_URL`)
- **Python:** `3.10+` (for `voice_model.py` called by the server)

### Node.js Dependencies
Installed via [`backend/package.json`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/backend/package.json):
- `express` (v5+)
- `@prisma/client`, `prisma`, `@prisma/adapter-pg`
- `pg`
- `cors`, `dotenv`

### Python ML Dependencies
Installed via [`backend/requirements.txt`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/backend/requirements.txt):
- `numpy`
- `scikit-learn`

```bash
cd backend
npm install
pip install -r requirements.txt
npx prisma generate
```

---

## 3. Mobile App (`Guardian360/`)

### System Prerequisites
- **Node.js:** `v18.x` or higher
- **Expo CLI:** `npx expo`
- **Mobile Device or Emulator:** Expo Go app (iOS/Android) or Android Studio / Xcode

### Node.js Dependencies
Installed via [`Guardian360/package.json`](file:///e:/MY%20PROJECTS/MAJOR%20PROJECT/Guardian360App/Guardian360/package.json):
- `expo`, `expo-router`, `react-native`
- `react-native-reanimated`, `react-native-screens`, `react-native-safe-area-context`
- `react-native-maps`, `expo-av`, `@expo/vector-icons`

```bash
cd Guardian360
npm install
npx expo start
```

---

## 4. Root Quick Install

To install all Python dependencies across the entire project at once:
```bash
pip install -r requirements.txt
```
