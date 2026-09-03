import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { useApp } from '@/context/AppContext';
import { api, ReminderItem, FallRiskItem, LatestSensorData } from '@/services/api';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { caretaker, elderlyUsers, selectedUser, setSelectedUser, loading: appLoading } = useApp();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [fallRisks, setFallRisks] = useState<FallRiskItem[]>([]);
  const [sensorData, setSensorData] = useState<LatestSensorData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(false);

  // Fall Alert holding state & Audio sound player
  const [isFallAlertActive, setIsFallAlertActive] = useState<boolean>(false);
  const fallHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const theme = {
    background: isDark ? '#000000' : '#F2F2F7',
    cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    accent: '#007AFF',
    border: isDark ? '#38383A' : '#C6C6C8',
    successBg: 'rgba(52, 199, 89, 0.1)',
    successText: '#34C759',
    alertBg: 'rgba(255, 59, 48, 0.1)',
    alertText: '#FF3B30',
  };

  const playAlarmSound = async () => {
    console.log('[Guardian360] 🔊 Playing Fall Emergency Alarm Sound...');
    // 1. Web Environment Fallback
    if (typeof window !== 'undefined' && typeof window.Audio !== 'undefined') {
      try {
        const webAudio = new window.Audio('https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3');
        webAudio.volume = 1.0;
        const playPromise = webAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => console.warn('[Web Audio] Autoplay error:', err));
        }
      } catch (e) {
        console.warn('[Web Audio] Sound play error:', e);
      }
    }

    // 2. Native Expo AV Audio
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      }).catch(() => {});

      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
      }

      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/mixkit-classic-alarm-995.mp3'),
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync().catch(() => {});
    } catch (err) {
      console.warn('[Expo AV] Could not play alarm sound:', err);
    }
  };

  const fetchUserMetrics = useCallback(async () => {
    if (!selectedUser) {
      setReminders([]);
      setFallRisks([]);
      return;
    }
    try {
      setLoadingMetrics(true);
      const [fetchedReminders, fetchedFallRisks] = await Promise.all([
        api.getUserReminders(selectedUser.id).catch(() => []),
        api.getUserFallRisks(selectedUser.id).catch(() => []),
      ]);
      setReminders(fetchedReminders);
      setFallRisks(fetchedFallRisks);
    } catch (err) {
      console.error('Error fetching user metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, [selectedUser]);

  const fetchSensorData = useCallback(async () => {
    try {
      const data = await api.getLatestSensorData();
      setSensorData(data);
    } catch (err) {
      // Silently handle backend offline
    }
  }, []);

  useEffect(() => {
    fetchUserMetrics();
  }, [fetchUserMetrics]);

  useEffect(() => {
    fetchSensorData();
    const interval = setInterval(fetchSensorData, 3000);
    return () => clearInterval(interval);
  }, [fetchSensorData]);

  const latestFallRisk = fallRisks.length > 0 ? fallRisks[0] : null;

  // Realtime check if live sensor hardware is currently reporting a fall
  const rawFallDetected = Boolean(sensorData?.fallDetected);

  useEffect(() => {
    if (rawFallDetected) {
      if (fallHoldTimerRef.current) {
        clearTimeout(fallHoldTimerRef.current);
        fallHoldTimerRef.current = null;
      }
      if (!isFallAlertActive) {
        setIsFallAlertActive(true);
        playAlarmSound();
      }
    } else if (isFallAlertActive && !fallHoldTimerRef.current) {
      // Keep red card alert for extra 1.5 seconds before resetting
      fallHoldTimerRef.current = setTimeout(() => {
        setIsFallAlertActive(false);
        fallHoldTimerRef.current = null;
      }, 1500);
    }
  }, [rawFallDetected, isFallAlertActive]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      if (fallHoldTimerRef.current) {
        clearTimeout(fallHoldTimerRef.current);
      }
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Top Section */}
        <Animated.View entering={FadeInUp.delay(100).duration(800)} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, { color: theme.textSecondary }]}>
                Caretaker: {caretaker?.name || 'Steve Rogers'}
              </Text>
              <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                {selectedUser ? selectedUser.name : 'No User Selected'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.mapIconBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => router.push('/location')}
            >
              <Feather name="map" size={22} color={theme.accent} />
            </TouchableOpacity>
          </View>

          {/* Elderly User Selector Pills */}
          {elderlyUsers.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.userSelectorScroll}>
              {elderlyUsers.map((user) => {
                const isSelected = selectedUser?.id === user.id;
                return (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.userPill,
                      {
                        backgroundColor: isSelected ? theme.accent : theme.cardBg,
                        borderColor: isSelected ? theme.accent : theme.border,
                      },
                    ]}
                    onPress={() => setSelectedUser(user)}
                  >
                    <Ionicons
                      name="person"
                      size={14}
                      color={isSelected ? '#FFF' : theme.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.userPillText,
                        { color: isSelected ? '#FFF' : theme.textPrimary },
                      ]}
                    >
                      {user.name} ({user.relation})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>

        {/* Health Overview (2x2 Grid) */}
        <Animated.View entering={FadeInUp.delay(300).duration(800)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Health Overview</Text>
          <View style={styles.gridContainer}>
            {/* Heart Rate Card */}
            <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Feather name="heart" size={24} color="#EF4444" />
                <View style={styles.liveIndicator} />
              </View>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {sensorData?.heartRate !== null && sensorData?.heartRate !== undefined ? sensorData.heartRate : '--'} <Text style={styles.cardUnit}>BPM</Text>
              </Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Heart Rate</Text>
            </View>

            {/* SpO2 / Pulse Card */}
            <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="water-percent" size={28} color="#0EA5E9" />
              </View>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {sensorData?.spo2 !== null && sensorData?.spo2 !== undefined ? `${sensorData.spo2}%` : '--'} <Text style={styles.cardUnit}>SpO2</Text>
              </Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Blood Oxygen</Text>
            </View>

            {/* Fall Risk Card */}
            {(() => {
              const isFall = isFallAlertActive || rawFallDetected;
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
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons
                      name={isFall ? 'alert-circle' : 'alert-rhombus-outline'}
                      size={26}
                      color={isFall ? '#EF4444' : '#F59E0B'}
                    />
                    {isFall && <View style={[styles.liveIndicator, { backgroundColor: '#EF4444' }]} />}
                  </View>
                  <Text style={[styles.cardValue, { color: isFall ? '#EF4444' : theme.textPrimary, fontSize: isFall ? 18 : 24 }]}>
                    {isFall ? 'FALL DETECTED!' : (latestFallRisk ? latestFallRisk.riskLevel : 'LOW')}
                    {!isFall && (
                      <Text style={styles.cardUnit}>
                        / {latestFallRisk ? (Number(latestFallRisk.riskScore) * 100).toFixed(0) + '%' : 'Normal'}
                      </Text>
                    )}
                  </Text>
                  <Text style={[styles.cardLabel, { color: isFall ? '#DC2626' : theme.textSecondary, fontWeight: isFall ? '700' : '500' }]}>
                    {isFall ? 'EMERGENCY ALERT' : 'Fall Risk'}
                  </Text>
                </View>
              );
            })()}

            {/* Reminders Card */}
            <TouchableOpacity
              style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => router.push('/reminders-list')}
            >
              <View style={styles.cardHeader}>
                <Feather name="check-square" size={24} color="#10B981" />
              </View>

              <View style={{ marginVertical: 2 }}>
                {reminders.length === 0 ? (
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>No active reminders</Text>
                ) : (
                  reminders.slice(0, 2).map((item) => (
                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Feather
                        name={item.completed ? 'check-circle' : 'circle'}
                        size={14}
                        color={item.completed ? '#10B981' : theme.textSecondary}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          color: item.completed ? theme.textSecondary : theme.textPrimary,
                          marginLeft: 6,
                          textDecorationLine: item.completed ? 'line-through' : 'none',
                        }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </View>
                  ))
                )}
              </View>
              <Text style={[styles.cardLabel, { color: theme.textSecondary, marginTop: 'auto' }]}>Reminders</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Cognitive Trend Section */}
        <Animated.View entering={FadeInUp.delay(500).duration(800)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Cognitive Trend</Text>

          <View
            style={[
              styles.largeTrendCard,
              { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 0, overflow: 'hidden' },
            ]}
          >
            <Image
              source={{ uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6Cai6gSoxEG4G-p-xBq78DTmjMI6P0xYtJzSuLIl5Lw&s' }}
              style={{ width: '100%', height: 220 }}
              contentFit="cover"
            />
          </View>
          <TouchableOpacity
            style={[styles.showAllButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={() => router.push('/health-data')}
          >
            <Text style={[styles.showAllText, { color: theme.accent }]}>Show all health data</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Selected User Details Card */}
        {selectedUser && (
          <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.section}>
            <View style={[styles.caretakerButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.caretakerInfo}>
                <View style={[styles.caretakerAvatar, { backgroundColor: theme.accent }]}>
                  <Text style={styles.caretakerInitials}>
                    {selectedUser.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.caretakerRole, { color: theme.textSecondary }]}>
                    {selectedUser.relation} • {selectedUser.age} yrs
                  </Text>
                  <Text style={[styles.caretakerName, { color: theme.textPrimary }]}>{selectedUser.name}</Text>
                  <Text style={[styles.caretakerRole, { color: theme.textSecondary }]}>{selectedUser.contact}</Text>
                </View>
              </View>
              <View style={[styles.callButton, { backgroundColor: theme.successBg }]}>
                <Feather name="phone" size={20} color={theme.successText} />
              </View>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  mapIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  userSelectorScroll: {
    marginTop: 16,
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  userPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  dataCard: {
    width: (width - 40 - 16) / 2,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    height: 28,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardUnit: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  showAllButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  showAllText: {
    fontSize: 16,
    fontWeight: '600',
  },
  largeTrendCard: {
    borderRadius: 24,
    borderWidth: 1,
  },
  caretakerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  caretakerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  caretakerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  caretakerInitials: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  caretakerRole: {
    fontSize: 12,
  },
  caretakerName: {
    fontSize: 17,
    fontWeight: '600',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
