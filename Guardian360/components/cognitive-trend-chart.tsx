import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api, CognitiveTrendData, VoiceAnalysisRecord } from '@/services/api';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 72;
const CHART_HEIGHT = 160;

interface Props {
  userId?: string;
  refreshTrigger?: number;
}

export function CognitiveTrendChart({ userId, refreshTrigger }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [data, setData] = useState<CognitiveTrendData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const theme = {
    cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    accent: '#007AFF',
    purple: '#8B5CF6',
    border: isDark ? '#38383A' : '#E5E5EA',
    lineColor: '#34C759',
    lineGradient: 'rgba(52, 199, 89, 0.15)',
    gridLine: isDark ? '#2C2C2E' : '#F2F2F7',
    badgeNormalBg: 'rgba(52, 199, 89, 0.12)',
    badgeNormalText: '#34C759',
    badgeRiskBg: 'rgba(255, 149, 0, 0.12)',
    badgeRiskText: '#FF9500',
    inputBg: isDark ? '#2C2C2E' : '#F2F2F7',
  };

  const fetchTrends = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await api.getUserCognitiveTrends(userId);
      setData(res);
      if (res.trends && res.trends.length > 0) {
        setSelectedIndex(res.trends.length - 1);
      }
    } catch (err) {
      console.warn('Error fetching cognitive trends:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends, refreshTrigger]);

  // Periodic poll so voice tests run via device auto-sync without restarting app
  useEffect(() => {
    const interval = setInterval(() => {
      if (userId && !loading) {
        api.getUserCognitiveTrends(userId).then((res) => {
          setData(res);
        }).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [userId, loading]);

  const points = data?.trends || [];
  const activeRecord: VoiceAnalysisRecord | null =
    selectedIndex !== null && points[selectedIndex]
      ? points[selectedIndex]
      : data?.latestReport || null;

  // Render SVG / Line calculations
  const minScore = 50;
  const maxScore = 100;

  const getY = (val: number) => {
    const clamped = Math.max(minScore, Math.min(maxScore, val));
    const ratio = (clamped - minScore) / (maxScore - minScore);
    return CHART_HEIGHT - ratio * (CHART_HEIGHT - 30) - 15;
  };

  const getX = (idx: number) => {
    if (points.length <= 1) return CHART_WIDTH / 2;
    const step = CHART_WIDTH / (points.length - 1);
    return idx * step;
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="brain" size={22} color={theme.purple} style={{ marginRight: 6 }} />
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Cognitive Analysis</Text>
          </View>
          
        </View>

        <TouchableOpacity
          style={[styles.refreshIconBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', borderColor: theme.border }]}
          onPress={() => fetchTrends()}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={14} color={loading ? theme.textSecondary : theme.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={{ color: theme.textSecondary, marginTop: 8, fontSize: 13 }}>
            Loading cognitive report data...
          </Text>
        </View>
      ) : (
        <>
          {/* Health Score Summary Banner */}
          <View style={styles.scoreRow}>
            <View>
              <Text style={[styles.scoreValue, { color: theme.textPrimary }]}>
                {activeRecord ? `${activeRecord.cognitiveHealthScore.toFixed(1)}%` : '--'}
              </Text>
              <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>
                {activeRecord
                  ? `Report Date: ${new Date(activeRecord.timestamp).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}`
                  : 'Cognitive Score'}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    activeRecord?.cognitiveStatus === 'NORMAL'
                      ? theme.badgeNormalBg
                      : theme.badgeRiskBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      activeRecord?.cognitiveStatus === 'NORMAL'
                        ? theme.badgeNormalText
                        : theme.badgeRiskText,
                  },
                ]}
              >
                {activeRecord?.cognitiveStatus === 'NORMAL'
                  ? 'NORMAL COGNITION'
                  : 'MILD RISK'}
              </Text>
            </View>
          </View>

          {/* Line Chart Visualizer Container */}
          <View style={styles.chartContainer}>
            {/* Grid Background Lines */}
            <View style={[styles.gridLine, { top: 20, backgroundColor: theme.gridLine }]} />
            <View style={[styles.gridLine, { top: CHART_HEIGHT / 2, backgroundColor: theme.gridLine }]} />
            <View style={[styles.gridLine, { bottom: 10, backgroundColor: theme.gridLine }]} />

            {/* Line Points */}
            <View style={styles.pointsOverlay}>
              {points.map((pt, idx) => {
                const cx = getX(idx);
                const cy = getY(pt.cognitiveHealthScore);
                const isSelected = selectedIndex === idx;

                return (
                  <TouchableOpacity
                    key={pt.id || idx}
                    style={[
                      styles.nodeDot,
                      {
                        left: cx - (isSelected ? 8 : 5),
                        top: cy - (isSelected ? 8 : 5),
                        width: isSelected ? 16 : 10,
                        height: isSelected ? 16 : 10,
                        borderRadius: isSelected ? 8 : 5,
                        backgroundColor: isSelected ? theme.purple : theme.lineColor,
                        borderColor: '#FFF',
                        borderWidth: isSelected ? 3 : 1.5,
                      },
                    ]}
                    onPress={() => setSelectedIndex(idx)}
                    activeOpacity={0.7}
                  />
                );
              })}
            </View>
          </View>

          {/* Time Axis Dates */}
          <View style={styles.xAxisRow}>
            {points.length > 0 && (
              <>
                <Text style={[styles.xLabel, { color: theme.textSecondary }]}>
                  {new Date(points[0].timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={[styles.xLabel, { color: theme.textSecondary }]}>
                  {new Date(points[Math.floor(points.length / 2)].timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={[styles.xLabel, { color: theme.textSecondary }]}>
                  {new Date(points[points.length - 1].timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshIconBtn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chartContainer: {
    height: CHART_HEIGHT,
    width: CHART_WIDTH,
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  pointsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  nodeDot: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  xLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
