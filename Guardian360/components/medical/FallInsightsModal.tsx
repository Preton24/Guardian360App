import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, FallInsights } from '@/services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  isDark: boolean;
  theme: any;
}

const RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];
const ACCENT = '#FF9500';
const ALERT = '#FF3B30';
const CHART_W = Dimensions.get('window').width - 32 - 32; // screen - scroll padding - card padding
const CHART_H = 140;
const AXIS_H = 18;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'PM' : 'AM'}`;

function BarChart({
  values,
  colors,
  labels,
  mutedColor,
}: {
  values: number[];
  colors: string[];
  labels: { index: number; text: string }[];
  mutedColor: string;
}) {
  const max = Math.max(1, ...values);
  const gap = values.length > 40 ? 1 : 3;
  const barW = Math.max(2, (CHART_W - gap * (values.length - 1)) / values.length);
  return (
    <Svg width={CHART_W} height={CHART_H + AXIS_H}>
      <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={mutedColor} strokeOpacity={0.4} strokeWidth={1} />
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(3, (v / max) * (CHART_H - 14)) : 0;
        return (
          <Rect
            key={i}
            x={i * (barW + gap)}
            y={CHART_H - h}
            width={barW}
            height={h}
            rx={Math.min(3, barW / 2)}
            fill={colors[i]}
          />
        );
      })}
      <SvgText x={0} y={10} fontSize={10} fill={mutedColor}>{`max ${max}`}</SvgText>
      {labels.map((l) => (
        <SvgText
          key={l.index}
          x={Math.min(CHART_W - 2, l.index * (barW + gap) + barW / 2)}
          y={CHART_H + 13}
          fontSize={10}
          fill={mutedColor}
          textAnchor={l.index === 0 ? 'start' : l.index >= values.length - 1 ? 'end' : 'middle'}
        >
          {l.text}
        </SvgText>
      ))}
    </Svg>
  );
}

export default function FallInsightsModal({ visible, onClose, userId, isDark, theme }: Props) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<FallInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getFallInsights(userId, days)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e?.message || 'Could not load fall data'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, userId, days]);

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const muted = theme.textSecondary;

  const timeline = data?.timeline ?? [];
  const peak = data?.peakWindow;
  const inPeak = (h: number) =>
    !!peak && [0, 1, 2].some((o) => (peak.startHour + o) % 24 === h);

  const timelineLabels = timeline.length
    ? [
        { index: 0, text: shortDate(timeline[0].date) },
        { index: Math.floor(timeline.length / 2), text: shortDate(timeline[Math.floor(timeline.length / 2)].date) },
        { index: timeline.length - 1, text: shortDate(timeline[timeline.length - 1].date) },
      ]
    : [];
  const hourLabels = [0, 6, 12, 18, 23].map((h) => ({ index: h, text: hourLabel(h) }));

  const trendColor = data?.trend === 'rising' ? ALERT : data?.trend === 'falling' ? '#34C759' : muted;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="alert-octagon-outline" size={22} color={ACCENT} />
            <Text style={[styles.title, { color: theme.textPrimary }]}>Fall Events</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={muted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.segment, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r.label}
                style={[styles.segmentBtn, days === r.days && { backgroundColor: isDark ? '#636366' : '#FFFFFF' }]}
                onPress={() => setDays(r.days)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, { color: theme.textPrimary, fontWeight: days === r.days ? '700' : '500' }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && !data ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} />
          ) : error ? (
            <Text style={{ color: ALERT, marginTop: 24 }}>{error}</Text>
          ) : data ? (
            <>
              <View style={styles.statRow}>
                <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                  <Text style={[styles.statValue, { color: theme.textPrimary }]}>{data.eventsInRange}</Text>
                  <Text style={[styles.statLabel, { color: muted }]}>Falls in {days} days</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                  <Text style={[styles.statValue, { color: theme.textPrimary }]}>{data.avgPerWeek}</Text>
                  <Text style={[styles.statLabel, { color: muted }]}>Avg falls / week</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                  <Text style={[styles.statValue, { color: trendColor }]}>
                    {data.trend === 'rising' ? '↑' : data.trend === 'falling' ? '↓' : '→'} {data.last7Days}
                  </Text>
                  <Text style={[styles.statLabel, { color: muted }]}>Last 7 days</Text>
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: cardBg }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Falls over time</Text>
                <Text style={[styles.cardSub, { color: muted }]}>Falls detected per day</Text>
                <BarChart
                  values={timeline.map((t) => t.count)}
                  colors={timeline.map((t) => (t.count >= 5 ? ALERT : ACCENT))}
                  labels={timelineLabels}
                  mutedColor={muted}
                />
              </View>

              <View style={[styles.card, { backgroundColor: cardBg }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Time of day</Text>
                <Text style={[styles.cardSub, { color: muted }]}>
                  When falls were recorded (all {data.totalEvents} falls)
                </Text>
                <BarChart
                  values={data.hourly}
                  colors={data.hourly.map((_, h) => (inPeak(h) ? ALERT : ACCENT + '99'))}
                  labels={hourLabels}
                  mutedColor={muted}
                />
              </View>

              {peak && (
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                  <Text style={[styles.cardSub, { color: muted, marginBottom: 4 }]}>Most falls happen</Text>
                  <Text style={[styles.peakValue, { color: theme.textPrimary }]}>{peak.label}</Text>
                  <Text style={[styles.cardSub, { color: muted, marginTop: 4, marginBottom: 0 }]}>
                    {peak.share}% of falls · about {data.avgPerWeek} a week
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { fontSize: 20, fontWeight: '700', marginLeft: 8 },
  content: { padding: 16, paddingBottom: 48 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2, marginBottom: 16 },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  segmentText: { fontSize: 13 },
  statRow: { flexDirection: 'row', marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, marginHorizontal: 4 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  peakValue: { fontSize: 22, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 2, marginBottom: 12 },
});
