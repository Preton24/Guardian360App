import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Line, Circle, Rect } from 'react-native-svg';
import { api, MetricDetailsResponse, VoiceAnalysisRecord } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AppleHealthDetailModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  metricType: string;
  metricTitle: string;
  iconName: string;
  iconFamily: 'Ionicons' | 'Feather' | 'MaterialCommunityIcons';
  accentColor: string;
  unit: string;
  currentValue: string | number;
  isDark: boolean;
  theme: any;
}

type RangeOption = 'D' | 'W' | 'M' | '6M' | 'Y';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-10-20' -> '20 Oct 2026'
const formatFullDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const fmtNum = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 1 });

// Cognitive Health uses the same voice-assessment data as the Home screen's Cognitive Analysis card.
async function loadCognitive(userId: string, range: RangeOption): Promise<MetricDetailsResponse> {
  const res = await api.getUserCognitiveTrends(userId);
  const all: VoiceAnalysisRecord[] = res.trends || [];
  const maxBars = range === 'D' ? 1 : range === 'W' ? 7 : range === 'M' ? 14 : range === '6M' ? 30 : all.length;
  const sel = all.slice(-maxBars);
  const bars = sel.map((r) => {
    const d = new Date(r.timestamp);
    return {
      label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
      date: d.toISOString().split('T')[0],
      value: parseFloat(r.cognitiveHealthScore.toFixed(1)),
    };
  });
  const avg = sel.length
    ? parseFloat((sel.reduce((a, r) => a + r.cognitiveHealthScore, 0) / sel.length).toFixed(1))
    : 0;
  const latest = sel[sel.length - 1];
  const first = sel[0];
  let trend = 'Stable';
  if (latest && first) {
    if (latest.cognitiveHealthScore < first.cognitiveHealthScore - 4) trend = 'Downward (Mild Decline)';
    else if (latest.cognitiveHealthScore > first.cognitiveHealthScore + 4) trend = 'Improving';
  }
  return {
    metricType: 'cognitive',
    range,
    average: avg,
    unit: '%',
    dateRangeLabel: sel.length
      ? `${formatFullDate(bars[0].date)} – ${formatFullDate(bars[bars.length - 1].date)}`
      : 'No assessments',
    yMax: 100,
    yMid: 50,
    yMin: 0,
    bars,
    allBarsCount: sel.length,
    trend,
    highlights: {
      today: latest ? parseFloat(latest.cognitiveHealthScore.toFixed(1)) : 0,
      averageByHour: avg,
      sevenDayAverage: avg,
      headline1:
        latest?.cognitiveStatus === 'HIGH_RISK'
          ? 'Elevated risk indicated by vocal acoustic and pause markers.'
          : latest?.cognitiveStatus === 'MILD_COGNITIVE_IMPAIRMENT_RISK'
          ? 'Mild cognitive variability detected in vocal biomarkers.'
          : 'Voice cognitive biomarkers remain stable within normal parameters.',
      headline2: sel.length
        ? `Across your last ${sel.length} voice assessments, you averaged ${avg}%.`
        : 'No voice assessments recorded yet.',
    },
  };
}

export default function AppleHealthDetailModal({
  visible,
  onClose,
  userId,
  metricType,
  metricTitle,
  iconName,
  iconFamily,
  accentColor,
  unit,
  currentValue,
  isDark,
  theme,
}: AppleHealthDetailModalProps) {
  const [selectedRange, setSelectedRange] = useState<RangeOption>('W');
  const [metricData, setMetricData] = useState<MetricDetailsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBarIdx, setSelectedBarIdx] = useState<number | null>(null);

  // Add Data modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [inputVal, setInputVal] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Fetch metric data whenever range or metricType changes
  useEffect(() => {
    if (!visible || !userId) return;

    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const data =
          metricType === 'cognitive'
            ? await loadCognitive(userId, selectedRange)
            : await api.getMetricDetails(userId, metricType, selectedRange);
        if (isMounted) {
          setSelectedBarIdx(null);
          setMetricData(data);
        }
      } catch (err: any) {
        console.warn('Could not load metric details:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [visible, userId, metricType, selectedRange]);

  const handleSaveData = async () => {
    const num = parseFloat(inputVal.trim());
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Entry', 'Please enter a valid numeric value.');
      return;
    }

    try {
      setSaving(true);
      await api.saveMetricReading(userId, {
        metricType,
        value: num,
      });
      setInputVal('');
      setAddModalOpen(false);
      // Reload chart
      const updated =
        metricType === 'cognitive'
          ? await loadCognitive(userId, selectedRange)
          : await api.getMetricDetails(userId, metricType, selectedRange);
      setMetricData(updated);
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to save health entry.');
    } finally {
      setSaving(false);
    }
  };

  // Render Category Icon helper
  const renderCategoryIcon = (size = 17) => {
    if (iconFamily === 'Ionicons') {
      return <Ionicons name={iconName as any} size={size} color={accentColor} />;
    }
    if (iconFamily === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={iconName as any} size={size} color={accentColor} />;
    }
    return <Feather name={iconName as any} size={size} color={accentColor} />;
  };

  const chartBars = metricData?.bars || [];
  const dataMax = chartBars.reduce((m, b) => Math.max(m, b.value), 0);
  const baseMax = metricData?.yMax || 10000;
  const niceMax = (v: number) => {
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  };
  const yMax = dataMax > baseMax ? niceMax(dataMax) : baseMax;
  const yMid = yMax === baseMax ? metricData?.yMid || yMax / 2 : yMax / 2;
  const barCount = Math.max(1, chartBars.length);
  const plotWidth = SCREEN_WIDTH - 32 - 50 - 8;
  const slotWidth = plotWidth / barCount;
  const barWidth =
    barCount === 1 ? 72 : Math.max(3, Math.min(28, slotWidth * (barCount > 14 ? 0.62 : 0.55)));
  const labelEvery = barCount <= 7 ? 1 : barCount <= 14 ? 2 : barCount <= 31 ? 5 : 4;
  const avgVal = metricData?.average ?? 0;
  const dateRangeLabel = metricData?.dateRangeLabel || '';
  const highlights = metricData?.highlights || {
    today: 0,
    averageByHour: 0,
    sevenDayAverage: 0,
    headline1: 'No data recorded yet.',
    headline2: 'No data recorded yet.',
  };
  const tooltipLabel = metricType === 'steps' ? 'TOTAL' : metricType === 'cognitive' ? 'SCORE' : 'AVERAGE';
  const avgChartHeight = 64;
  const avgScaleMax = Math.max(dataMax, avgVal, 1);
  const rangeText = { D: 'today', W: 'last 7 days', M: 'last 30 days', '6M': 'last 6 months', Y: 'last year' }[selectedRange];
  const avgHeadline =
    metricType === 'cognitive' || chartBars.length === 0
      ? highlights.headline2
      : `Over the ${rangeText}, your average ${metricTitle.toLowerCase()} was ${fmtNum(avgVal)} ${unit}.`;
  const selectedBar = selectedBarIdx !== null ? chartBars[selectedBarIdx] : null;

  const chartHeight = 180;
  const chartWidth = SCREEN_WIDTH - 64;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.modalScreen, { backgroundColor: '#000000' }]}>
        {/* ========================================================= */}
        {/* TOP BAR: Back button, Title, Add Button */}
        {/* ========================================================= */}
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.circularNavBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.navBarTitle}>{metricTitle}</Text>

          <TouchableOpacity
            style={styles.circularNavBtn}
            onPress={() => setAddModalOpen(true)}
            activeOpacity={0.7}
            accessibilityLabel="Add Data"
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========================================================= */}
          {/* RANGE SELECTOR (D, W, M, 6M, Y) */}
          {/* ========================================================= */}
          <View style={styles.rangeSelectorWrap}>
            {(['D', 'W', 'M', '6M', 'Y'] as RangeOption[]).map((r) => {
              const isSelected = selectedRange === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.rangeTab, isSelected && styles.rangeTabSelected]}
                  onPress={() => setSelectedRange(r)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.rangeTabText,
                      { color: isSelected ? '#FFFFFF' : '#8E8E93' },
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ========================================================= */}
          {/* STAT HEADER (Average Value + Date Range) */}
          {/* ========================================================= */}
          <View style={styles.statHeaderWrap}>
            <Text style={styles.statHeaderLabel}>AVERAGE</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statBigNumber}>
                {fmtNum(avgVal)}
              </Text>
              <Text style={styles.statUnitText}>{unit}</Text>
            </View>
            <Text style={styles.statDateRangeText}>{dateRangeLabel}</Text>
          </View>

          {/* Tooltip for the tapped bar (day value) */}
          {selectedBar && (
            <View style={styles.tooltipBox}>
              <Text style={styles.tooltipLabel}>{tooltipLabel}</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.tooltipValue}>{fmtNum(selectedBar.value)}</Text>
                <Text style={styles.tooltipUnit}>{unit}</Text>
              </View>
              <Text style={styles.tooltipDate}>{selectedBar.dateLabel || formatFullDate(selectedBar.date)}</Text>
            </View>
          )}

          {/* ========================================================= */}
          {/* MAIN APPLE HEALTH BAR CHART */}
          {/* ========================================================= */}
          <View style={styles.chartCardWrap}>
            {loading ? (
              <View style={[styles.chartLoadingBox, { height: chartHeight + 35 }]}>
                <ActivityIndicator size="small" color={accentColor} />
              </View>
            ) : (
              <View style={styles.chartContainer}>
                {/* Horizontal Gridlines & Y-Axis Scale */}
                <View style={[styles.gridLineRow, { top: 0 }]}>
                  <View style={styles.gridLineDash} />
                  <Text style={styles.yAxisLabel}>{yMax.toLocaleString()}</Text>
                </View>

                <View style={[styles.gridLineRow, { top: chartHeight / 2 }]}>
                  <View style={styles.gridLineDash} />
                  <Text style={styles.yAxisLabel}>{yMid.toLocaleString()}</Text>
                </View>

                <View style={[styles.gridLineRow, { top: chartHeight }]}>
                  <View style={styles.gridLineDash} />
                  <Text style={styles.yAxisLabel}>0</Text>
                </View>

                {/* Vertical Bars Row */}
                <View style={[styles.barsContainer, { height: chartHeight }]}>
                  {chartBars.map((bar, idx) => {
                    const ratio = Math.min(1, Math.max(0, bar.value / yMax));
                    const barHeight = bar.value > 0 ? Math.max(5, Math.round(ratio * chartHeight)) : 3;
                    const isSel = selectedBarIdx === idx;
                    const showLabel = idx % labelEvery === 0;

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.barItemColumn}
                        activeOpacity={0.8}
                        onPress={() => setSelectedBarIdx(isSel ? null : idx)}
                      >
                        {isSel && (
                          <View pointerEvents="none" style={[styles.selectedGuide, { height: chartHeight }]} />
                        )}
                        <View style={[styles.barSlotWrap, { height: chartHeight }]}>
                          <View
                            style={[
                              styles.appleMainBar,
                              {
                                width: barWidth,
                                height: barHeight,
                                borderRadius: Math.min(6, barWidth / 2),
                                backgroundColor: bar.value > 0 ? accentColor : '#2C2C2E',
                                opacity: selectedBarIdx === null || isSel ? 1 : 0.4,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.barDayLabel, { opacity: showLabel ? 1 : 0 }]} numberOfLines={1}>
                          {bar.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* ========================================================= */}
          {/* TREND PILL ROW */}
          {/* ========================================================= */}
          <View style={styles.trendRowCard}>
            <Text style={styles.trendLabel}>Trend</Text>
            <Text style={styles.trendValue}>{metricData?.trend || 'Unavailable'}</Text>
          </View>

          {/* ========================================================= */}
          {/* HIGHLIGHTS SECTION */}
          {/* ========================================================= */}
          <View style={styles.highlightsHeaderRow}>
            <Text style={styles.highlightsSectionTitle}>Highlights</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.showAllLink}>Show All</Text>
            </TouchableOpacity>
          </View>

          {/* HIGHLIGHT 1: TODAY VS TYPICAL AVERAGE CURVE */}
          <View style={styles.highlightCard}>
            <View style={styles.highlightCardHeader}>
              {renderCategoryIcon(17)}
              <Text style={[styles.highlightCategoryTitle, { color: accentColor }]}>
                {metricTitle}
              </Text>
            </View>

            <Text style={styles.highlightHeadline}>{highlights.headline1}</Text>

            {/* Comparison Legend Values */}
            <View style={styles.comparisonLegendRow}>
              <View style={styles.legendItem}>
                <View style={styles.legendTagRow}>
                  <View style={[styles.legendDot, { backgroundColor: accentColor }]} />
                  <Text style={[styles.legendTagText, { color: accentColor }]}>
                    {metricType === 'cognitive' ? 'Latest' : 'Today'}
                  </Text>
                </View>
                <View style={styles.legendValRow}>
                  <Text style={[styles.legendNumber, { color: accentColor }]}>
                    {fmtNum(highlights.today)}
                  </Text>
                  <Text style={styles.legendUnit}>{unit}</Text>
                </View>
              </View>

              <View style={styles.legendItem}>
                <View style={styles.legendTagRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#8E8E93' }]} />
                  <Text style={[styles.legendTagText, { color: '#8E8E93' }]}>
                    {metricType === 'cognitive' ? 'Average' : 'Typical'}
                  </Text>
                </View>
                <View style={styles.legendValRow}>
                  <Text style={[styles.legendNumber, { color: '#8E8E93' }]}>
                    {fmtNum(highlights.averageByHour)}
                  </Text>
                  <Text style={styles.legendUnit}>{unit}</Text>
                </View>
              </View>
            </View>

            {/* Apple Health Cumulative Timeline Curve (SVG) */}
            <View style={styles.cumulativeGraphBox}>
              <Svg height={90} width={chartWidth}>
                {/* Baseline & Grid */}
                <Line
                  x1={0}
                  y1={80}
                  x2={chartWidth}
                  y2={80}
                  stroke="#2C2C2E"
                  strokeWidth={1}
                />

                {/* Gray Typical Average Curve (Cumulative reaching ~3,658 at end) */}
                <Path
                  d={`M 10 78 Q ${chartWidth * 0.4} 70, ${chartWidth * 0.6} 45 T ${chartWidth - 10} 10`}
                  fill="none"
                  stroke="#48484A"
                  strokeWidth={2.5}
                />

                {/* Vertical Indicator at 3 PM (~60% across) */}
                <Line
                  x1={chartWidth * 0.6}
                  y1={10}
                  x2={chartWidth * 0.6}
                  y2={80}
                  stroke="#3A3A3C"
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />

                {/* Gray Average Dot at 3 PM */}
                <Circle
                  cx={chartWidth * 0.6}
                  cy={45}
                  r={4}
                  fill="#8E8E93"
                />

                {/* Orange Actual Today Curve (Trailing lower up to 3 PM) */}
                <Path
                  d={`M 10 78 Q ${chartWidth * 0.35} 74, ${chartWidth * 0.6} 55`}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={3}
                />

                {/* Orange Active Dot at 3 PM */}
                <Circle
                  cx={chartWidth * 0.6}
                  cy={55}
                  r={4.5}
                  fill={accentColor}
                />
              </Svg>

              {/* Time Axis Labels */}
              <View style={styles.timeAxisRow}>
                <Text style={styles.timeAxisLabel}>
                  {metricType === 'cognitive' ? 'Earlier' : '12 AM'}
                </Text>
                <Text style={[styles.timeAxisLabel, { textAlign: 'center' }]}>
                  {metricType === 'cognitive' ? 'Mid' : '3 PM'}
                </Text>
                <Text style={[styles.timeAxisLabel, { textAlign: 'right' }]}>
                  {metricType === 'cognitive' ? 'Recent' : '12 AM'}
                </Text>
              </View>
            </View>
          </View>

          {/* HIGHLIGHT 2: 7-DAY AVERAGE BENCHMARK */}
          <View style={styles.highlightCard}>
            <View style={styles.highlightCardHeader}>
              {renderCategoryIcon(17)}
              <Text style={[styles.highlightCategoryTitle, { color: accentColor }]}>
                {metricTitle}
              </Text>
            </View>

            <Text style={styles.highlightHeadline}>{avgHeadline}</Text>

            <Text style={styles.sevenDayBenchmarkLabel}>
              {metricType === 'cognitive' ? 'Assessment Average' : `Average ${metricTitle}`}
            </Text>

            <View style={styles.legendValRow}>
              <Text style={[styles.legendNumber, { color: '#FFFFFF' }]}>{fmtNum(avgVal)}</Text>
              <Text style={styles.legendUnit}>{unit}</Text>
            </View>

            {/* Mini bars with the average line at its true height */}
            <View style={[styles.avgChartBox, { height: avgChartHeight }]}>
              <View style={styles.avgBarsRow}>
                {chartBars.map((bar, i) => {
                  const h = bar.value > 0 ? Math.max(3, Math.round((bar.value / avgScaleMax) * avgChartHeight)) : 2;
                  return (
                    <View key={i} style={styles.avgBarSlot}>
                      <View
                        style={{
                          width: Math.max(3, Math.min(10, slotWidth * 0.5)),
                          height: h,
                          borderRadius: 3,
                          backgroundColor: bar.value >= avgVal && bar.value > 0 ? accentColor : '#3A3A3C',
                        }}
                      />
                    </View>
                  );
                })}
              </View>
              {avgVal > 0 && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.avgLine,
                    { bottom: Math.round((avgVal / avgScaleMax) * avgChartHeight), backgroundColor: accentColor },
                  ]}
                />
              )}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ========================================================= */}
        {/* ADD DATA MODAL */}
        {/* ========================================================= */}
        <Modal visible={addModalOpen} transparent animationType="fade">
          <View style={styles.addModalOverlay}>
            <View style={styles.addModalBox}>
              <View style={styles.addModalHeader}>
                <Text style={styles.addModalTitle}>Add {metricTitle} Data</Text>
                <TouchableOpacity onPress={() => setAddModalOpen(false)}>
                  <Feather name="x" size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputPromptText}>
                Enter reading in {unit}:
              </Text>

              <TextInput
                style={styles.modalTextInput}
                placeholder={`e.g. ${currentValue || '1000'}`}
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={inputVal}
                onChangeText={setInputVal}
                autoFocus
              />

              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#2C2C2E' }]}
                  onPress={() => setAddModalOpen(false)}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: accentColor }]}
                  onPress={handleSaveData}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES (Exact iOS Apple Health Theme)
// ============================================================================
const styles = StyleSheet.create({
  modalScreen: {
    flex: 1,
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  circularNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Range Selector
  rangeSelectorWrap: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 3,
    marginTop: 6,
    marginBottom: 16,
  },
  rangeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  rangeTabSelected: {
    backgroundColor: '#3A3A3C',
  },
  rangeTabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Stat Header
  statHeaderWrap: {
    marginBottom: 14,
  },
  statHeaderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  statBigNumber: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statUnitText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  statDateRangeText: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 3,
  },

  // Main Bar Chart
  chartCardWrap: {
    marginBottom: 14,
    paddingTop: 8,
  },
  chartLoadingBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContainer: {
    position: 'relative',
    height: 220,
    paddingRight: 50,
    paddingBottom: 6,
  },
  gridLineRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLineDash: {
    flex: 1,
    height: 1,
    backgroundColor: '#2C2C2E',
  },
  yAxisLabel: {
    width: 48,
    textAlign: 'right',
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  barItemColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barSlotWrap: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  appleMainBar: {
    width: 28,
  },
  barDayLabel: {
    width: 56,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 8,
  },

  // Trend Pill Card
  trendRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  trendLabel: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  trendValue: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Highlights Section
  highlightsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  highlightsSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  showAllLink: {
    fontSize: 15,
    color: '#0A84FF',
    fontWeight: '500',
  },
  highlightCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  highlightCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  highlightCategoryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  highlightHeadline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 14,
  },
  comparisonLegendRow: {
    flexDirection: 'row',
    gap: 28,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: 'column',
  },
  legendTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  legendValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  legendNumber: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  legendUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 4,
  },
  cumulativeGraphBox: {
    marginTop: 4,
  },
  timeAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeAxisLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    width: 50,
  },
  sevenDayBenchmarkLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 8,
  },
  avgChartBox: {
    marginTop: 12,
    position: 'relative',
  },
  avgBarsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  avgBarSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  benchmarkLine: {
    height: 3,
    borderRadius: 1.5,
    marginVertical: 8,
  },
  sevenDayValueAndBgBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  bgBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 36,
  },
  bgMiniBar: {
    width: 6,
    borderRadius: 3,
  },

  // Add Data Modal
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  addModalBox: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  addModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  addModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inputPromptText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  modalTextInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 18,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedGuide: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: '#636366',
  },
  tooltipBox: {
    alignSelf: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
    minWidth: 170,
  },
  tooltipLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  tooltipValue: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  tooltipUnit: { fontSize: 15, fontWeight: '500', color: '#8E8E93', marginLeft: 6 },
  tooltipDate: { fontSize: 13, fontWeight: '500', color: '#8E8E93', marginTop: 2 },
});
