import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { api, FallRiskItem, SensorReadingItem, LatestSensorData } from '@/services/api';

export default function HealthDataScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { selectedUser } = useApp();

  const [fallRisks, setFallRisks] = useState<FallRiskItem[]>([]);
  const [readings, setReadings] = useState<SensorReadingItem[]>([]);
  const [sensorData, setSensorData] = useState<LatestSensorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const theme = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    accent: isDark ? '#38BDF8' : '#0EA5E9',
    border: isDark ? '#334155' : '#E2E8F0',
  };

  useEffect(() => {
    if (!selectedUser) return;
    const userId = selectedUser.id;
    async function loadHealthData() {
      try {
        setLoading(true);
        const [fr, sr] = await Promise.all([
          api.getUserFallRisks(userId).catch(() => []),
          api.getUserSensorReadings(userId).catch(() => []),
        ]);
        setFallRisks(fr);
        setReadings(sr);
      } catch (err) {
        console.error('Error loading health data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHealthData();
  }, [selectedUser]);

  useEffect(() => {
    async function pollSensor() {
      try {
        const data = await api.getLatestSensorData();
        setSensorData(data);
      } catch (err) {
        // Silently handle backend offline
      }
    }
    pollSensor();
    const interval = setInterval(pollSensor, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const latestFallRisk = fallRisks.length > 0 ? fallRisks[0] : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {selectedUser ? `${selectedUser.name}'s Health Data` : 'All Health Data'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.timestamp, { color: theme.textSecondary }]}>Last updated: {sensorData?.timestamp ? new Date(sensorData.timestamp).toLocaleTimeString() : currentTime}</Text>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          <>
            {/* Heart Rate Card */}
            <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.cardInfo}>
                <View style={styles.iconContainer}>
                  <Feather name="heart" size={24} color="#EF4444" />
                </View>
                <View>
                  <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Heart Rate (MAX30102)</Text>
                  <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                    {sensorData?.heartRate !== null && sensorData?.heartRate !== undefined ? `${sensorData.heartRate} BPM` : '-- BPM'}
                  </Text>
                </View>
              </View>
              <View style={styles.mockGraph}>
                <View style={[styles.graphBar, { height: '30%', backgroundColor: '#EF4444' }]} />
                <View style={[styles.graphBar, { height: '50%', backgroundColor: '#EF4444' }]} />
                <View style={[styles.graphBar, { height: '40%', backgroundColor: '#EF4444' }]} />
                <View style={[styles.graphBar, { height: '70%', backgroundColor: '#EF4444' }]} />
                <View style={[styles.graphBar, { height: '60%', backgroundColor: '#EF4444' }]} />
                <View style={[styles.graphBar, { height: '80%', backgroundColor: '#EF4444' }]} />
              </View>
            </View>

            {/* Blood Oxygen SpO2 Card */}
            <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.cardInfo}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="water-percent" size={28} color="#0EA5E9" />
                </View>
                <View>
                  <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Blood Oxygen (SpO2)</Text>
                  <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                    {sensorData?.spo2 !== null && sensorData?.spo2 !== undefined ? `${sensorData.spo2}%` : '--'}
                  </Text>
                </View>
              </View>
              <View style={styles.mockGraph}>
                <View style={[styles.graphBar, { height: '80%', backgroundColor: '#0EA5E9' }]} />
                <View style={[styles.graphBar, { height: '85%', backgroundColor: '#0EA5E9' }]} />
                <View style={[styles.graphBar, { height: '90%', backgroundColor: '#0EA5E9' }]} />
                <View style={[styles.graphBar, { height: '85%', backgroundColor: '#0EA5E9' }]} />
                <View style={[styles.graphBar, { height: '80%', backgroundColor: '#0EA5E9' }]} />
                <View style={[styles.graphBar, { height: '85%', backgroundColor: '#0EA5E9' }]} />
              </View>
            </View>

            {/* Fall Risk Card */}
            {(() => {
              const isFall = Boolean(sensorData?.fallDetected);
              return (
                <View
                  style={[
                    styles.dataCard,
                    {
                      backgroundColor: isFall ? (isDark ? '#451A1A' : '#FEF2F2') : theme.cardBg,
                      borderColor: isFall ? '#EF4444' : theme.border,
                      borderWidth: isFall ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.cardInfo}>
                    <View style={[styles.iconContainer, { backgroundColor: isFall ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.03)' }]}>
                      <MaterialCommunityIcons
                        name={isFall ? 'alert-circle' : 'alert-rhombus-outline'}
                        size={26}
                        color={isFall ? '#EF4444' : '#F59E0B'}
                      />
                    </View>
                    <View>
                      <Text style={[styles.cardLabel, { color: isFall ? '#DC2626' : theme.textSecondary }]}>
                        {isFall ? 'Emergency Assessment' : 'Fall Risk Assessment'}
                      </Text>
                      <Text style={[styles.cardValue, { color: isFall ? '#EF4444' : theme.textPrimary }]}>
                        {isFall ? 'FALL DETECTED!' : (latestFallRisk ? latestFallRisk.riskLevel : 'LOW')}
                      </Text>
                      <Text style={{ fontSize: 13, color: isFall ? '#DC2626' : theme.textSecondary, marginTop: 2 }}>
                        Event: {isFall ? 'FALL_DETECTED' : (latestFallRisk ? latestFallRisk.eventType : 'NORMAL')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.mockGraph}>
                    <View style={[styles.graphBar, { height: isFall ? '100%' : '40%', backgroundColor: isFall ? '#EF4444' : '#F59E0B' }]} />
                    <View style={[styles.graphBar, { height: isFall ? '100%' : '30%', backgroundColor: isFall ? '#EF4444' : '#F59E0B' }]} />
                    <View style={[styles.graphBar, { height: isFall ? '100%' : '20%', backgroundColor: isFall ? '#EF4444' : '#F59E0B' }]} />
                    <View style={[styles.graphBar, { height: isFall ? '100%' : '15%', backgroundColor: isFall ? '#EF4444' : '#F59E0B' }]} />
                    <View style={[styles.graphBar, { height: isFall ? '100%' : '10%', backgroundColor: isFall ? '#EF4444' : '#F59E0B' }]} />
                  </View>
                </View>
              );
            })()}

            {/* Sensor Readings Summary */}
            <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border, flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="chip" size={24} color="#10B981" />
                </View>
                <View>
                  <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>ESP32 Live Sensor Stream</Text>
                  <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                    MPU6050
                  </Text>
                </View>
              </View>

              <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 }}>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
                  Accel: X={sensorData?.ax?.toFixed(2) ?? '0.00'}, Y={sensorData?.ay?.toFixed(2) ?? '0.00'}, Z={sensorData?.az?.toFixed(2) ?? '0.00'}
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
                  Gyro: X={sensorData?.gx?.toFixed(2) ?? '0.00'}, Y={sensorData?.gy?.toFixed(2) ?? '0.00'}, Z={sensorData?.gz?.toFixed(2) ?? '0.00'}
                </Text>
                {sensorData?.ir !== null && sensorData?.ir !== undefined && (
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                    Raw MAX30102: IR={sensorData.ir}, RED={sensorData.red ?? 'N/A'}
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
  },
  timestamp: {
    fontSize: 14,
    marginBottom: 20,
    fontWeight: '500',
  },
  dataCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  mockGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
    width: 80,
  },
  graphBar: {
    width: 8,
    borderRadius: 4,
    opacity: 0.8,
  },
});
