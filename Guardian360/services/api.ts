import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Automatically detect host IP from Web environment, Expo Metro bundler, or fallback to active LAN IP
const getDevServerUrl = (): string => {
  // On Web, always communicate with backend via current browser hostname (e.g. localhost or LAN IP)
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:5001`;
    }
    return 'http://localhost:5001';
  }

  // Extract Metro host IP address dynamically across various Expo versions and platforms
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).experienceUrl;

  if (hostUri && typeof hostUri === 'string') {
    const rawHost = hostUri.replace(/^[a-z]+:\/\//i, '');
    const ip = rawHost.split(':')[0].split('/')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5001`;
    }
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Fallback: Use active Mac Wi-Fi LAN IP so physical devices connect seamlessly
  return Platform.select({
    android: 'http://192.168.1.105:5001',
    ios: 'http://192.168.1.105:5001',
    default: 'http://localhost:5001',
  }) as string;
};

export const API_BASE_URL = getDevServerUrl();

console.log(`[Guardian360 API] Connected to Backend URL: ${API_BASE_URL}`);

export interface Caretaker {
  id: string;
  name: string;
  email: string;
  contact: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ElderlyUser {
  id: string;
  name: string;
  age: number;
  relation: string;
  contact: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReminderItem {
  id: string;
  userId: string;
  title: string;
  notes?: string | null;
  date: string;
  time?: string | null;
  urgent: boolean;
  category: 'MEDS' | 'TASK' | 'HABIT';
  repeat?: string | null;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FallRiskItem {
  id: string;
  userId: string;
  timestamp: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  eventType: 'NORMAL' | 'ABNORMAL_GAIT' | 'FALL_RISK' | 'FALL_DETECTED';
}

export interface SensorReadingItem {
  id: string;
  userId: string;
  timestamp: string;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export interface LatestSensorData {
  id?: string;
  userId?: string;
  timestamp?: string;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  heartRate?: number;
  spO2?: number;
  spo2?: number;
  ir?: number;
  red?: number;
  fallDetected?: boolean;
}

export interface VoiceAnalysisRecord {
  id: string;
  userId: string;
  timestamp: string;
  speechRateWpm: number;
  pauseFrequency: number;
  pauseDurationSec?: number;
  pitchVariability: number;
  jitterShimmerRatio: number;
  articulationScore: number;
  cognitiveHealthScore: number;
  cognitiveStatus: string;
  confidenceScore: number;
  transcribedText?: string;
  sentiment?: string;
}

export interface CognitiveTrendData {
  userId: string;
  count: number;
  averageHealthScore: number;
  currentStatus: string;
  latestReport: VoiceAnalysisRecord | null;
  trends: VoiceAnalysisRecord[];
}


async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Connection timed out to ${url}. Make sure your Express backend server is running on port 5001.`));
      }, 10000);
    });

    const fetchPromise = (async () => {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    })();

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error: any) {
    console.warn(`[API Error ${endpoint}]:`, error.message || error);
    throw error;
  }
}

export const api = {
  // Caretakers CRUD
  getAllCaretakers: () => request<Caretaker[]>('/api/caretakers'),
  getCurrentCaretaker: () => request<Caretaker>('/api/caretakers/current'),
  createCaretaker: (data: { name: string; email: string; contact: string }) =>
    request<Caretaker>('/api/caretakers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCaretaker: (caretakerId: string, data: { name?: string; email?: string; contact?: string }) =>
    request<Caretaker>(`/api/caretakers/${caretakerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCaretaker: (caretakerId: string) =>
    request<{ success: boolean; message: string }>(`/api/caretakers/${caretakerId}`, {
      method: 'DELETE',
    }),

  getCaretakerUsers: (caretakerId: string) => request<ElderlyUser[]>(`/api/caretakers/${caretakerId}/users`),
  addElderlyUser: (caretakerId: string, data: { name: string; age: number; relation: string; contact: string }) =>
    request<ElderlyUser>(`/api/caretakers/${caretakerId}/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Elderly Users CRUD
  getElderlyUser: (userId: string) => request<ElderlyUser>(`/api/users/${userId}`),
  updateElderlyUser: (userId: string, data: { name?: string; age?: number; relation?: string; contact?: string }) =>
    request<ElderlyUser>(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteElderlyUser: (userId: string) =>
    request<{ success: boolean; message: string }>(`/api/users/${userId}`, {
      method: 'DELETE',
    }),

  // Reminders
  getUserReminders: (userId: string) => {
    const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const tzOffset = new Date().getTimezoneOffset();
    return request<ReminderItem[]>(`/api/users/${userId}/reminders?clientDate=${localDate}&tzOffset=${tzOffset}`);
  },
  resetRepeatingReminders: (userId: string) => {
    const localDate = new Date().toLocaleDateString('en-CA');
    return request<{ success: boolean; message: string; count: number }>(`/api/users/${userId}/reminders/reset-repeating`, {
      method: 'POST',
      body: JSON.stringify({ clientDate: localDate }),
    });
  },
  createReminder: (
    userId: string,
    data: {
      title: string;
      notes?: string;
      date?: string;
      time?: string;
      urgent?: boolean;
      category?: 'MEDS' | 'TASK' | 'HABIT';
      repeat?: string;
    }
  ) =>
    request<ReminderItem>(`/api/users/${userId}/reminders`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  patchReminder: (
    reminderId: string,
    data: { completed?: boolean; title?: string; notes?: string; urgent?: boolean; category?: string; repeat?: string }
  ) =>
    request<ReminderItem>(`/api/reminders/${reminderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteReminder: (reminderId: string) =>
    request<{ success: boolean }>(`/api/reminders/${reminderId}`, {
      method: 'DELETE',
    }),

  // Fall Risks
  getUserFallRisks: (userId: string) => request<FallRiskItem[]>(`/api/users/${userId}/fall-risks`),
  createFallRisk: (
    userId: string,
    data: { riskLevel?: string; riskScore?: number; eventType?: string }
  ) =>
    request<FallRiskItem>(`/api/users/${userId}/fall-risks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Sensor Readings
  getUserSensorReadings: (userId: string) => request<SensorReadingItem[]>(`/api/users/${userId}/sensor-readings`),
  createSensorReading: (
    userId: string,
    data: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number }
  ) =>
    request<SensorReadingItem>(`/api/users/${userId}/sensor-readings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLatestSensorData: () => request<LatestSensorData>('/data'),
  simulateSensorData: (data: Partial<LatestSensorData> & { fallDetected?: boolean; location?: string }) =>
    request<{ success: boolean; data: LatestSensorData }>('/data', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Voice Analysis & Cognitive Trends (ML Random Forest)
  getUserCognitiveTrends: (userId: string) => request<CognitiveTrendData>(`/api/users/${userId}/cognitive-trends`),
  submitVoiceAnalysis: (
    userId: string,
    data: {
      speechRateWpm?: number;
      pauseDurationSec?: number;
      pauseFrequency?: number;
      pitchVariability?: number;
      jitterShimmerRatio?: number;
      articulationScore?: number;
      transcribedText?: string;
      sentiment?: string;
    }
  ) =>
    request<{ success: boolean; report: VoiceAnalysisRecord; mlOutput: any }>('/api/voice-analysis', {
      method: 'POST',
      body: JSON.stringify({ userId, ...data }),
    }),
};
