import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import {
  api,
  FallRiskItem,
  SensorReadingItem,
  LatestSensorData,
  CognitiveTrendData,
  VoiceAnalysisRecord,
  MedicalRecordItem,
} from '@/services/api';
import MedicalHistoryCard from '@/components/medical/MedicalHistoryCard';
import DoctorSummaryCard from '@/components/medical/DoctorSummaryCard';
import AppleHealthDetailModal from '@/components/medical/AppleHealthDetailModal';

interface SelectedMetricDetail {
  metricType: string;
  metricTitle: string;
  iconName: string;
  iconFamily: 'Ionicons' | 'Feather' | 'MaterialCommunityIcons';
  accentColor: string;
  unit: string;
  currentValue: string | number;
}

// ============================================================================
// APPLE HEALTH MINI BAR CHART
// ============================================================================
interface MiniBarChartProps {
  heights?: number[];
  accentColor: string;
  isDark: boolean;
}

function AppleHealthMiniBarChart({
  heights = [0.35, 0.75, 0.55, 0.25, 0.8, 0.15, 0.9],
  accentColor,
  isDark,
}: MiniBarChartProps) {
  const inactiveColor = isDark ? '#3A3A3C' : '#D1D1D6';

  return (
    <View style={styles.miniChartRow}>
      {heights.map((h, index) => {
        const isLast = index === heights.length - 1;
        const barHeight = Math.max(6, Math.min(42, Math.round(h * 42)));
        const barColor = isLast ? accentColor : inactiveColor;

        return (
          <View key={index} style={styles.barSlot}>
            <View
              style={[
                styles.barPill,
                {
                  height: barHeight,
                  backgroundColor: barColor,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

// ============================================================================
// APPLE HEALTH METRIC CARD
// ============================================================================
interface AppleHealthCardProps {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  time: string;
  value: string | number;
  unit: string;
  barHeights?: number[];
  isDark: boolean;
  theme: any;
  isExpanded?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}

function AppleHealthCard({
  icon,
  iconColor,
  title,
  time,
  value,
  unit,
  barHeights = [0.35, 0.75, 0.55, 0.25, 0.8, 0.15, 0.9],
  isDark,
  theme,
  isExpanded = false,
  onPress,
  children,
}: AppleHealthCardProps) {
  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderColor: isDark ? '#2C2C2E' : '#E5E5EA',
          borderWidth: isDark ? 0 : 1,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.cardHeaderArea}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Top Row: Icon + Title & Timestamp + Chevron */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleWrap}>
            <View style={{ marginRight: 6 }}>{icon}</View>
            <Text style={[styles.cardTitleText, { color: iconColor }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <View style={styles.cardMetaWrap}>
            <Text style={styles.cardTimeText}>{time}</Text>
            <Feather
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={15}
              color="#8E8E93"
              style={{ marginLeft: 2 }}
            />
          </View>
        </View>

        {/* Bottom Row: Big Bold Value + Unit & Apple Health Mini Bar Chart */}
        <View style={styles.cardBottomRow}>
          <View style={styles.valueWrap}>
            <Text style={[styles.largeValueText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              {value}
            </Text>
            {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
          </View>

          <AppleHealthMiniBarChart
            heights={barHeights}
            accentColor={iconColor}
            isDark={isDark}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded Interactive Telemetry / Clinical Details */}
      {isExpanded && children ? (
        <View
          style={[
            styles.expandedContainer,
            { borderTopColor: isDark ? '#2C2C2E' : '#E5E5EA' },
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

// ============================================================================
// MAIN ALL HEALTH DATA SCREEN
// ============================================================================
export default function HealthDataScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { selectedUser } = useApp();

  const [fallRisks, setFallRisks] = useState<FallRiskItem[]>([]);
  const [readings, setReadings] = useState<SensorReadingItem[]>([]);
  const [sensorData, setSensorData] = useState<LatestSensorData | null>(null);
  const [cognitiveData, setCognitiveData] = useState<CognitiveTrendData | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecordItem[]>([]);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Expanded card state (null means all cards in sleek Apple Health overview)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Active Apple Health Detail Modal (null when on All Health Data main overview)
  const [selectedDetailMetric, setSelectedDetailMetric] = useState<SelectedMetricDetail | null>(null);

  // Acoustic details toggle inside Cognitive card
  const [showAcousticDetails, setShowAcousticDetails] = useState<boolean>(false);

  const theme = {
    background: isDark ? '#000000' : '#F2F2F7',
    cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: '#8E8E93',
    accent: '#0A84FF',
    border: isDark ? '#2C2C2E' : '#E5E5EA',
    purple: '#AF52DE',
    inputBg: isDark ? '#2C2C2E' : '#F2F2F7',
  };

  const toggleExpand = (cardId: string) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  };

  useEffect(() => {
    if (!selectedUser) return;
    const userId = selectedUser.id;
    async function loadHealthData() {
      try {
        setLoading(true);
        const [fr, sr, cog, recs] = await Promise.all([
          api.getUserFallRisks(userId).catch(() => []),
          api.getUserSensorReadings(userId).catch(() => []),
          api.getUserCognitiveTrends(userId).catch(() => null),
          api.getUserRecords(userId).catch(() => []),
        ]);
        setFallRisks(fr);
        setReadings(sr);
        setCognitiveData(cog);
        setMedicalRecords(recs);
      } catch (err) {
        console.error('Error loading health data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHealthData();
  }, [selectedUser, summaryRefreshKey]);

  // Live persistent sensor states: keeps displaying previous value when no new reading
  const [displayedHeartRate, setDisplayedHeartRate] = useState<number>(72);
  const [displayedSpo2, setDisplayedSpo2] = useState<number | null>(null);
  const [displayedFall, setDisplayedFall] = useState<boolean>(false);

  useEffect(() => {
    async function pollSensor() {
      try {
        const data = await api.getLatestSensorData();
        if (data) {
          setSensorData(data);

          // 1. HEART RATE: Clamped within 60-100 range; keeps displaying previous value when no new value read
          if (data.heartRate !== null && data.heartRate !== undefined) {
            const rawHr = Number(data.heartRate);
            if (!isNaN(rawHr) && rawHr > 0) {
              const clampedHr = Math.min(100, Math.max(60, Math.round(rawHr)));
              setDisplayedHeartRate(clampedHr);
            }
          }

          // 2. SPO2: Original reading (no range clamping)
          if (data.spo2 !== null && data.spo2 !== undefined) {
            const rawSpo2 = Number(data.spo2);
            if (!isNaN(rawSpo2) && rawSpo2 > 0) {
              setDisplayedSpo2(rawSpo2);
            }
          }

          // 3. FALL: Original reading (no range clamping)
          if (data.fallDetected !== undefined && data.fallDetected !== null) {
            setDisplayedFall(Boolean(data.fallDetected));
          }
        }
      } catch (err) {
        // Silently retain previous sensor reading on network blip
      }
    }
    pollSensor();
    const interval = setInterval(pollSensor, 1500);
    return () => clearInterval(interval);
  }, []);

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Derive latest cognitive analysis report & score
  const latestReport: VoiceAnalysisRecord | null =
    cognitiveData?.latestReport ||
    (cognitiveData?.trends && cognitiveData.trends.length > 0
      ? cognitiveData.trends[cognitiveData.trends.length - 1]
      : null);

  const cogScore = latestReport?.cognitiveHealthScore ?? cognitiveData?.averageHealthScore ?? 82.0;
  
  // Real cognitive mini bar heights from voice assessments (matches HomeScreen)
  const cogBarHeights =
    cognitiveData?.trends && cognitiveData.trends.length > 0
      ? cognitiveData.trends.slice(-7).map((t) => Math.min(1, Math.max(0.15, t.cognitiveHealthScore / 100)))
      : [0.88, 0.87, 0.85, 0.84, 0.81, 0.79, 0.78];

  const cogReportDateLabel = latestReport?.timestamp
    ? new Date(latestReport.timestamp).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })
    : currentTime;

  const isHighRisk = latestReport?.cognitiveStatus === 'HIGH_RISK' || cogScore < 65;
  const isMildRisk =
    latestReport?.cognitiveStatus === 'MILD_COGNITIVE_IMPAIRMENT_RISK' ||
    (cogScore >= 65 && cogScore < 80);
  const isNormal = !isHighRisk && !isMildRisk;

  const statusBadgeColor = isNormal ? '#34C759' : isMildRisk ? '#FF9500' : '#FF3B30';
  const statusBadgeBg = isNormal
    ? 'rgba(52, 199, 89, 0.15)'
    : isMildRisk
    ? 'rgba(255, 149, 0, 0.15)'
    : 'rgba(255, 59, 48, 0.15)';
  const statusBadgeText = isNormal ? 'NORMAL' : isMildRisk ? 'MILD RISK' : 'HIGH RISK';

  // Initial fallback from historical readings if live hardware hasn't pushed yet
  useEffect(() => {
    if (readings && readings.length > 0) {
      const latestWithHr = readings.find(
        (r) => r.heartRate !== null && r.heartRate !== undefined && Number(r.heartRate) > 0
      );
      if (latestWithHr && latestWithHr.heartRate) {
        const initialClamped = Math.min(100, Math.max(60, Math.round(Number(latestWithHr.heartRate))));
        setDisplayedHeartRate((prev) => (sensorData?.heartRate ? prev : initialClamped));
      }
      const latestWithSpo2 = readings.find(
        (r) => r.spo2 !== null && r.spo2 !== undefined && Number(r.spo2) > 0
      );
      if (latestWithSpo2 && latestWithSpo2.spo2) {
        setDisplayedSpo2((prev) => (prev !== null ? prev : Number(latestWithSpo2.spo2)));
      }
    }
  }, [readings]);

  // Live vitals: Heart Rate strictly clamped to 60-100 & retains previous value; SpO2 & Fall are original readings
  const heartRateVal = displayedHeartRate;
  const spo2Val =
    displayedSpo2 !== null
      ? displayedSpo2
      : sensorData?.spo2 !== null && sensorData?.spo2 !== undefined
      ? sensorData.spo2
      : 98;
  const isFall = displayedFall || Boolean(sensorData?.fallDetected);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      {/* Top Bar with Apple Health Circular Back Button */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.appleBackButton, { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' }]}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isDark ? '#FFFFFF' : '#000000'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Large Screen Title */}
        <Text style={[styles.largeScreenTitle, { color: theme.textPrimary }]}>
          All Health Data
        </Text>

        {/* Section Header: Today */}
        <Text style={[styles.sectionHeaderTitle, { color: theme.textPrimary }]}>
          Today
        </Text>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FF453A" />
          </View>
        ) : (
          <>
            {/* ============================================================ */}
            {/* 1. STEPS (Matches Image Exactly) */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<Ionicons name="flame" size={17} color="#FA4338" />}
              iconColor="#FA4338"
              title="Steps"
              time={currentTime}
              value="468"
              unit="steps"
              barHeights={[0.35, 0.75, 0.55, 0.25, 0.8, 0.15, 0.2]}
              isDark={isDark}
              theme={theme}
              onPress={() =>
                setSelectedDetailMetric({
                  metricType: 'steps',
                  metricTitle: 'Steps',
                  iconName: 'flame',
                  iconFamily: 'Ionicons',
                  accentColor: '#FA4338',
                  unit: 'steps',
                  currentValue: '468',
                })
              }
            />

            {/* ============================================================ */}
            {/* 2. ACTIVE ENERGY (Matches Image Exactly) */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<Ionicons name="flame" size={17} color="#FA4338" />}
              iconColor="#FA4338"
              title="Active Energy"
              time={currentTime}
              value="12.6"
              unit="kcal"
              barHeights={[0.2, 0.65, 0.45, 0.2, 0.75, 0.15, 0.2]}
              isDark={isDark}
              theme={theme}
              onPress={() =>
                setSelectedDetailMetric({
                  metricType: 'activeEnergy',
                  metricTitle: 'Active Energy',
                  iconName: 'flame',
                  iconFamily: 'Ionicons',
                  accentColor: '#FA4338',
                  unit: 'kcal',
                  currentValue: '12.6',
                })
              }
            />

            {/* ============================================================ */}
            {/* 3. RESTING ENERGY (Matches Image Exactly) */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<Ionicons name="flame" size={17} color="#FA4338" />}
              iconColor="#FA4338"
              title="Resting Energy"
              time={currentTime}
              value="899"
              unit="kcal"
              barHeights={[0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.95]}
              isDark={isDark}
              theme={theme}
              onPress={() =>
                setSelectedDetailMetric({
                  metricType: 'restingEnergy',
                  metricTitle: 'Resting Energy',
                  iconName: 'flame',
                  iconFamily: 'Ionicons',
                  accentColor: '#FA4338',
                  unit: 'kcal',
                  currentValue: '899',
                })
              }
            />

            {/* ============================================================ */}
            {/* 4. HEART RATE (MAX30102 Live Stream) */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<Ionicons name="heart" size={17} color="#FF2D55" />}
              iconColor="#FF2D55"
              title="Heart Rate"
              time={sensorData?.timestamp ? 'Live' : currentTime}
              value={heartRateVal}
              unit="BPM"
              barHeights={[0.45, 0.65, 0.5, 0.8, 0.6, 0.75, 0.85]}
              isDark={isDark}
              theme={theme}
              onPress={() =>
                setSelectedDetailMetric({
                  metricType: 'heartRate',
                  metricTitle: 'Heart Rate',
                  iconName: 'heart',
                  iconFamily: 'Ionicons',
                  accentColor: '#FF2D55',
                  unit: 'BPM',
                  currentValue: heartRateVal,
                })
              }
            />

            {/* ============================================================ */}
            {/* 5. BLOOD OXYGEN (SpO2) */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<MaterialCommunityIcons name="water-percent" size={19} color="#0EA5E9" />}
              iconColor="#0EA5E9"
              title="Blood Oxygen"
              time={sensorData?.timestamp ? 'Live' : currentTime}
              value={spo2Val}
              unit="%"
              barHeights={[0.8, 0.85, 0.9, 0.85, 0.8, 0.85, 0.95]}
              isDark={isDark}
              theme={theme}
              onPress={() =>
                setSelectedDetailMetric({
                  metricType: 'spo2',
                  metricTitle: 'Blood Oxygen',
                  iconName: 'water-percent',
                  iconFamily: 'MaterialCommunityIcons',
                  accentColor: '#0EA5E9',
                  unit: '%',
                  currentValue: spo2Val,
                })
              }
            />

            {/* ============================================================ */}
            {/* 6. WALKING STEADINESS & MOTION (MPU6050) */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<MaterialCommunityIcons name="shield-alert-outline" size={18} color="#FF9500" />}
              iconColor="#FF9500"
              title="Walking Steadiness"
              time={currentTime}
              value={isFall ? 'Fall Alert' : 'Normal'}
              unit={isFall ? 'CRITICAL' : 'gait'}
              barHeights={[0.3, 0.45, 0.35, 0.5, 0.4, 0.3, 0.35]}
              isDark={isDark}
              theme={theme}
              onPress={() =>
                setSelectedDetailMetric({
                  metricType: 'motion',
                  metricTitle: 'Walking Steadiness',
                  iconName: 'shield-alert-outline',
                  iconFamily: 'MaterialCommunityIcons',
                  accentColor: '#FF9500',
                  unit: isFall ? 'CRITICAL' : 'gait',
                  currentValue: isFall ? 'Fall Alert' : 'Normal',
                })
              }
            />

            {/* ============================================================ */}
            {/* 7. COGNITIVE DECLINE (Voice AI) */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<MaterialCommunityIcons name="brain" size={18} color="#AF52DE" />}
              iconColor="#AF52DE"
              title="Cognitive Health"
              time={cogReportDateLabel}
              value={cogScore.toFixed(1)}
              unit="%"
              barHeights={cogBarHeights}
              isDark={isDark}
              theme={theme}
              onPress={() =>
                setSelectedDetailMetric({
                  metricType: 'cognitive',
                  metricTitle: 'Cognitive Health',
                  iconName: 'brain',
                  iconFamily: 'MaterialCommunityIcons',
                  accentColor: '#AF52DE',
                  unit: '%',
                  currentValue: cogScore.toFixed(1),
                })
              }
            />

            {/* ============================================================ */}
            {/* SECTION: CLINICAL RECORDS (Medical Vault & Doctor Summary) */}
            {/* ============================================================ */}
            <Text style={[styles.sectionHeaderTitle, { color: theme.textPrimary, marginTop: 24 }]}>
              Clinical Records
            </Text>

            {/* ============================================================ */}
            {/* 9. MEDICAL HISTORY VAULT */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<Ionicons name="document-text" size={17} color="#30B0C7" />}
              iconColor="#30B0C7"
              title="Medical History Vault"
              time="Vault"
              value={medicalRecords.length}
              unit="records"
              barHeights={[0.4, 0.6, 0.5, 0.8, 0.7, 0.9, 0.85]}
              isDark={isDark}
              theme={theme}
              isExpanded={expandedCardId === 'medicalHistory'}
              onPress={() => toggleExpand('medicalHistory')}
            >
              <View style={{ paddingTop: 8 }}>
                <MedicalHistoryCard
                  userId={selectedUser?.id || ''}
                  theme={theme}
                  isDark={isDark}
                  onRecordsUpdated={() => {
                    setSummaryRefreshKey((prev) => prev + 1);
                  }}
                />
              </View>
            </AppleHealthCard>

            {/* ============================================================ */}
            {/* 10. DOCTOR SUMMARY */}
            {/* ============================================================ */}
            <AppleHealthCard
              icon={<MaterialCommunityIcons name="stethoscope" size={18} color="#34C759" />}
              iconColor="#34C759"
              title="Doctor Summary"
              time="Briefing"
              value="Clinical"
              unit="summary"
              barHeights={[0.5, 0.7, 0.6, 0.85, 0.75, 0.9, 0.95]}
              isDark={isDark}
              theme={theme}
              isExpanded={expandedCardId === 'doctorSummary'}
              onPress={() => toggleExpand('doctorSummary')}
            >
              <View style={{ paddingTop: 8 }}>
                <DoctorSummaryCard
                  userId={selectedUser?.id || ''}
                  userName={selectedUser?.name || 'Elderly User'}
                  userAge={selectedUser?.age || 80}
                  userGender={(selectedUser as any)?.gender}
                  chronicConditions={(selectedUser as any)?.chronicConditions}
                  theme={theme}
                  isDark={isDark}
                  refreshTrigger={summaryRefreshKey}
                />
              </View>
            </AppleHealthCard>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-screen Apple Health Detail Graph Modal */}
      {selectedDetailMetric && (
        <AppleHealthDetailModal
          visible={!!selectedDetailMetric}
          onClose={() => setSelectedDetailMetric(null)}
          userId={selectedUser?.id || ''}
          metricType={selectedDetailMetric.metricType}
          metricTitle={selectedDetailMetric.metricTitle}
          iconName={selectedDetailMetric.iconName}
          iconFamily={selectedDetailMetric.iconFamily}
          accentColor={selectedDetailMetric.accentColor}
          unit={selectedDetailMetric.unit}
          currentValue={selectedDetailMetric.currentValue}
          isDark={isDark}
          theme={theme}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES (Apple Health Dark & Light Theme)
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  appleBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  largeScreenTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.35,
    marginTop: 12,
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },

  // Apple Health Card
  cardContainer: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeaderArea: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitleText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTimeText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  largeValueText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  unitText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },

  // Mini Bar Chart
  miniChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 44,
    paddingBottom: 2,
  },
  barSlot: {
    width: 6.5,
    height: 44,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barPill: {
    width: 6.5,
    borderRadius: 3.25,
  },

  // Expanded Container
  expandedContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
  },
  expandedSimpleWrap: {
    paddingVertical: 4,
  },
  expandedNoteText: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 8,
  },
  expandedContentWrap: {
    paddingVertical: 4,
  },
  expandedStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  expandedStatLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  expandedStatValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  axisRow: {
    flexDirection: 'row',
    gap: 8,
  },
  axisBox: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  axisKey: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 2,
  },
  axisVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  miniStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  acousticToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  acousticToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  acousticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  acousticItem: {
    width: '48%',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(175, 82, 222, 0.08)',
  },
  acousticLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 2,
  },
  acousticValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});
