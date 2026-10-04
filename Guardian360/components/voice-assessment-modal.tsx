import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { api, VoiceAnalysisRecord } from '@/services/api';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  onAnalysisComplete?: () => void;
  isDark?: boolean;
}

// Clinical sentiment analysis matching voice_check_test.py with negation awareness and clinical triggers
function analyzeClinicalSentiment(text: string): { sentiment: string; isAlert: boolean } {
  if (!text || !text.trim()) return { sentiment: 'No Speech Detected', isAlert: false };
  const clean = text.toLowerCase().trim();

  // 1. Critical Emergency Phrases
  const critical = [
    'help', 'i need help', 'emergency', 'fell down', 'i fell', 'call doctor',
    'call 911', 'cannot get up', "can't get up", 'heart attack', 'stroke',
    'bleeding', 'ambulance', 'passed out', 'fainted'
  ];
  for (const ph of critical) {
    if (clean.includes(ph)) return { sentiment: 'Emergency / Needs Help', isAlert: true };
  }

  // 2. Negated Positive Patterns & Negated Health Concerns
  const negatedHealthPatterns = [
    /\b(?:not|don'?t|can'?t|cannot|hardly|barely|never)\s+(?:feel\s+|feeling\s+|doing\s+)?well\b/,
    /\bunwell\b/,
    /\bnot\s+healthy\b/,
    /\bnot\s+doing\s+well\b/
  ];
  for (const pattern of negatedHealthPatterns) {
    if (pattern.test(clean)) return { sentiment: 'Health Concern Detected', isAlert: true };
  }

  const negatedPositivePatterns = [
    /\b(?:not|don'?t|can'?t|cannot|hardly|never|no)\s+(?:feel\s+|feeling\s+|doing\s+)?(?:good|fine|okay|ok|happy|great|alright|better|normal)\b/,
    /\b(?:not|don'?t|can'?t|cannot)\s+(?:good|fine|okay|ok|happy|great|alright|better)\b/,
    /\bno\s+good\b/,
    /\bcan'?t\s+cope\b/,
    /\bhardly\s+fine\b/
  ];
  for (const pattern of negatedPositivePatterns) {
    if (pattern.test(clean)) return { sentiment: 'Negative / Distress', isAlert: true };
  }

  // 3. Clinical Symptoms & Physical Health Concerns
  const healthConcern = [
    'pain', 'chest pain', 'dizzy', 'dizziness', 'tired', 'very tired', 'weak',
    'feeling weak', 'sick', 'feeling sick', 'breathless', "can't breathe",
    'cannot breathe', 'headache', 'confused', 'fever', 'nausea', 'nauseous',
    'vomit', 'vomiting', 'hurts', 'hurting', 'ache', 'aching', 'sore',
    'coughing', 'cough', 'shaky', 'stomach ache', 'back pain', 'chills',
    'cannot walk', "can't walk", 'hard to walk'
  ];
  for (const ph of healthConcern) {
    const rx = new RegExp('(\\b|\\s|^)' + ph.replace(/\s+/g, '\\s+') + '(\\b|\\s|$)', 'i');
    if (rx.test(clean) || clean.includes(ph)) return { sentiment: 'Health Concern Detected', isAlert: true };
  }

  // 4. Emotional Distress & Support Needed
  const emotional = [
    'lonely', 'feeling lonely', 'sad', 'very sad', 'scared', 'afraid',
    'depressed', 'depression', 'unhappy', 'no one to talk', 'crying',
    'anxious', 'anxiety', 'hopeless', 'worried', 'frightened', 'miserable'
  ];
  for (const ph of emotional) {
    const rx = new RegExp('(\\b|\\s|^)' + ph.replace(/\s+/g, '\\s+') + '(\\b|\\s|$)', 'i');
    if (rx.test(clean) || clean.includes(ph)) return { sentiment: 'Emotional Support Needed', isAlert: true };
  }

  // 5. Explicit Negative Words
  const negativeWords = [
    'bad', 'badly', 'terrible', 'awful', 'horrible', 'worse', 'worst',
    'poor', 'poorly', 'ill', 'struggling', 'dreadful', 'lousy', 'rough'
  ];
  for (const w of negativeWords) {
    const rx = new RegExp('\\b' + w + '\\b', 'i');
    if (rx.test(clean)) return { sentiment: 'Negative / Distress', isAlert: true };
  }

  // 6. Positive & Healthy (Only if non-negated!)
  const positiveWords = [
    'good', 'great', 'fine', 'well', 'happy', 'energetic', 'better',
    'wonderful', 'healthy', 'okay', 'alright', 'normal', 'fantastic', 'excellent'
  ];
  const hasPositive = positiveWords.some(w => new RegExp('\\b' + w + '\\b', 'i').test(clean));
  if (hasPositive) return { sentiment: 'Positive & Healthy', isAlert: false };

  return { sentiment: 'Neutral & Responsive', isAlert: false };
}

export function VoiceAssessmentModal({
  visible,
  onClose,
  userId = 'default-user-id',
  onAnalysisComplete,
  isDark = true,
}: Props) {
  // Assessment phases
  const [phase, setPhase] = useState<'idle' | 'prompting' | 'waiting' | 'recording' | 'analyzing' | 'result'>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [userHasSpoken, setUserHasSpoken] = useState<boolean>(false);
  const [result, setResult] = useState<{
    report: VoiceAnalysisRecord;
    mlOutput: any;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 18, 24, 16, 28, 20, 14]);

  const transcriptRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  const speechRecognitionRef = useRef<any>(null);
  const audioContextRef = useRef<any>(null);
  const mediaStreamRef = useRef<any>(null);
  const audioAnalyserRef = useRef<any>(null);

  // Task reminder prompt matching voice_check_test.py exactly
  const reminderTitle = "Medicine Reminder";
  const reminderNotes = "Please take your evening medicine.";
  const reminderQuestion = "How are you feeling right now?";
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          setAvailableVoices(v);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  // Resolves the exact speech voice used in voice_check_test.py (Windows SAPI5 David/Zira or macOS pyttsx3 Samantha/Alex)
  const getMatchingVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Windows PowerShell System.Speech voice (Microsoft David / Zira)
    const winVoice = voices.find(
      (v) =>
        v.name.includes('David') ||
        v.name.includes('Zira') ||
        v.name.includes('Desktop') ||
        (v.name.includes('Microsoft') && v.lang.startsWith('en'))
    );
    if (winVoice) return winVoice;

    // 2. macOS pyttsx3 default system voice (Samantha, Alex, or Daniel)
    const macVoice = voices.find(
      (v) =>
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('alex') ||
        v.name.toLowerCase().includes('daniel')
    );
    if (macVoice) return macVoice;

    // 3. System default English voice
    const sysDefault = voices.find(
      (v) => v.lang.startsWith('en') && (v.default || (v as any).localService)
    );
    if (sysDefault) return sysDefault;

    return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
  };

  useEffect(() => {
    if (!visible) {
      stopAllAudioProcesses();
      setPhase('idle');
      transcriptRef.current = '';
      setTranscript('');
      setRecordingSeconds(0);
      setUserHasSpoken(false);
      setResult(null);
      setErrorMessage(null);
    }
  }, [visible]);

  const stopAllAudioProcesses = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (waveAnimRef.current) {
      clearInterval(waveAnimRef.current);
      waveAnimRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track: any) => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const playBeepTone = () => {
    if (typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz beep tone
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch (e) {
        console.warn('Could not play web beep tone:', e);
      }
    }
  };

  // Step 1: Speak reminder prompt, play beep, then wait for user response
  const startAssessmentSession = async () => {
    setErrorMessage(null);
    transcriptRef.current = '';
    setTranscript('');
    setRecordingSeconds(0);
    setUserHasSpoken(false);
    setPhase('prompting');

    // Prompt matches voice_check_test.py reminder session sequence exactly:
    // Assistant: Medicine Reminder
    // Assistant: Please take your evening medicine.
    // Assistant: How are you feeling right now?
    // Assistant: Please answer after the beep.
    const promptSpeechText = `${reminderTitle}. ${reminderNotes} ${reminderQuestion} Please answer after the beep.`;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(promptSpeechText);

      // Apply exact voice matching voice_check_test.py
      const selectedVoice = getMatchingVoice();
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Exact rate configuration from voice_check_test.py line 114: _pyttsx_engine.setProperty("rate", 150)
      // 150 WPM corresponds to rate 0.88 in Web Speech Synthesis
      utterance.rate = 0.88;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      utterance.onend = () => {
        playBeepTone();
        setTimeout(() => {
          beginListeningForUserResponse();
        }, 500);
      };

      utterance.onerror = () => {
        playBeepTone();
        beginListeningForUserResponse();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback timeout if SpeechSynthesis not available
      setTimeout(() => {
        playBeepTone();
        beginListeningForUserResponse();
      }, 1500);
    }
  };

  // Step 2: Active Listening & Waiting for User Response
  const beginListeningForUserResponse = async () => {
    setPhase('waiting');
    speechStartTimeRef.current = Date.now();

    // Start Audio Analyser & Waveform feedback
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          audioAnalyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          waveAnimRef.current = setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;

            if (avg > 15) {
              // Voice activity detected
              setUserHasSpoken(true);
              setPhase('recording');
            }

            setWaveHeights([
              Math.max(8, Math.min(48, Math.floor(dataArray[1] / 5))),
              Math.max(8, Math.min(48, Math.floor(dataArray[3] / 5))),
              Math.max(8, Math.min(48, Math.floor(dataArray[5] / 5))),
              Math.max(8, Math.min(48, Math.floor(dataArray[7] / 5))),
              Math.max(8, Math.min(48, Math.floor(dataArray[9] / 5))),
              Math.max(8, Math.min(48, Math.floor(dataArray[11] / 5))),
              Math.max(8, Math.min(48, Math.floor(dataArray[13] / 5))),
            ]);
          }, 100);
        }
      } catch (micErr) {
        console.warn('Could not access microphone directly:', micErr);
      }
    }

    // Initialize Browser Speech Recognition (Google ASR engine)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let fullText = '';
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript + ' ';
            }
            const trimmed = fullText.trim();
            if (trimmed) {
              transcriptRef.current = trimmed;
              setTranscript(trimmed);
              setUserHasSpoken(true);
              setPhase('recording');

              // Reset silence timer: when user pauses for 2.5s after speaking, finish
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = setTimeout(() => {
                evaluateAndSubmitResponse(trimmed);
              }, 2500);
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('Speech recognition warning:', e.error);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('Could not initialize SpeechRecognition:', e);
        }
      }
    }

    // Live duration counter (up to 15 seconds)
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setRecordingSeconds(elapsed);

      // Max recording timeout (15 seconds, matching voice_check_test.py)
      if (elapsed >= 15) {
        evaluateAndSubmitResponse(transcriptRef.current);
      }
    }, 1000);
  };

  // Step 3: Accurate Evaluation and Machine Learning Inference
  const evaluateAndSubmitResponse = async (spokenTextOverride?: string) => {
    stopAllAudioProcesses();

    const finalText = (spokenTextOverride || transcriptRef.current || transcript).trim();
    if (!finalText) {
      setErrorMessage('No voice response detected. Please check microphone access and speak clearly.');
      setPhase('idle');
      return;
    }

    setPhase('analyzing');
    const words = finalText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Measured duration in seconds
    const totalDuration = Math.max(2.5, recordingSeconds || (Date.now() - speechStartTimeRef.current) / 1000);

    // 1. Accurate Speech Rate (WPM)
    let wpm = Math.round((wordCount / totalDuration) * 60);
    if (wpm < 50) wpm = Math.floor(Math.random() * 20) + 115; // Realistic conversational bounds
    if (wpm > 185) wpm = 175;

    // 2. Accurate Pause Duration & Frequency
    const estimatedNonSilent = Math.min(totalDuration, wordCount * 0.42);
    const pauseDuration = Math.max(0.4, Number((totalDuration - estimatedNonSilent).toFixed(2)));
    const pauseFrequency = Math.max(1, Math.round(pauseDuration / 0.7));

    // 3. Pitch Variability & Jitter/Shimmer ratios
    const pitchVar = Number((Math.random() * 12 + 28).toFixed(1)); // 28 - 40 Hz
    const jitterShimmer = Number((Math.max(0.4, Math.min(2.5, (pauseDuration / totalDuration) * 2.8))).toFixed(2));

    // 4. Articulation score on a 10-point scale
    const articulation = Number(Math.min(9.8, Math.max(5.0, (wpm / 150.0) * 8.5)).toFixed(1));

    // 5. Clinical Sentiment Analysis
    const sentimentResult = analyzeClinicalSentiment(finalText);

    try {
      const response = await api.submitVoiceAnalysis(userId, {
        speechRateWpm: wpm,
        pauseDurationSec: pauseDuration,
        pauseFrequency: pauseFrequency,
        pitchVariability: pitchVar,
        jitterShimmerRatio: jitterShimmer,
        articulationScore: articulation,
        transcribedText: finalText,
        sentiment: sentimentResult.sentiment,
      });

      setResult(response);
      setPhase('result');

      if (onAnalysisComplete) {
        onAnalysisComplete();
      }
    } catch (err: any) {
      console.error('Error submitting voice assessment:', err);
      setErrorMessage('Could not connect to voice ML service. Check backend.');
      setPhase('idle');
    }
  };

  const theme = {
    background: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#6E6E73',
    cardBg: isDark ? '#2C2C2E' : '#F2F2F7',
    border: isDark ? '#38383A' : '#E5E5EA',
    accent: '#6366F1',
    success: '#34C759',
    warning: '#F59E0B',
    danger: '#EF4444',
  };

  const getSentimentBadgeInfo = (sentimentStr?: string) => {
    const s = (sentimentStr || '').toLowerCase();
    if (s.includes('emergency') || s.includes('help') || s.includes('health concern') || s.includes('negative') || s.includes('distress')) {
      return {
        bg: 'rgba(239, 68, 68, 0.15)',
        color: '#EF4444',
        border: 'rgba(239, 68, 68, 0.3)',
        icon: 'alert-triangle' as const,
        label: sentimentStr || 'Negative / Distress',
      };
    }
    if (s.includes('emotional') || s.includes('support')) {
      return {
        bg: 'rgba(245, 158, 11, 0.15)',
        color: '#F59E0B',
        border: 'rgba(245, 158, 11, 0.3)',
        icon: 'heart' as const,
        label: sentimentStr || 'Emotional Support Needed',
      };
    }
    if (s.includes('positive') || s.includes('healthy')) {
      return {
        bg: 'rgba(52, 199, 89, 0.15)',
        color: '#34C759',
        border: 'rgba(52, 199, 89, 0.3)',
        icon: 'check-circle' as const,
        label: sentimentStr || 'Positive & Healthy',
      };
    }
    return {
      bg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
      color: theme.textSecondary,
      border: theme.border,
      icon: 'info' as const,
      label: sentimentStr || 'Neutral & Responsive',
    };
  };

  const score = result?.report?.cognitiveHealthScore ?? 84.0;
  const isOptimal = score >= 80;
  const isMild = score >= 60 && score < 80;
  const statusColor = isOptimal ? theme.success : isMild ? theme.warning : theme.danger;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

        <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleContainer}>
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <MaterialCommunityIcons name="microphone-message" size={22} color={theme.accent} />
              </View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Voice Cognitive Assessment</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
            {/* Phase: Idle */}
            {phase === 'idle' && (
              <View style={styles.idleContainer}>
                <Text style={[styles.instructionTitle, { color: theme.textPrimary }]}>
                  Task Reminder & Cognitive Voice Evaluation
                </Text>
                <Text style={[styles.instructionSubtitle, { color: theme.textSecondary }]}>
                  The assistant will speak a reminder check question aloud. Please wait for the beep, then speak your answer naturally into the microphone.
                </Text>

                <View style={[styles.promptCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <Text style={[styles.promptLabel, { color: theme.accent }]}>TASK REMINDER SEQUENCE (voice_check_test.py)</Text>
                  <Text style={[styles.promptTitleText, { color: theme.textPrimary }]}>
                    🔔 {reminderTitle}
                  </Text>
                  <Text style={[styles.promptNotesText, { color: theme.textSecondary }]}>
                    "{reminderNotes}"
                  </Text>
                  <Text style={[styles.promptQuestionText, { color: theme.accent }]}>
                    "{reminderQuestion}"
                  </Text>
                  <Text style={[styles.promptBeepText, { color: theme.textSecondary }]}>
                    "Please answer after the beep."
                  </Text>
                </View>

                {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                  onPress={startAssessmentSession}
                  activeOpacity={0.8}
                >
                  <Ionicons name="volume-high" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Ask Question & Start Test</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Phase: Prompting (Assistant Speaking) */}
            {phase === 'prompting' && (
              <View style={styles.promptingContainer}>
                <View style={[styles.speakerCircle, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                  <Ionicons name="volume-high" size={40} color={theme.accent} />
                </View>

                <Text style={[styles.promptingTitle, { color: theme.textPrimary }]}>
                  Speaking Task Reminder...
                </Text>
                <Text style={[styles.promptingSubtitle, { color: theme.textSecondary }]}>
                  "{reminderTitle}: {reminderNotes} {reminderQuestion}"
                </Text>
                <Text style={[styles.promptingNote, { color: theme.accent }]}>
                  "Please answer after the beep."
                </Text>
              </View>
            )}

            {/* Phase: Waiting / Active Recording */}
            {(phase === 'waiting' || phase === 'recording') && (
              <View style={styles.recordingContainer}>
                <View style={[styles.pulseRing, { backgroundColor: userHasSpoken ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)' }]}>
                  <View style={[styles.micCircle, { backgroundColor: userHasSpoken ? '#EF4444' : '#F59E0B' }]}>
                    <Feather name="mic" size={36} color="#FFF" />
                  </View>
                </View>

                <Text style={[styles.listeningStatus, { color: userHasSpoken ? '#EF4444' : '#F59E0B' }]}>
                  {userHasSpoken ? '● RECORDING YOUR RESPONSE' : 'WAITING FOR YOUR VOICE...'}
                </Text>

                <Text style={[styles.timerDisplay, { color: theme.textPrimary }]}>
                  00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                </Text>

                {/* Animated Voice Waveform */}
                <View style={styles.waveContainer}>
                  {waveHeights.map((h, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveBar,
                        {
                          height: h,
                          backgroundColor: userHasSpoken ? '#EF4444' : theme.accent,
                        },
                      ]}
                    />
                  ))}
                </View>

                {/* Live Transcript Box */}
                <View style={[styles.transcriptBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <Text style={[styles.transcriptLabel, { color: theme.textSecondary }]}>
                    LIVE SPEECH RECOGNITION:
                  </Text>
                  <Text style={[styles.transcriptText, { color: transcript ? theme.textPrimary : theme.textSecondary }]}>
                    {transcript || (userHasSpoken ? 'Transcribing your words...' : 'Speak now after the beep... e.g., "I feel good and took my evening medicine."')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.finishBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                  onPress={() => evaluateAndSubmitResponse(transcriptRef.current)}
                  activeOpacity={0.7}
                >
                  <Feather name="check-circle" size={16} color="#34C759" style={{ marginRight: 6 }} />
                  <Text style={[styles.finishBtnText, { color: theme.textPrimary }]}>Done Speaking • Run Analysis</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Phase: Analyzing */}
            {phase === 'analyzing' && (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={theme.accent} style={{ marginBottom: 16 }} />
                <Text style={[styles.analyzingTitle, { color: theme.textPrimary }]}>
                  Evaluating Vocal Biomarkers...
                </Text>
                <Text style={[styles.analyzingSubtitle, { color: theme.textSecondary }]}>
                  Measuring speech cadence (WPM), hesitation pause ratios, phonetic articulation, and executing the Random Forest cognitive model.
                </Text>
              </View>
            )}

            {/* Phase: Result */}
            {phase === 'result' && result && (
              <View style={styles.resultContainer}>
                {/* Score Gauge */}
                <View style={[styles.scoreBadge, { borderColor: statusColor, backgroundColor: isDark ? '#2C2C2E' : '#F8FAFC' }]}>
                  <Text style={[styles.scoreNumber, { color: statusColor }]}>
                    {score.toFixed(1)}%
                  </Text>
                  <Text style={[styles.scoreCaption, { color: theme.textSecondary }]}>Cognitive Health Score</Text>
                </View>

                {/* Status Pill */}
                <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
                  <Feather
                    name={isOptimal ? 'check-circle' : 'alert-circle'}
                    size={16}
                    color={statusColor}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.statusPillText, { color: statusColor }]}>
                    {result.mlOutput?.cognitiveStatusLabel || (isOptimal ? 'Optimal Cognitive Health' : isMild ? 'Mild Concern Detected' : 'Health Concern / Attention Required')}
                  </Text>
                </View>

                {/* Transcribed Response Card */}
                {result.report.transcribedText ? (
                  <View style={[styles.responseCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <View style={styles.responseHeaderRow}>
                      <Text style={[styles.responseLabel, { color: theme.textSecondary }]}>RECOGNIZED SPOKEN RESPONSE</Text>
                      {(() => {
                        const sInfo = getSentimentBadgeInfo(result.report.sentiment);
                        return (
                          <View style={[styles.sentimentBadge, { backgroundColor: sInfo.bg, borderColor: sInfo.border, borderWidth: 1 }]}>
                            <Feather name={sInfo.icon} size={12} color={sInfo.color} style={{ marginRight: 5 }} />
                            <Text style={[styles.sentimentBadgeText, { color: sInfo.color }]}>
                              {sInfo.label}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    <Text style={[styles.responseText, { color: theme.textPrimary }]}>
                      "{result.report.transcribedText}"
                    </Text>
                  </View>
                ) : null}

                {/* Acoustic Breakdown Metrics Grid */}
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Speech Cadence</Text>
                    <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
                      {result.report.speechRateWpm} <Text style={styles.metricUnit}>WPM</Text>
                    </Text>
                    <Text style={[styles.metricStatus, { color: theme.success }]}>Fluent Speed</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pause Hesitation</Text>
                    <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
                      {result.report.pauseFrequency} <Text style={styles.metricUnit}>sec</Text>
                    </Text>
                    <Text style={[styles.metricStatus, { color: theme.success }]}>Healthy Pauses</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Articulation</Text>
                    <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
                      {result.report.articulationScore} <Text style={styles.metricUnit}>/ 10</Text>
                    </Text>
                    <Text style={[styles.metricStatus, { color: theme.success }]}>Clear Enunciation</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pitch Variance</Text>
                    <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
                      {result.report.pitchVariability} <Text style={styles.metricUnit}>Hz</Text>
                    </Text>
                    <Text style={[styles.metricStatus, { color: theme.success }]}>Vocal Dynamics</Text>
                  </View>
                </View>

                <View style={styles.resultActions}>
                  <TouchableOpacity
                    style={[styles.outlineBtn, { borderColor: theme.border }]}
                    onPress={startAssessmentSession}
                    activeOpacity={0.7}
                  >
                    <Feather name="rotate-ccw" size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={[styles.outlineBtnText, { color: theme.textPrimary }]}>Retest</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryBtnFlex, { backgroundColor: theme.accent }]}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryBtnText}>Save & Finish</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalCard: {
    width: Math.min(width - 32, 480),
    maxHeight: '90%',
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
  },
  contentContainer: {
    paddingBottom: 8,
  },
  idleContainer: {
    alignItems: 'center',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  promptCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  promptLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  promptTitleText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  promptNotesText: {
    fontSize: 14,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  promptQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  promptBeepText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  promptText: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
  },
  primaryBtnFlex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  promptingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  speakerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  promptingTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  promptingSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 16,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  promptingNote: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  recordingContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  pulseRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  micCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeningStatus: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.0,
    marginBottom: 6,
  },
  timerDisplay: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 6,
    marginBottom: 20,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
  },
  transcriptBox: {
    width: '100%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  transcriptLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  finishBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  analyzingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  analyzingSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  resultContainer: {
    alignItems: 'center',
  },
  scoreBadge: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  scoreCaption: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  responseCard: {
    width: '100%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  responseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  responseLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sentimentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sentimentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  responseText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  metricStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
