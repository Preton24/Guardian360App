import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useApp } from '@/context/AppContext';
import { api, ReminderItem, FallRiskItem, LatestSensorData } from '@/services/api';
import { alarmSound } from '@/services/alarmSound';
import { CognitiveTrendChart } from '@/components/cognitive-trend-chart';
import { VoiceAssessmentModal } from '@/components/voice-assessment-modal';

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
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [cognitiveRefreshTrigger, setCognitiveRefreshTrigger] = useState<number>(0);

  // Fall Alert holding state & Audio sound player
  const [isFallAlertActive, setIsFallAlertActive] = useState<boolean>(false);
  const [isSimulatingFall, setIsSimulatingFall] = useState<boolean>(false);
  const [showEmergencyFallDialog, setShowEmergencyFallDialog] = useState<boolean>(false);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState<boolean>(false);
  const fallHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


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
    inputBg: isDark ? '#2C2C2E' : '#F2F2F7',
  };

  const playAlarmSound = async () => {
    try {
      await alarmSound.play();
    } catch (err) {
      console.warn('[Guardian360] Could not play alarm sound:', err);
    }
  };

  const handleCall = async (phoneNumber: string = '+91 7619359520') => {
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    const telUrl = `tel:${cleanNumber}`;

    try {
      const supported = await Linking.canOpenURL(telUrl);
      if (supported) {
        await Linking.openURL(telUrl);
      } else {
        // Fallback for device/simulator environments
        Linking.openURL(telUrl).catch(() => {
          Alert.alert('Phone Call', `Dialing ${phoneNumber}`, [{ text: 'OK' }]);
        });
      }
    } catch (error) {
      console.warn('Could not launch phone dialer:', error);
      Alert.alert('Phone Call', `Dialing ${phoneNumber}`);
    }
  };

  const handleSimulateFall = async () => {
    try {
      setIsSimulatingFall(true);
      console.log('[Guardian360] 🚨 Initiating Fall Emergency Simulation...');

      // 1. Immediately trigger siren audio & UI alert
      playAlarmSound();
      setIsFallAlertActive(true);
      setShowEmergencyFallDialog(true);

      // 2. Transmit critical sensor telemetry to backend
      // Backend automatically registers CRITICAL FallRisk in DB and dispatches automated OmniDimension voice call to caretaker
      await api.simulateSensorData({
        fallDetected: true,
        ax: 0.18,
        ay: 0.24,
        az: -2.95,
        gx: 145.0,
        gy: 230.0,
        gz: 110.0,
        location: 'Living Room (Simulated Test)',
      });

      // 3. Refresh user metrics to show new fall risk in real-time
      fetchUserMetrics();
    } catch (err: any) {
      console.warn('[Fall Simulation Error]:', err);
    } finally {
      setIsSimulatingFall(false);
    }
  };

  const handleDismissFallEmergency = async () => {
    setShowEmergencyFallDialog(false);
    setIsFallAlertActive(false);

    try {
      await alarmSound.stop();
    } catch (_) {}

    try {
      await api.simulateSensorData({
        fallDetected: false,
        ax: 0.04,
        ay: 0.08,
        az: -0.98,
        gx: 0,
        gy: 0,
        gz: 0,
      });
      fetchUserMetrics();
    } catch (e) {}
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchUserMetrics(),
        fetchSensorData(),
      ]);
      setCognitiveRefreshTrigger((prev) => prev + 1);
    } catch (e) {
      // Ignored
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserMetrics, fetchSensorData]);

  useEffect(() => {
    fetchUserMetrics();
  }, [fetchUserMetrics]);

  useEffect(() => {
    fetchSensorData();
    const interval = setInterval(fetchSensorData, 1500);
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
      // Keep red alert active for extra 3 seconds before resetting so it's not missed
      fallHoldTimerRef.current = setTimeout(() => {
        setIsFallAlertActive(false);
        fallHoldTimerRef.current = null;
      }, 3000);
    }
  }, [rawFallDetected, isFallAlertActive]);

  useEffect(() => {
    return () => {
      alarmSound.stop().catch(() => {});
      if (fallHoldTimerRef.current) {
        clearTimeout(fallHoldTimerRef.current);
      }
    };
  }, []);

  const isFall = isFallAlertActive || rawFallDetected;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {/* Real-time Emergency Fall Alert Banner */}
        {(isFallAlertActive || rawFallDetected) && (
          <Animated.View entering={FadeInUp.duration(300)} style={styles.emergencyTopBanner}>
            <View style={styles.emergencyTopBannerContent}>
              <View style={styles.emergencyTopBannerIcon}>
                <MaterialCommunityIcons name="alarm-light" size={26} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.emergencyTopBannerTitle}>🚨 CRITICAL ALERT: FALL DETECTED!</Text>
                <Text style={styles.emergencyTopBannerSub}>
                  Hardware motion telemetry recorded an active impact fall. Tap to view emergency details.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.emergencyTopBannerBtn}
                onPress={() => setShowEmergencyFallDialog(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.emergencyTopBannerBtnText}>VIEW</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

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
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerCallBtn, { backgroundColor: theme.successBg }]}
                onPress={() => handleCall('+91 9731933073')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Call +91 9731933073"
              >
                <Feather name="phone-call" size={18} color={theme.successText} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapIconBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => router.push('/location')}
              >
                <Feather name="map" size={20} color={theme.accent} />
              </TouchableOpacity>
            </View>
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

        {/* Live Hardware Sensor Telemetry (MPU6050 & Hardware Stream) */}
        <Animated.View entering={FadeInUp.delay(400).duration(800)} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 0 }]}>
              Live Sensor Telemetry
            </Text>
            <View style={[styles.liveStatusBadge, { backgroundColor: isFall ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
              <View style={[styles.liveStatusDot, { backgroundColor: isFall ? '#EF4444' : '#10B981' }]} />
              <Text style={[styles.liveStatusText, { color: isFall ? '#EF4444' : '#10B981' }]}>
                {isFall ? 'FALL DETECTED' : 'HARDWARE ACTIVE'}
              </Text>
            </View>
          </View>

          <View style={[styles.telemetryCard, { backgroundColor: theme.cardBg, borderColor: isFall ? '#EF4444' : theme.border, borderWidth: isFall ? 2 : 1 }]}>
            {/* Realtime Fall Alert Bar inside Card */}
            <View style={[styles.telemetryStatusBanner, { backgroundColor: isFall ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)' }]}>
              <MaterialCommunityIcons
                name={isFall ? 'alert-octagon' : 'check-decagram'}
                size={20}
                color={isFall ? '#EF4444' : '#10B981'}
              />
              <Text style={[styles.telemetryStatusText, { color: isFall ? '#EF4444' : '#10B981' }]}>
                {isFall
                  ? '⚠️ Active Impact Fall Detected! Immediate assistance required.'
                  : 'Normal Gait & Posture • No Fall Detected'}
              </Text>
            </View>

            {/* MPU6050 Accelerometer */}
            <View style={styles.telemetryBlock}>
              <View style={styles.telemetryBlockHeader}>
                <MaterialCommunityIcons name="axis-arrow" size={16} color={theme.accent} />
                <Text style={[styles.telemetryBlockTitle, { color: theme.textSecondary }]}>
                  ACCELEROMETER (MPU6050)
                </Text>
                <Text style={[styles.telemetryUnit, { color: theme.textSecondary }]}>m/s²</Text>
              </View>
              <View style={styles.axisGrid}>
                <View style={[styles.axisBox, { backgroundColor: theme.inputBg }]}>
                  <Text style={[styles.axisTag, { color: theme.textSecondary }]}>AX</Text>
                  <Text style={[styles.axisNum, { color: theme.textPrimary }]}>
                    {sensorData?.ax !== undefined && sensorData?.ax !== null ? Number(sensorData.ax).toFixed(2) : '0.00'}
                  </Text>
                </View>
                <View style={[styles.axisBox, { backgroundColor: theme.inputBg }]}>
                  <Text style={[styles.axisTag, { color: theme.textSecondary }]}>AY</Text>
                  <Text style={[styles.axisNum, { color: theme.textPrimary }]}>
                    {sensorData?.ay !== undefined && sensorData?.ay !== null ? Number(sensorData.ay).toFixed(2) : '0.00'}
                  </Text>
                </View>
                <View style={[styles.axisBox, { backgroundColor: theme.inputBg }]}>
                  <Text style={[styles.axisTag, { color: theme.textSecondary }]}>AZ</Text>
                  <Text style={[styles.axisNum, { color: theme.textPrimary }]}>
                    {sensorData?.az !== undefined && sensorData?.az !== null ? Number(sensorData.az).toFixed(2) : '9.81'}
                  </Text>
                </View>
              </View>
            </View>

            {/* MPU6050 Gyroscope */}
            <View style={styles.telemetryBlock}>
              <View style={styles.telemetryBlockHeader}>
                <MaterialCommunityIcons name="compass-outline" size={16} color="#8B5CF6" />
                <Text style={[styles.telemetryBlockTitle, { color: theme.textSecondary }]}>
                  GYROSCOPE (MPU6050)
                </Text>
                <Text style={[styles.telemetryUnit, { color: theme.textSecondary }]}>°/s</Text>
              </View>
              <View style={styles.axisGrid}>
                <View style={[styles.axisBox, { backgroundColor: theme.inputBg }]}>
                  <Text style={[styles.axisTag, { color: theme.textSecondary }]}>GX</Text>
                  <Text style={[styles.axisNum, { color: theme.textPrimary }]}>
                    {sensorData?.gx !== undefined && sensorData?.gx !== null ? Number(sensorData.gx).toFixed(2) : '0.00'}
                  </Text>
                </View>
                <View style={[styles.axisBox, { backgroundColor: theme.inputBg }]}>
                  <Text style={[styles.axisTag, { color: theme.textSecondary }]}>GY</Text>
                  <Text style={[styles.axisNum, { color: theme.textPrimary }]}>
                    {sensorData?.gy !== undefined && sensorData?.gy !== null ? Number(sensorData.gy).toFixed(2) : '0.00'}
                  </Text>
                </View>
                <View style={[styles.axisBox, { backgroundColor: theme.inputBg }]}>
                  <Text style={[styles.axisTag, { color: theme.textSecondary }]}>GZ</Text>
                  <Text style={[styles.axisNum, { color: theme.textPrimary }]}>
                    {sensorData?.gz !== undefined && sensorData?.gz !== null ? Number(sensorData.gz).toFixed(2) : '0.00'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Footer with Timestamp */}
            <View style={[styles.telemetryFooter, { borderTopColor: theme.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="clock" size={12} color={theme.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.telemetryTimestamp, { color: theme.textSecondary }]}>
                  {sensorData?.timestamp
                    ? `Live: ${new Date(sensorData.timestamp).toLocaleTimeString()}`
                    : 'Awaiting hardware data stream...'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/health-data')}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.accent }}>View Details →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Cognitive Trend Section */}
        <Animated.View entering={FadeInUp.delay(500).duration(800)} style={styles.section}>
          <CognitiveTrendChart userId={selectedUser?.id} refreshTrigger={cognitiveRefreshTrigger} />
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
                  <Text style={[styles.caretakerRole, { color: theme.textSecondary }]}>+91 9731933073</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.callButton, { backgroundColor: theme.successBg }]}
                onPress={() => handleCall('+91 9731933073')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Call +91 9731933073"
              >
                <Feather name="phone" size={20} color={theme.successText} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Quick Simulation & Diagnostics Controls */}
        <Animated.View entering={FadeInUp.delay(700).duration(800)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Simulation & Diagnostics</Text>

          <View style={styles.diagnosticActionsContainer}>
            {/* 1. Simulate Fall Emergency Card */}
            <View style={[styles.diagnosticCard, { backgroundColor: isDark ? '#261212' : '#FEF2F2', borderColor: '#EF4444' }]}>
              <View style={styles.diagnosticCardHeader}>
                <View style={[styles.diagIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <MaterialCommunityIcons name="alert-octagon" size={24} color="#EF4444" />
                </View>
                <View style={[styles.badgePill, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.badgePillText}>EMERGENCY TEST</Text>
                </View>
              </View>
              <Text style={[styles.diagTitle, { color: theme.textPrimary }]}>Simulate Fall Emergency</Text>
              <Text style={[styles.diagSubtitle, { color: theme.textSecondary }]}>
                Triggers acoustic alarm, registers critical fall telemetry & dispatches automated voice call to caretaker ({caretaker?.contact || '+91 7619359520'}).
              </Text>
              <TouchableOpacity
                style={[styles.simulateFallBtn, { opacity: isSimulatingFall ? 0.7 : 1 }]}
                onPress={handleSimulateFall}
                disabled={isSimulatingFall}
                activeOpacity={0.8}
              >
                {isSimulatingFall ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.simulateFallBtnText}>Simulate Fall Incident</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* 2. Voice Cognitive Analysis Card */}
            <View style={[styles.diagnosticCard, { backgroundColor: isDark ? '#14182E' : '#EEF2FF', borderColor: '#6366F1' }]}>
              <View style={styles.diagnosticCardHeader}>
                <View style={[styles.diagIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                  <MaterialCommunityIcons name="microphone-variant" size={24} color="#6366F1" />
                </View>
                <View style={[styles.badgePill, { backgroundColor: '#6366F1' }]}>
                  <Text style={styles.badgePillText}>AI ML DIAGNOSTIC</Text>
                </View>
              </View>
              <Text style={[styles.diagTitle, { color: theme.textPrimary }]}>Voice Cognitive Analysis</Text>
              <Text style={[styles.diagSubtitle, { color: theme.textSecondary }]}>
                Record speech to evaluate verbal cadence, pause intervals, and articulation with Random Forest ML inference.
              </Text>
              <TouchableOpacity
                style={styles.voiceTestBtn}
                onPress={() => setIsVoiceModalVisible(true)}
                activeOpacity={0.8}
              >
                <Feather name="mic" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.voiceTestBtnText}>Start Voice Assessment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Emergency Fall Incident Modal */}
      <Modal visible={showEmergencyFallDialog} transparent animationType="fade">
        <View style={styles.emergencyModalOverlay}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.emergencyModalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
            <View style={styles.emergencyIconRing}>
              <MaterialCommunityIcons name="alarm-light" size={42} color="#EF4444" />
            </View>

            <Text style={[styles.emergencyModalTitle, { color: '#EF4444' }]}>🚨 FALL DETECTED!</Text>
            <Text style={[styles.emergencyModalSubtitle, { color: theme.textPrimary }]}>
              A high-impact fall incident has been recorded.
            </Text>

            <View style={[styles.emergencyDetailBox, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              <View style={styles.emergencyDetailRow}>
                <Ionicons name="volume-high" size={18} color="#EF4444" />
                <Text style={[styles.emergencyDetailText, { color: theme.textPrimary }]}>Acoustic Alarm: ACTIVE</Text>
              </View>
              <View style={styles.emergencyDetailRow}>
                <Feather name="phone-call" size={18} color="#34C759" />
                <Text style={[styles.emergencyDetailText, { color: theme.textPrimary }]}>
                  Emergency call dispatched to Caretaker
                </Text>
              </View>
              <Text style={[styles.caretakerContactNote, { color: theme.textSecondary }]}>
                {caretaker?.name || 'Steve Rogers'} • {caretaker?.contact || '+91 7619359520'}
              </Text>
            </View>

            <View style={styles.emergencyActions}>
              <TouchableOpacity
                style={[styles.emergencyCallBtn, { backgroundColor: '#34C759' }]}
                onPress={() => handleCall(caretaker?.contact || '+91 7619359520')}
                activeOpacity={0.8}
              >
                <Feather name="phone" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.emergencyCallBtnText}>Call Caretaker Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.emergencyDismissBtn, { borderColor: theme.border }]}
                onPress={handleDismissFallEmergency}
                activeOpacity={0.7}
              >
                <Feather name="check" size={18} color={theme.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.emergencyDismissBtnText, { color: theme.textPrimary }]}>I'm Safe • Dismiss Alarm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Voice Assessment Cognitive Modal */}
      <VoiceAssessmentModal
        visible={isVoiceModalVisible}
        onClose={() => setIsVoiceModalVisible(false)}
        userId={selectedUser?.id}
        onAnalysisComplete={() => {
          setCognitiveRefreshTrigger((prev) => prev + 1);
          fetchUserMetrics();
        }}
        isDark={isDark}
      />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diagnosticActionsContainer: {
    gap: 16,
  },
  diagnosticCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  diagnosticCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  diagIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePillText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  diagTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  diagSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  simulateFallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  simulateFallBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  voiceTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceTestBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emergencyModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  emergencyModalCard: {
    width: Math.min(width - 32, 420),
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  emergencyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emergencyModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  emergencyModalSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  emergencyDetailBox: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 8,
  },
  emergencyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emergencyDetailText: {
    fontSize: 14,
    fontWeight: '600',
  },
  caretakerContactNote: {
    fontSize: 12,
    marginTop: 4,
    paddingLeft: 26,
  },
  emergencyActions: {
    width: '100%',
    gap: 10,
  },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  emergencyCallBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emergencyDismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  emergencyDismissBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emergencyTopBanner: {
    backgroundColor: '#DC2626',
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  emergencyTopBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyTopBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyTopBannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  emergencyTopBannerSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  emergencyTopBannerBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  emergencyTopBannerBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  liveStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  telemetryCard: {
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  telemetryStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  telemetryStatusText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  telemetryBlock: {
    marginBottom: 14,
  },
  telemetryBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  telemetryBlockTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 6,
    flex: 1,
  },
  telemetryUnit: {
    fontSize: 11,
    fontWeight: '600',
  },
  axisGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  axisBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  axisTag: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  axisNum: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  telemetryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  telemetryTimestamp: {
    fontSize: 11,
    fontWeight: '500',
  },
});
