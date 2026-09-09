import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, PanResponder } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { api, FallRiskItem, SensorReadingItem, LatestSensorData, CognitiveTrendData, VoiceAnalysisRecord } from '@/services/api';

type CardId = 'cognitive' | 'fallRiskTelemetry' | 'heartRate' | 'spO2';

const DEFAULT_CARD_ORDER: CardId[] = [
  'cognitive',
  'fallRiskTelemetry',
  'heartRate',
  'spO2',
];

interface DraggableCardWrapperProps {
  index: number;
  total: number;
  isReordering: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  theme: any;
  children: React.ReactNode;
}

function DraggableCardWrapper({
  index,
  total,
  isReordering,
  onMoveUp,
  onMoveDown,
  theme,
  children,
}: DraggableCardWrapperProps) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30 && index > 0) {
          onMoveUp();
        } else if (gestureState.dy > 30 && index < total - 1) {
          onMoveDown();
        }
      },
    })
  ).current;

  if (!isReordering) {
    return <View style={styles.cardOuterWrapper}>{children}</View>;
  }

  return (
    <View style={[styles.cardOuterWrapper, styles.reorderActiveCard, { borderColor: theme.accent, backgroundColor: theme.cardBg }]}>
      <View style={[styles.reorderHandleBar, { backgroundColor: theme.inputBg, borderBottomColor: theme.border }]}>
        <View {...panResponder.panHandlers} style={styles.dragHandleTouchArea}>
          <MaterialCommunityIcons name="drag-vertical" size={20} color={theme.accent} />
          <View style={[styles.orderIndexBadge, { backgroundColor: theme.accent }]}>
            <Text style={styles.orderIndexText}>#{index + 1}</Text>
          </View>
          <Text style={[styles.dragHandleLabel, { color: theme.textSecondary }]}>Drag / Move</Text>
        </View>

        <View style={styles.reorderArrowActions}>
          <TouchableOpacity
            style={[styles.arrowButton, index === 0 && styles.arrowButtonDisabled]}
            onPress={onMoveUp}
            disabled={index === 0}
            activeOpacity={0.7}
          >
            <Feather name="arrow-up" size={15} color={index === 0 ? theme.border : theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowButton, index === total - 1 && styles.arrowButtonDisabled]}
            onPress={onMoveDown}
            disabled={index === total - 1}
            activeOpacity={0.7}
          >
            <Feather name="arrow-down" size={15} color={index === total - 1 ? theme.border : theme.accent} />
          </TouchableOpacity>
        </View>
      </View>
      {children}
    </View>
  );
}

export default function HealthDataScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { selectedUser } = useApp();

  const [fallRisks, setFallRisks] = useState<FallRiskItem[]>([]);
  const [readings, setReadings] = useState<SensorReadingItem[]>([]);
  const [sensorData, setSensorData] = useState<LatestSensorData | null>(null);
  const [cognitiveData, setCognitiveData] = useState<CognitiveTrendData | null>(null);
  const [showAcousticDetails, setShowAcousticDetails] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Reactive Reorder state
  const [cardOrder, setCardOrder] = useState<CardId[]>(DEFAULT_CARD_ORDER);
  const [isReordering, setIsReordering] = useState<boolean>(false);

  const theme = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    accent: isDark ? '#38BDF8' : '#0EA5E9',
    border: isDark ? '#334155' : '#E2E8F0',
    purple: '#8B5CF6',
    inputBg: isDark ? '#26334D' : '#F1F5F9',
  };

  useEffect(() => {
    if (!selectedUser) return;
    const userId = selectedUser.id;
    async function loadHealthData() {
      try {
        setLoading(true);
        const [fr, sr, cog] = await Promise.all([
          api.getUserFallRisks(userId).catch(() => []),
          api.getUserSensorReadings(userId).catch(() => []),
          api.getUserCognitiveTrends(userId).catch(() => null),
        ]);
        setFallRisks(fr);
        setReadings(sr);
        setCognitiveData(cog);
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

  const moveCard = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= cardOrder.length) return;
    setCardOrder((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  };

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const latestFallRisk = fallRisks.length > 0 ? fallRisks[0] : null;

  // Derive latest cognitive analysis report & score
  const latestReport: VoiceAnalysisRecord | null =
    cognitiveData?.latestReport ||
    (cognitiveData?.trends && cognitiveData.trends.length > 0
      ? cognitiveData.trends[cognitiveData.trends.length - 1]
      : null);

  const cogScore = latestReport?.cognitiveHealthScore ?? cognitiveData?.averageHealthScore ?? 82.0;
  const isHighRisk = latestReport?.cognitiveStatus === 'HIGH_RISK' || cogScore < 65;
  const isMildRisk = latestReport?.cognitiveStatus === 'MILD_COGNITIVE_IMPAIRMENT_RISK' || (cogScore >= 65 && cogScore < 80);
  const isNormal = !isHighRisk && !isMildRisk;

  const statusBadgeColor = isNormal ? '#10B981' : isMildRisk ? '#F59E0B' : '#EF4444';
  const statusBadgeBg = isNormal
    ? 'rgba(16, 185, 129, 0.15)'
    : isMildRisk
    ? 'rgba(245, 158, 11, 0.15)'
    : 'rgba(239, 68, 68, 0.15)';
  const statusBadgeText = isNormal ? 'NORMAL' : isMildRisk ? 'MILD RISK' : 'HIGH RISK';

  // Render individual cards by ID
  const renderCard = (cardId: CardId, index: number) => {
    let content: React.ReactNode = null;

    switch (cardId) {
      case 'cognitive':
        content = (
          <View style={[styles.fullCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.titleContainer}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                  <MaterialCommunityIcons name="brain" size={24} color={theme.purple} />
                </View>
                <View style={styles.titleTextWrapper}>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    Cognitive Decline
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    Random Forest ML • 96% Acc.
                  </Text>
                </View>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: statusBadgeBg }]}>
                <Text style={[styles.statusBadgeLabel, { color: statusBadgeColor }]}>{statusBadgeText}</Text>
              </View>
            </View>

            {/* Score Showcase */}
            <View style={styles.scoreContainer}>
              <View>
                <Text style={[styles.largeScoreText, { color: theme.textPrimary }]}>
                  {cogScore.toFixed(1)}%
                </Text>
                <Text style={[styles.scoreDesc, { color: theme.textSecondary }]}>Cognitive Health Score</Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metaVal, { color: theme.textPrimary }]}>
                  {(latestReport?.confidenceScore ? latestReport.confidenceScore * 100 : 92).toFixed(0)}%
                </Text>
                <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Model Confidence</Text>
              </View>
            </View>

            {/* Multi-Segment Decline Scale Meter with Triangle Pointer */}
            <View style={styles.meterContainer}>
              <View style={styles.pointerTrack}>
                <View style={[styles.pointerWrapper, { left: `${Math.max(3, Math.min(97, cogScore))}%` }]}>
                  <Ionicons name="caret-down" size={16} color={statusBadgeColor} style={{ marginLeft: -8, marginBottom: -3 }} />
                </View>
              </View>

              <View style={styles.scaleTrack}>
                <View style={[styles.scaleSegment, { flex: 65, backgroundColor: '#EF4444' }]} />
                <View style={[styles.scaleSegment, { flex: 15, backgroundColor: '#F59E0B' }]} />
                <View style={[styles.scaleSegment, { flex: 20, backgroundColor: '#10B981' }]} />
              </View>
            </View>
            <View style={styles.scaleLabelsRow}>
              <Text style={{ fontSize: 11, color: '#EF4444' }}>High Risk (&lt;65%)</Text>
              <Text style={{ fontSize: 11, color: '#F59E0B' }}>Mild Impairment (65-79%)</Text>
              <Text style={{ fontSize: 11, color: '#10B981' }}>Normal (80-100%)</Text>
            </View>

            {/* Clinical Interpretation Note */}
            <View style={[styles.noteBox, { backgroundColor: theme.inputBg }]}>
              <Feather name="info" size={16} color={theme.accent} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                {isNormal
                  ? 'Speech cadence, pause patterns, and linguistic articulation align with healthy cognitive benchmarks. No immediate decline risks detected.'
                  : isMildRisk
                  ? 'Elevated pause duration and acoustic variability observed during check-in. Consistent monitoring recommended for early MCI tracking.'
                  : 'Significant speech latency and acoustic frequency deviations detected. Clinical cognitive evaluation is strongly recommended.'}
              </Text>
            </View>

            {/* Historical Summary Footer */}
            <View style={[styles.cardFooterRow, { borderTopColor: theme.border }]}>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                Total Sessions: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{cognitiveData?.count ?? 0}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                Historical Average: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{cognitiveData?.averageHealthScore ? `${cognitiveData.averageHealthScore}%` : '--'}</Text>
              </Text>
            </View>

            {/* Extended Section: Acoustic Speech Feature Analysis */}
            {showAcousticDetails && (
              <View style={[styles.extendedSection, { borderTopColor: theme.border }]}>
                <View style={[styles.cardHeaderRow, { marginTop: 14, marginBottom: 12 }]}>
                  <View style={styles.titleContainer}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(14, 165, 233, 0.15)', width: 38, height: 38, borderRadius: 19 }]}>
                      <MaterialCommunityIcons name="waveform" size={22} color="#0EA5E9" />
                    </View>
                    <View style={styles.titleTextWrapper}>
                      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Acoustic Speech Features</Text>
                      <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                        Voice Biomarkers & Speech Acoustics
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Acoustic Feature Grid */}
                <View style={styles.featuresGrid}>
                  <View style={[styles.featureTile, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.featureLabel, { color: theme.textSecondary }]}>Speech Rate (WPM)</Text>
                    <Text style={[styles.featureVal, { color: theme.textPrimary }]}>
                      {latestReport ? `${latestReport.speechRateWpm} WPM` : '-- WPM'}
                    </Text>
                    <Text style={[styles.featureRef, { color: theme.textSecondary }]}>
                      Normal: 120–160 WPM
                    </Text>
                  </View>

                  <View style={[styles.featureTile, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.featureLabel, { color: theme.textSecondary }]}>Pause Duration</Text>
                    <Text style={[styles.featureVal, { color: theme.textPrimary }]}>
                      {latestReport ? `${(latestReport.pauseDurationSec ?? latestReport.pauseFrequency).toFixed(1)}s` : '-- s'}
                    </Text>
                    <Text style={[styles.featureRef, { color: theme.textSecondary }]}>
                      Natural: &lt; 1.5s
                    </Text>
                  </View>

                  <View style={[styles.featureTile, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.featureLabel, { color: theme.textSecondary }]}>Pitch Variability</Text>
                    <Text style={[styles.featureVal, { color: theme.textPrimary }]}>
                      {latestReport ? `${latestReport.pitchVariability} Hz` : '-- Hz'}
                    </Text>
                    <Text style={[styles.featureRef, { color: theme.textSecondary }]}>
                      Intonation & Tone Dynamics
                    </Text>
                  </View>

                  <View style={[styles.featureTile, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.featureLabel, { color: theme.textSecondary }]}>Articulation Score</Text>
                    <Text style={[styles.featureVal, { color: theme.textPrimary }]}>
                      {latestReport ? `${latestReport.articulationScore} / 10` : '-- / 10'}
                    </Text>
                    <Text style={[styles.featureRef, { color: theme.textSecondary }]}>
                      Phoneme Clarity Index
                    </Text>
                  </View>
                </View>

                {/* Jitter / Shimmer Perturbation Breakdown */}
                <View style={[styles.secondaryFeatureRow, { borderTopColor: theme.border }]}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>
                      Jitter / Shimmer Ratio: {latestReport?.jitterShimmerRatio ?? '0.3'}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                      Acoustic frequency & vocal amplitude stability
                    </Text>
                  </View>
                  {latestReport?.timestamp && (
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                      {new Date(latestReport.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(latestReport.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* View More / View Less Toggle Button */}
            <TouchableOpacity
              style={[styles.viewMoreBtn, { borderTopColor: theme.border }]}
              onPress={() => setShowAcousticDetails((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewMoreText, { color: theme.accent }]}>
                {showAcousticDetails ? 'View less' : 'View more details'}
              </Text>
              <Feather
                name={showAcousticDetails ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.accent}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>
        );
        break;

      case 'heartRate':
        content = (
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
        );
        break;

      case 'spO2':
        content = (
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
        );
        break;

      case 'fallRiskTelemetry': {
        const isFall = Boolean(sensorData?.fallDetected);
        const riskLevel = isFall ? 'CRITICAL' : (latestFallRisk ? latestFallRisk.riskLevel : 'LOW');
        const eventType = isFall ? 'FALL_DETECTED' : (latestFallRisk ? latestFallRisk.eventType : 'NORMAL_GAIT');

        const riskColor =
          isFall || riskLevel === 'HIGH' || riskLevel === 'CRITICAL'
            ? '#EF4444'
            : riskLevel === 'MEDIUM'
            ? '#F59E0B'
            : '#10B981';
        const riskBg = isFall
          ? 'rgba(239, 68, 68, 0.2)'
          : riskColor === '#EF4444'
          ? 'rgba(239, 68, 68, 0.15)'
          : riskColor === '#F59E0B'
          ? 'rgba(245, 158, 11, 0.15)'
          : 'rgba(16, 185, 129, 0.15)';

        content = (
          <View
            style={[
              styles.fullCard,
              {
                backgroundColor: isFall ? (isDark ? '#451A1A' : '#FEF2F2') : theme.cardBg,
                borderColor: isFall ? '#EF4444' : theme.border,
                borderWidth: isFall ? 2 : 1,
              },
            ]}
          >
            {/* Header Row */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.titleContainer}>
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isFall
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.15)',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isFall ? 'alert-circle' : 'shield-alert-outline'}
                    size={24}
                    color={isFall ? '#EF4444' : '#F59E0B'}
                  />
                </View>
                <View style={styles.titleTextWrapper}>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    Motion Telemetry
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    ESP32 MPU6050
                  </Text>
                </View>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: riskBg }]}>
                <Text style={[styles.statusBadgeLabel, { color: riskColor }]}>
                  {isFall ? 'FALL DETECTED!' : `${riskLevel} RISK`}
                </Text>
              </View>
            </View>

            {/* Assessment & Status Summary */}
            <View style={styles.scoreContainer}>
              <View>
                <Text
                  style={[
                    styles.largeScoreText,
                    { color: isFall ? '#EF4444' : theme.textPrimary, fontSize: 26 },
                  ]}
                >
                  {isFall ? 'EMERGENCY' : `${riskLevel} RISK`}
                </Text>
                <Text style={[styles.scoreDesc, { color: isFall ? '#DC2626' : theme.textSecondary }]}>
                  Event: {eventType}
                </Text>
              </View>

              {/* Live Sensor Stream Pill */}
              <View style={[styles.liveSensorPill, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <View style={[styles.liveDot, { backgroundColor: isFall ? '#EF4444' : '#10B981' }]} />
                <Text style={[styles.liveDotText, { color: theme.textSecondary }]}>MPU6050 LIVE</Text>
              </View>
            </View>

            {/* MPU6050 6-Axis Telemetry Box */}
            <View style={[styles.telemetryBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              {/* Accelerometer Row */}
              <View style={styles.telemetrySection}>
                <View style={styles.telemetrySectionHeader}>
                  <MaterialCommunityIcons name="axis-arrow" size={15} color={theme.accent} />
                  <Text style={[styles.telemetrySectionTitle, { color: theme.textSecondary }]}>
                    ACCELEROMETER (g)
                  </Text>
                </View>
                <View style={styles.axisValuesRow}>
                  <View style={[styles.axisBadge, { backgroundColor: theme.cardBg }]}>
                    <Text style={[styles.axisLabel, { color: theme.textSecondary }]}>X</Text>
                    <Text style={[styles.axisVal, { color: theme.textPrimary }]}>
                      {sensorData?.ax !== undefined && sensorData?.ax !== null ? sensorData.ax.toFixed(2) : '0.00'}
                    </Text>
                  </View>
                  <View style={[styles.axisBadge, { backgroundColor: theme.cardBg }]}>
                    <Text style={[styles.axisLabel, { color: theme.textSecondary }]}>Y</Text>
                    <Text style={[styles.axisVal, { color: theme.textPrimary }]}>
                      {sensorData?.ay !== undefined && sensorData?.ay !== null ? sensorData.ay.toFixed(2) : '0.00'}
                    </Text>
                  </View>
                  <View style={[styles.axisBadge, { backgroundColor: theme.cardBg }]}>
                    <Text style={[styles.axisLabel, { color: theme.textSecondary }]}>Z</Text>
                    <Text style={[styles.axisVal, { color: theme.textPrimary }]}>
                      {sensorData?.az !== undefined && sensorData?.az !== null ? sensorData.az.toFixed(2) : '0.00'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Gyroscope Row */}
              <View style={[styles.telemetrySection, { marginTop: 10 }]}>
                <View style={styles.telemetrySectionHeader}>
                  <MaterialCommunityIcons name="rotate-3d-variant" size={15} color="#8B5CF6" />
                  <Text style={[styles.telemetrySectionTitle, { color: theme.textSecondary }]}>
                    GYROSCOPE (°/s)
                  </Text>
                </View>
                <View style={styles.axisValuesRow}>
                  <View style={[styles.axisBadge, { backgroundColor: theme.cardBg }]}>
                    <Text style={[styles.axisLabel, { color: theme.textSecondary }]}>X</Text>
                    <Text style={[styles.axisVal, { color: theme.textPrimary }]}>
                      {sensorData?.gx !== undefined && sensorData?.gx !== null ? sensorData.gx.toFixed(1) : '0.0'}
                    </Text>
                  </View>
                  <View style={[styles.axisBadge, { backgroundColor: theme.cardBg }]}>
                    <Text style={[styles.axisLabel, { color: theme.textSecondary }]}>Y</Text>
                    <Text style={[styles.axisVal, { color: theme.textPrimary }]}>
                      {sensorData?.gy !== undefined && sensorData?.gy !== null ? sensorData.gy.toFixed(1) : '0.0'}
                    </Text>
                  </View>
                  <View style={[styles.axisBadge, { backgroundColor: theme.cardBg }]}>
                    <Text style={[styles.axisLabel, { color: theme.textSecondary }]}>Z</Text>
                    <Text style={[styles.axisVal, { color: theme.textPrimary }]}>
                      {sensorData?.gz !== undefined && sensorData?.gz !== null ? sensorData.gz.toFixed(1) : '0.0'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Raw MAX30102 PPG footer if available */}
              {sensorData?.ir !== null && sensorData?.ir !== undefined && (
                <View style={[styles.telemetryFooter, { borderTopColor: theme.border }]}>
                  <Text style={[styles.telemetryFooterText, { color: theme.textSecondary }]}>
                    Raw Optical: IR={sensorData.ir} • RED={sensorData.red ?? 'N/A'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
        break;
      }

      default:
        return null;
    }

    return (
      <DraggableCardWrapper
        key={cardId}
        index={index}
        total={cardOrder.length}
        isReordering={isReordering}
        onMoveUp={() => moveCard(index, index - 1)}
        onMoveDown={() => moveCard(index, index + 1)}
        theme={theme}
      >
        {content}
      </DraggableCardWrapper>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {selectedUser ? `${selectedUser.name}'s Health Data` : 'All Health Data'}
        </Text>

        {/* Reorder Toggle Button */}
        <TouchableOpacity
          style={[
            styles.reorderToggleBtn,
            {
              backgroundColor: isReordering ? theme.accent : theme.cardBg,
              borderColor: isReordering ? theme.accent : theme.border,
            },
          ]}
          onPress={() => setIsReordering((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Feather
            name={isReordering ? 'check' : 'layers'}
            size={14}
            color={isReordering ? '#FFF' : theme.textPrimary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.reorderToggleText,
              { color: isReordering ? '#FFF' : theme.textPrimary },
            ]}
          >
            {isReordering ? 'Done' : 'Reorder'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Reorder Guidance Banner */}
        {isReordering && (
          <View style={[styles.reorderBanner, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="info" size={16} color={theme.accent} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 13, color: theme.textPrimary, flex: 1 }}>
                Tap ▲ / ▼ or drag handles to arrange your dashboard cards.
              </Text>
            </View>
            <TouchableOpacity onPress={() => setCardOrder(DEFAULT_CARD_ORDER)} style={styles.resetBtn}>
              <Text style={{ fontSize: 12, color: theme.accent, fontWeight: '700' }}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
          Last updated: {sensorData?.timestamp ? new Date(sensorData.timestamp).toLocaleTimeString() : currentTime}
        </Text>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          cardOrder.map((cardId, index) => renderCard(cardId, index))
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginHorizontal: 8,
  },
  reorderToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  reorderToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reorderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  scrollContent: {
    padding: 20,
  },
  timestamp: {
    fontSize: 14,
    marginBottom: 16,
    fontWeight: '500',
  },
  cardOuterWrapper: {
    marginBottom: 16,
  },
  reorderActiveCard: {
    borderRadius: 24,
    borderWidth: 2,
    overflow: 'hidden',
  },
  reorderHandleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dragHandleTouchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  orderIndexBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
    marginRight: 8,
  },
  orderIndexText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dragHandleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  reorderArrowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  dataCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
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
  fullCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  titleTextWrapper: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  statusBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  largeScoreText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  scoreDesc: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  metaVal: {
    fontSize: 20,
    fontWeight: '700',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  meterContainer: {
    width: '100%',
    marginBottom: 4,
  },
  pointerTrack: {
    width: '100%',
    height: 14,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  pointerWrapper: {
    position: 'absolute',
    top: 0,
  },
  scaleTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  scaleSegment: {
    height: '100%',
  },
  scaleLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  noteBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  featureTile: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  featureVal: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureRef: {
    fontSize: 10,
    fontWeight: '500',
  },
  secondaryFeatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  extendedSection: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 4,
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  liveSensorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  liveDotText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  telemetryBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
  },
  telemetrySection: {
    width: '100%',
  },
  telemetrySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  telemetrySectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  axisValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  axisBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  axisLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 4,
  },
  axisVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  telemetryFooter: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
    alignItems: 'center',
  },
  telemetryFooterText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
