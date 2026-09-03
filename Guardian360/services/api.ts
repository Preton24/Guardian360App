import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Automatically detect host IP from Expo Metro bundler (e.g. 192.168.0.7:8081 -> http://192.168.0.7:5000)
const getDevServerUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Extract Metro host IP address dynamically when running on physical device / Expo Go
  const hostUri = Constants.expoConfig?.hostUri || (Constants.manifest as any)?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }

  // Fallback defaults
  return Platform.select({
    android: 'http://10.0.2.2:5000',
    default: 'http://localhost:5000',
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
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  heartRate: number | null;
  spo2: number | null;
  ir: number | null;
  red: number | null;
  fallDetected?: boolean;
  timestamp?: string;
}


async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[API Timeout ${endpoint}]: Connection timed out to ${url}`);
      throw new Error(`Connection timed out to ${url}. Make sure your Express backend server is running on port 5000.`);
    }
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
  getUserReminders: (userId: string) => request<ReminderItem[]>(`/api/users/${userId}/reminders`),
  createReminder: (
    userId: string,
    data: {
      title: string;
      notes?: string;
      date?: string;
      time?: string;
      urgent?: boolean;
      category?: 'MEDS' | 'TASK' | 'HABIT';
    }
  ) =>
    request<ReminderItem>(`/api/users/${userId}/reminders`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  patchReminder: (
    reminderId: string,
    data: { completed?: boolean; title?: string; notes?: string; urgent?: boolean; category?: string }
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
};
