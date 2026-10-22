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
import { api, MetricDetailsResponse } from '@/services/api';

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
        const data = await api.getMetricDetails(userId, metricType, selectedRange);
        if (isMounted) {
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
      const updated = await api.getMetricDetails(userId, metricType, selectedRange);
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

  const chartBars = metricData?.bars || [
    { label: 'Fri', value: 3850, date: '2026-10-16' },
    { label: 'Sat', value: 6820, date: '2026-10-17' },
    { label: 'Sun', value: 5480, date: '2026-10-18' },
    { label: 'Mon', value: 320, date: '2026-10-19' },
    { label: 'Tue', value: 7040, date: '2026-10-20' },
    { label: 'Wed', value: 310, date: '2026-10-21' },
    { label: 'Thu', value: 468, date: '2026-10-22' },
  ];

  const yMax = metricData?.yMax || 10000;
  const yMid = metricData?.yMid || 5000;
  const avgVal = metricData?.average || 3347;
  const dateRangeLabel = metricData?.dateRangeLabel || '16 – 22 Oct 2026';
  const highlights = metricData?.highlights || {
    today: 468,
    averageByHour: 887,
    sevenDayAverage: 3658,
    headline1: "You're walking less than you usually do by this point.",
    headline2: 'Over the last 7 days, you took an average of 3,658 steps.',
  };

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
                {avgVal.toLocaleString()}
              </Text>
              <Text style={styles.statUnitText}>{unit}</Text>
            </View>
            <Text style={styles.statDateRangeText}>{dateRangeLabel}</Text>
          </View>

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
                    const barHeight = Math.max(4, Math.round(ratio * chartHeight));

                    return (
                      <View key={idx} style={styles.barItemColumn}>
                        <View style={[styles.barSlotWrap, { height: chartHeight }]}>
                          <View
                            style={[
                              styles.appleMainBar,
                              {
                                height: barHeight,
                                backgroundColor: accentColor,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.barDayLabel}>{bar.label}</Text>
                      </View>
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
                    {highlights.today.toLocaleString()}
                  </Text>
                  <Text style={styles.legendUnit}>{unit}</Text>
                </View>
              </View>

              <View style={styles.legendItem}>
                <View style={styles.legendTagRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#8E8E93' }]} />
                  <Text style={[styles.legendTagText, { color: '#8E8E93' }]}>
                    {metricType === 'cognitive' ? 'Baseline' : 'Average'}
                  </Text>
                </View>
                <View style={styles.legendValRow}>
                  <Text style={[styles.legendNumber, { color: '#8E8E93' }]}>
                    {highlights.averageByHour.toLocaleString()}
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

            <Text style={styles.highlightHeadline}>{highlights.headline2}</Text>

            <Text style={styles.sevenDayBenchmarkLabel}>
              {metricType === 'cognitive' ? 'Assessment Benchmark' : `Average ${metricTitle}`}
            </Text>

            {/* Solid Horizontal Benchmark Line */}
            <View style={[styles.benchmarkLine, { backgroundColor: accentColor }]} />

            <View style={styles.sevenDayValueAndBgBarsRow}>
              <View style={styles.legendValRow}>
                <Text style={[styles.legendNumber, { color: '#FFFFFF' }]}>
                  {highlights.sevenDayAverage.toLocaleString()}
                </Text>
                <Text style={styles.legendUnit}>{unit}</Text>
              </View>

              {/* Subtle Daily Comparison Bars in Background */}
              <View style={styles.bgBarsRow}>
                {[0.4, 0.7, 0.55, 0.25, 0.85, 0.2, 0.45].map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bgMiniBar,
                      {
                        height: Math.round(h * 36),
                        backgroundColor: '#3A3A3C',
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>

        {/* Floating Apple Health Tab Bar (Summary / Sharing / Browse) */}
        <View style={styles.floatingTabBarWrap} pointerEvents="box-none">
          <View style={styles.floatingTabBarPill}>
            <TouchableOpacity style={styles.tabBarItem} activeOpacity={0.8} onPress={onClose}>
              <Ionicons name="heart" size={21} color="#0A84FF" />
              <Text style={[styles.tabBarItemText, { color: '#0A84FF', fontWeight: '600' }]}>Summary</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabBarItem} activeOpacity={0.8}>
              <Ionicons name="people" size={21} color="#8E8E93" />
              <Text style={styles.tabBarItemText}>Sharing</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabBarItem} activeOpacity={0.8}>
              <Ionicons name="grid" size={20} color="#8E8E93" />
              <Text style={styles.tabBarItemText}>Browse</Text>
            </TouchableOpacity>
          </View>
        </View>

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
    justifyContent: 'space-between',
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
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barDayLabel: {
    fontSize: 12,
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

  // Floating Tab Bar (Apple Health 3-Tab Pill)
  floatingTabBarWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTabBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(30, 30, 32, 0.88)',
    borderRadius: 36,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 260,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  tabBarItemText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 3,
  },
});
