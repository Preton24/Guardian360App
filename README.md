# Guardian360

Guardian360 is an intelligent elderly care companion and monitoring platform featuring voice-driven reminders, speech pattern analysis for cognitive risk estimation, a real-time Express/Prisma backend, and a cross-platform React Native/Expo mobile application.

---

## 🚀 Quick Setup & Installation

### 1. Install Python Requirements

To install all Python dependencies across the entire project (voice assistant, speech analysis, and backend ML models):

```bash
pip install -r requirements.txt
```

Alternatively, you can install dependencies for individual modules:
- **Voice Assistance Module:**
  ```bash
  cd voice_assistance
  pip install -r requirements.txt
  ```
- **Backend Machine Learning Model:**
  ```bash
  cd backend
  pip install -r requirements.txt
  ```

---

### 2. Backend Setup (Node.js & PostgreSQL)

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

---

### 3. Mobile App Setup (Expo & React Native)

```bash
cd Guardian360
npm install
npx expo start
```

---

## 📂 Project Architecture

- **`voice_assistance/`**: Local voice reminder assistant, audio capture, speech-to-text, acoustic feature extraction, and sentiment/emotion analysis.
- **`backend/`**: Express.js REST API with Prisma ORM (PostgreSQL) and Random Forest cognitive health scoring ([`voice_model.py`](backend/voice_model.py)).
- **`Guardian360/`**: Cross-platform mobile app for caretakers and elderly users built with React Native and Expo Router.
- **`requirements.txt`**: Root requirements file aggregating Python dependencies across all services.
- **`REQUIREMENTS.md`**: Detailed specification of all system prerequisites and packages.
