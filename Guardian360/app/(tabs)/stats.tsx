import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { api, ReminderItem } from '@/services/api';

const { width } = Dimensions.get('window');

interface RoutineTab {
  id: string;
  title: string;
  icon: string;
  type: 'feather' | 'material' | 'font-awesome';
}

export default function StatsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { activeTheme } = useTheme();
  const { selectedUser } = useApp();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeRoutine, setActiveRoutine] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const theme = {
    background: isDark ? '#000000' : '#F2F2F7',
    cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    primary: '#FF2D55', // Apple Pink/Red
    primaryLight: 'rgba(255, 45, 85, 0.1)',
    border: isDark ? '#38383A' : '#C6C6C8',
    calendarDay: isDark ? '#FFFFFF' : '#000000',
    calendarMuted: isDark ? '#48484A' : '#C7C7CC',
    orange: '#FF9500',
    blue: '#007AFF',
    teal: '#34C759',
    purple: '#AF52DE',
  };

  const fetchReminders = useCallback(async () => {
    if (!selectedUser?.id) {
      setReminders([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.getUserReminders(selectedUser.id);
      setReminders(data);
    } catch (err) {
      console.error('Error fetching reminders for stats:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  useFocusEffect(
    useCallback(() => {
      fetchReminders();
    }, [fetchReminders])
  );

  // Helper to extract YYYY-MM-DD
  const getReminderDateStr = (r: ReminderItem): string => {
    const raw = r.date || r.createdAt;
    if (!raw) return '';
    return raw.split('T')[0];
  };

  // Build dynamic routine tabs based strictly on actual reminders/routines in DB
  const getRoutines = (): RoutineTab[] => {
    const base: RoutineTab[] = [
      { id: 'all', title: 'Overall', icon: 'border-all', type: 'material' },
    ];

    // Add unique routine titles actually present in DB reminders for this user
    const existingTitles = Array.from(new Set(reminders.map((r) => r.title.trim()))).filter(Boolean);
    existingTitles.forEach((t) => {
      const lower = t.toLowerCase();
      let icon = 'check-circle';
      let type: RoutineTab['type'] = 'feather';

      if (lower.includes('workout') || lower.includes('gym')) {
        icon = 'dumbbell';
        type = 'font-awesome';
      } else if (lower.includes('water') || lower.includes('drink')) {
        icon = 'droplet';
        type = 'feather';
      } else if (lower.includes('med') || lower.includes('pill')) {
        icon = 'pill';
        type = 'material';
      } else if (lower.includes('eat') || lower.includes('food') || lower.includes('lunch') || lower.includes('diet')) {
        icon = 'food-apple';
        type = 'material';
      } else if (lower.includes('travel') || lower.includes('flight')) {
        icon = 'airplane';
        type = 'material';
      } else if (lower.includes('skin') || lower.includes('face')) {
        icon = 'face-woman';
        type = 'material';
      }

      base.push({
        id: `title:${t}`,
        title: t,
        icon,
        type,
      });
    });

    return base;
  };

  const routines = getRoutines();
  const currentRoutineObj = routines.find((r) => r.id === activeRoutine) || routines[0];

  // Filter reminders for active tab
  const getFilteredReminders = (routineId: string): ReminderItem[] => {
    if (routineId === 'all') return reminders;
    if (routineId.startsWith('title:')) {
      const targetTitle = routineId.replace('title:', '');
      return reminders.filter((r) => r.title.trim() === targetTitle);
    }
    return reminders.filter((r) => r.title.trim() === routineId);
  };

  const activeReminders = getFilteredReminders(activeRoutine);

  // Month navigation helpers
  const prevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Calendar rendering helper
  const renderCalendar = () => {
    const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthName = currentDate.toLocaleString('default', { month: '2-digit' });
    const formattedHeader = `${monthName}/${year}`;

    const daysInMonthCount = new Date(year, month + 1, 0).getDate();
    const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

    // Padding days for previous month
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    const prevPaddingDays = Array.from({ length: firstDayIndex }, (_, i) => prevMonthLastDate - firstDayIndex + 1 + i);

    // Highlighting days where reminders are completed in this month
    const highlightedDays: number[] = [];
    activeReminders.forEach((r) => {
      if (r.completed) {
        const dateStr = getReminderDateStr(r);
        if (dateStr) {
          const [rYear, rMonth, rDay] = dateStr.split('-').map(Number);
          if (rYear === year && rMonth === month + 1) {
            if (!highlightedDays.includes(rDay)) {
              highlightedDays.push(rDay);
            }
          }
        }
      }
    });

    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
    const todayDate = now.getDate();

    return (
      <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-left" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.calendarMonth, { color: theme.textPrimary }]}>{formattedHeader}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarDaysRow}>
          {daysOfWeek.map((day, i) => (
            <Text key={i} style={[styles.calendarDayText, { color: theme.textPrimary }]}>{day}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {/* Previous month padding */}
          {prevPaddingDays.map((day) => (
            <View key={`pad-${day}`} style={styles.calendarCell}>
              <Text style={[styles.calendarDate, { color: theme.calendarMuted }]}>{day}</Text>
            </View>
          ))}

          {/* Actual month days */}
          {daysInMonth.map((day) => {
            const isHighlighted = highlightedDays.includes(day);
            const isToday = isCurrentMonth && day === todayDate;

            return (
              <View key={day} style={styles.calendarCell}>
                <View
                  style={[
                    styles.dateCircle,
                    isHighlighted && { backgroundColor: theme.primary, borderColor: theme.primary, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDate,
                      { color: theme.calendarDay },
                      isHighlighted && { color: '#FFFFFF', fontWeight: '700' },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {isToday && <View style={styles.todayDot} />}
              </View>
            );
          })}

          {/* Next month padding to keep grid complete (42 cells total) */}
          {Array.from({ length: (42 - (prevPaddingDays.length + daysInMonth.length)) % 7 }).map((_, i) => (
            <View key={`next-${i + 1}`} style={styles.calendarCell}>
              <Text style={[styles.calendarDate, { color: theme.calendarMuted }]}>{i + 1}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Compute stats metrics
  const totalCount = activeReminders.length;
  const completedCount = activeReminders.filter((r) => r.completed).length;
  const overallRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Streak calculations
  const computeStreaks = (items: ReminderItem[]) => {
    const completedDates = Array.from(
      new Set(items.filter((r) => r.completed).map(getReminderDateStr).filter(Boolean))
    ).sort();

    let bestStreak = 0;
    let currentStreak = 0;
    let perfectDays = 0;

    // Perfect days count: days where all reminders for that date were completed
    const dateMap: Record<string, { total: number; completed: number }> = {};
    items.forEach((r) => {
      const d = getReminderDateStr(r);
      if (!d) return;
      if (!dateMap[d]) dateMap[d] = { total: 0, completed: 0 };
      dateMap[d].total += 1;
      if (r.completed) dateMap[d].completed += 1;
    });

    Object.values(dateMap).forEach((v) => {
      if (v.completed > 0 && v.completed === v.total) {
        perfectDays += 1;
      }
    });

    if (completedDates.length > 0) {
      const dateObjs = completedDates.map((d) => new Date(d));
      let tempStreak = 1;
      bestStreak = 1;

      for (let i = 1; i < dateObjs.length; i++) {
        const diffDays = Math.round((dateObjs[i].getTime() - dateObjs[i - 1].getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          tempStreak += 1;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      }

      // Calculate current streak
      const todayStr = new Date().toISOString().split('T')[0];
      let checkDate = new Date(todayStr);
      let checkStr = checkDate.toISOString().split('T')[0];

      if (!completedDates.includes(checkStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
        checkStr = checkDate.toISOString().split('T')[0];
      }

      while (completedDates.includes(checkStr)) {
        currentStreak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
        checkStr = checkDate.toISOString().split('T')[0];
      }
    }

    // Success count in current month
    const curYear = currentDate.getFullYear();
    const curMonth = currentDate.getMonth() + 1;
    const monthSuccessDays = completedDates.filter((d) => {
      const [y, m] = d.split('-').map(Number);
      return y === curYear && m === curMonth;
    }).length;

    return {
      currentStreak,
      bestStreak,
      perfectDays,
      monthSuccessDays,
      totalSuccessDays: completedDates.length,
    };
  };

  const statsMetrics = computeStreaks(activeReminders);

  // Grouping for Routine Completion (Overall View)
  const getTaskBreakdown = () => {
    const grouped: Record<string, { title: string; total: number; completed: number; category: string }> = {};

    reminders.forEach((r) => {
      const key = r.title.trim();
      if (!grouped[key]) {
        grouped[key] = { title: key, total: 0, completed: 0, category: r.category };
      }
      grouped[key].total += 1;
      if (r.completed) grouped[key].completed += 1;
    });

    return Object.values(grouped);
  };

  const taskBreakdowns = getTaskBreakdown();

  // Helper to render icon for Breakdown items
  const renderBreakdownIcon = (title: string, category: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('water') || lower.includes('drink')) {
      return <Feather name="droplet" size={16} color={theme.blue} />;
    }
    if (lower.includes('med') || lower.includes('pill') || category === 'MEDS') {
      return <MaterialCommunityIcons name="pill" size={16} color={theme.teal} />;
    }
    if (lower.includes('lunch') || lower.includes('eat') || lower.includes('food') || lower.includes('diet')) {
      return <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={theme.orange} />;
    }
    if (lower.includes('gym') || lower.includes('workout')) {
      return <FontAwesome5 name="dumbbell" size={14} color={theme.purple} />;
    }
    return <Feather name="check-circle" size={16} color={theme.primary} />;
  };

  const getBreakdownBg = (title: string, category: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('water') || lower.includes('drink')) return 'rgba(59, 130, 246, 0.1)';
    if (lower.includes('med') || lower.includes('pill') || category === 'MEDS') return 'rgba(16, 185, 129, 0.1)';
    if (lower.includes('lunch') || lower.includes('eat') || lower.includes('food') || lower.includes('diet')) return 'rgba(245, 158, 11, 0.1)';
    if (lower.includes('gym') || lower.includes('workout')) return 'rgba(139, 92, 246, 0.1)';
    return theme.primaryLight;
  };

  const getBreakdownColor = (title: string, category: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('water') || lower.includes('drink')) return theme.blue;
    if (lower.includes('med') || lower.includes('pill') || category === 'MEDS') return theme.teal;
    if (lower.includes('lunch') || lower.includes('eat') || lower.includes('food') || lower.includes('diet')) return theme.orange;
    if (lower.includes('gym') || lower.includes('workout')) return theme.purple;
    return theme.primary;
  };

  // Yearly Status helper
  const renderYearlyStatus = () => {
    const completedSet = new Set(activeReminders.filter((r) => r.completed).map(getReminderDateStr));
    const yearStr = String(currentDate.getFullYear());

    return (
      <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <View style={styles.yearlyHeader}>
          <Text style={[styles.yearlyTitle, { color: theme.textPrimary }]}>Yearly Status</Text>
          <View style={styles.yearDropdown}>
            <Text style={styles.yearText}>{yearStr}</Text>
            <Feather name="chevron-down" size={14} color="#888" style={{ marginLeft: 4 }} />
          </View>
        </View>

        {/* Matrix graph populated by actual database completion */}
        <View style={styles.matrixContainer}>
          {Array.from({ length: 7 }).map((_, row) => (
            <View key={row} style={styles.matrixRow}>
              {Array.from({ length: 24 }).map((_, col) => {
                // Calculate date for block
                const daysAgo = (23 - col) * 7 + row;
                const d = new Date();
                d.setDate(d.getDate() - daysAgo);
                const dStr = d.toISOString().split('T')[0];
                const isActive = completedSet.has(dStr);

                return (
                  <View
                    key={col}
                    style={[
                      styles.matrixBlock,
                      { backgroundColor: isActive ? theme.primary : isDark ? '#334155' : '#F1F5F9' },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.titleDropdown}>
          {currentRoutineObj.type === 'material' ? (
            <MaterialCommunityIcons name={currentRoutineObj.icon as any} size={20} color={theme.primary} />
          ) : currentRoutineObj.type === 'font-awesome' ? (
            <FontAwesome5 name={currentRoutineObj.icon} size={18} color={theme.primary} />
          ) : (
            <Feather name={currentRoutineObj.icon as any} size={20} color={theme.primary} />
          )}
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{currentRoutineObj.title}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: theme.primaryLight }]}
          onPress={() => router.push('/new-reminder')}
        >
          <Feather name="plus" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Routine Tabs */}
      <View style={styles.routineTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {routines.map((routine) => {
            const isActive = activeRoutine === routine.id;
            return (
              <TouchableOpacity
                key={routine.id}
                style={styles.tabIconWrapper}
                onPress={() => setActiveRoutine(routine.id)}
              >
                <View style={styles.tabIcon}>
                  {routine.type === 'material' ? (
                    <MaterialCommunityIcons
                      name={routine.icon as any}
                      size={24}
                      color={isActive ? theme.primary : theme.calendarMuted}
                    />
                  ) : routine.type === 'font-awesome' ? (
                    <FontAwesome5
                      name={routine.icon}
                      size={22}
                      color={isActive ? theme.primary : theme.calendarMuted}
                    />
                  ) : (
                    <Feather
                      name={routine.icon as any}
                      size={22}
                      color={isActive ? theme.primary : theme.calendarMuted}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCalendar()}

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : activeRoutine === 'all' ? (
          /* Overall View Content */
          <View style={[styles.card, { backgroundColor: theme.cardBg, paddingVertical: 40 }]}>
            {/* Circular Progress Indicator */}
            <View style={styles.circularProgressContainer}>
              <View style={[styles.progressCircleBg, { borderColor: theme.primaryLight }]}>
                <View style={styles.progressCircleInner}>
                  <Text style={[styles.progressPercentage, { color: theme.textPrimary }]}>
                    {overallRate.toFixed(1)}%
                  </Text>
                  <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Overall Rate</Text>
                  <Feather name="repeat" size={16} color={theme.textSecondary} style={{ marginTop: 8 }} />
                </View>
              </View>
              <View
                style={[
                  styles.progressStrokeMock,
                  {
                    borderTopColor: theme.primary,
                    borderRightColor: overallRate > 25 ? theme.primary : 'transparent',
                    borderBottomColor: overallRate > 50 ? theme.primary : 'transparent',
                    borderLeftColor: overallRate > 75 ? theme.primary : 'transparent',
                  },
                ]}
              />
            </View>

            <View style={styles.overallStatsRow}>
              <View style={styles.overallStatItem}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Feather name="award" size={18} color={theme.orange} />
                </View>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                  {statsMetrics.bestStreak}
                  <Text style={styles.statUnit}>Days</Text>
                </Text>
                <Text style={[styles.statDesc, { color: theme.textSecondary }]}>Best Streaks</Text>
              </View>

              <View style={styles.overallStatItem}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Feather name="calendar" size={18} color={theme.blue} />
                </View>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                  {statsMetrics.perfectDays}
                  <Text style={styles.statUnit}>Days</Text>
                </Text>
                <Text style={[styles.statDesc, { color: theme.textSecondary }]}>Perfect Days</Text>
              </View>
            </View>

            {/* Task Breakdown Section */}
            <View style={[styles.taskBreakdownContainer, { borderTopColor: theme.border }]}>
              <Text style={[styles.taskBreakdownTitle, { color: theme.textPrimary }]}>Routine Completion</Text>

              {taskBreakdowns.length === 0 ? (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: 12 }}>
                  No active routines found in database.
                </Text>
              ) : (
                taskBreakdowns.map((item, idx) => {
                  const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                  const itemColor = getBreakdownColor(item.title, item.category);
                  const itemBg = getBreakdownBg(item.title, item.category);

                  return (
                    <View key={idx} style={styles.taskBreakdownItem}>
                      <View style={[styles.taskIconBg, { backgroundColor: itemBg }]}>
                        {renderBreakdownIcon(item.title, item.category)}
                      </View>
                      <View style={styles.taskBreakdownDetails}>
                        <View style={styles.taskBreakdownHeader}>
                          <Text style={[styles.taskBreakdownName, { color: theme.textPrimary }]}>{item.title}</Text>
                          <Text style={[styles.taskBreakdownPct, { color: itemColor }]}>{pct}%</Text>
                        </View>
                        <View style={[styles.taskProgressBarBg, { backgroundColor: theme.border }]}>
                          <View style={[styles.taskProgressBarFill, { width: `${pct}%`, backgroundColor: itemColor }]} />
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        ) : (
          /* Specific Routine View Content */
          <View>
            {renderYearlyStatus()}

            <View style={styles.gridCards}>
              <View style={[styles.smallCard, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)', alignSelf: 'flex-start' }]}>
                  <Feather name="check-circle" size={18} color={theme.blue} />
                </View>
                <Text style={[styles.smallCardValue, { color: theme.textPrimary }]}>
                  {statsMetrics.monthSuccessDays} <Text style={styles.smallCardUnit}>Day</Text>
                </Text>
                <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>
                  success in {currentDate.toLocaleString('default', { month: 'long' })}
                </Text>
              </View>

              <View style={[styles.smallCard, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)', alignSelf: 'flex-start' }]}>
                  <Feather name="check-square" size={18} color={theme.teal} />
                </View>
                <Text style={[styles.smallCardValue, { color: theme.textPrimary }]}>
                  {statsMetrics.totalSuccessDays} <Text style={styles.smallCardUnit}>Day</Text>
                </Text>
                <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Total Success</Text>
              </View>

              <View style={[styles.smallCard, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.1)', alignSelf: 'flex-start' }]}>
                  <Feather name="layers" size={18} color={theme.purple} />
                </View>
                <Text style={[styles.smallCardValue, { color: theme.textPrimary }]}>
                  {statsMetrics.currentStreak} <Text style={styles.smallCardUnit}>Day</Text>
                </Text>
                <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Current Streak</Text>
              </View>

              <View style={[styles.smallCard, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.1)', alignSelf: 'flex-start' }]}>
                  <Feather name="award" size={18} color={theme.orange} />
                </View>
                <Text style={[styles.smallCardValue, { color: theme.textPrimary }]}>
                  {statsMetrics.bestStreak} <Text style={styles.smallCardUnit}>Day</Text>
                </Text>
                <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Best Streak</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
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
    paddingVertical: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  routineTabs: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tabsScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabIconWrapper: {
    paddingHorizontal: 16,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarMonth: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
    width: 30,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDate: {
    fontSize: 15,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
    position: 'absolute',
    bottom: -2,
  },
  circularProgressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  progressCircleBg: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStrokeMock: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 12,
    borderColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  progressCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercentage: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
  },
  overallStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overallStatItem: {
    alignItems: 'center',
  },
  statIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    marginLeft: 2,
  },
  statDesc: {
    fontSize: 12,
  },
  yearlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  yearlyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  yearDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  yearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  matrixContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  matrixRow: {
    flexDirection: 'row',
    gap: 4,
  },
  matrixBlock: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  gridCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  smallCard: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  smallCardValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 12,
  },
  smallCardUnit: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  smallCardLabel: {
    fontSize: 12,
  },
  taskBreakdownContainer: {
    marginTop: 40,
    borderTopWidth: 1,
    paddingTop: 24,
  },
  taskBreakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  taskBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  taskIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskBreakdownDetails: {
    flex: 1,
  },
  taskBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskBreakdownName: {
    fontSize: 15,
    fontWeight: '600',
  },
  taskBreakdownPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskProgressBarBg: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  taskProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});

