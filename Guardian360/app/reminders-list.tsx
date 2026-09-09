import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useApp } from '@/context/AppContext';
import { api, ReminderItem } from '@/services/api';

const REPEAT_OPTIONS = [
  { value: 'Never', label: 'Never', sublabel: 'One-time reminder' },
  { value: 'Daily', label: 'Daily', sublabel: 'Every day' },
  { value: 'Weekdays', label: 'Weekdays', sublabel: 'Monday through Friday' },
  { value: 'Weekends', label: 'Weekends', sublabel: 'Saturday and Sunday' },
  { value: 'Weekly', label: 'Weekly', sublabel: 'Once every week' },
  { value: 'Bi-weekly', label: 'Bi-weekly', sublabel: 'Every 2 weeks' },
  { value: 'Monthly', label: 'Monthly', sublabel: 'Once every month' },
];

export default function RemindersListScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { selectedUser } = useApp();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'REPEATING' | 'ONCE'>('ALL');

  // Repeat modal state for in-place repetition editing
  const [activeReminderForRepeat, setActiveReminderForRepeat] = useState<ReminderItem | null>(null);
  const [updatingRepeat, setUpdatingRepeat] = useState(false);

  const theme = {
    background: isDark ? '#000000' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    blue: '#0A84FF',
    cyan: '#32ADE6',
    red: '#FF3B30',
    green: '#34C759',
    separator: isDark ? '#2C2C2E' : '#E5E5EA',
    headerBtnBg: isDark ? '#1C1C1E' : '#E5E5EA',
    cardBg: isDark ? '#1C1C1E' : '#F2F2F7',
    modalBg: isDark ? '#2C2C2E' : '#FFFFFF',
    chipActiveBg: isDark ? '#0A84FF' : '#007AFF',
    chipInactiveBg: isDark ? '#1C1C1E' : '#E5E5EA',
  };

  const fetchReminders = useCallback(async () => {
    if (!selectedUser) {
      setReminders([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.getUserReminders(selectedUser.id);
      setReminders(data);
    } catch (err) {
      console.error('Error fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const toggleComplete = async (reminder: ReminderItem) => {
    const nextState = !reminder.completed;
    setReminders((prev) =>
      prev.map((r) => (r.id === reminder.id ? { ...r, completed: nextState } : r))
    );
    try {
      await api.patchReminder(reminder.id, { completed: nextState });
    } catch (err) {
      Alert.alert('Error', 'Failed to update reminder status');
      fetchReminders();
    }
  };

  const handleDelete = async (reminderId: string) => {
    Alert.alert('Delete Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setReminders((prev) => prev.filter((r) => r.id !== reminderId));
          try {
            await api.deleteReminder(reminderId);
          } catch (err) {
            Alert.alert('Error', 'Failed to delete reminder');
            fetchReminders();
          }
        },
      },
    ]);
  };

  const handleUpdateRepeat = async (newRepeat: string) => {
    if (!activeReminderForRepeat) return;
    const targetId = activeReminderForRepeat.id;

    // Optimistic UI update
    setReminders((prev) =>
      prev.map((r) => (r.id === targetId ? { ...r, repeat: newRepeat } : r))
    );
    setActiveReminderForRepeat(null);

    try {
      setUpdatingRepeat(true);
      await api.patchReminder(targetId, { repeat: newRepeat });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update reminder repetition: ' + (err.message || ''));
      fetchReminders();
    } finally {
      setUpdatingRepeat(false);
    }
  };

  const formatReminderTime = (timeStr?: string | null) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return timeStr;
  };

  const filteredReminders = reminders.filter((item) => {
    const isRepeating = Boolean(item.repeat && item.repeat !== 'Never');
    if (filter === 'REPEATING') return isRepeating;
    if (filter === 'ONCE') return !isRepeating;
    return true;
  });

  const repeatingCount = reminders.filter((r) => r.repeat && r.repeat !== 'Never').length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerButton, { backgroundColor: theme.headerBtnBg }]}
        >
          <Feather name="chevron-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={fetchReminders}
          style={[styles.headerButton, { backgroundColor: theme.headerBtnBg }]}
        >
          <Feather name="refresh-cw" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: theme.blue }]}>
          {selectedUser ? `${selectedUser.name}'s Reminders` : 'Reminders'}
        </Text>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: filter === 'ALL' ? theme.chipActiveBg : theme.chipInactiveBg },
            ]}
            onPress={() => setFilter('ALL')}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filter === 'ALL' ? '#FFFFFF' : theme.textPrimary },
              ]}
            >
              All ({reminders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: filter === 'REPEATING' ? theme.chipActiveBg : theme.chipInactiveBg },
            ]}
            onPress={() => setFilter('REPEATING')}
          >
            <Feather
              name="repeat"
              size={13}
              color={filter === 'REPEATING' ? '#FFFFFF' : theme.blue}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: filter === 'REPEATING' ? '#FFFFFF' : theme.textPrimary },
              ]}
            >
              Repeating ({repeatingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: filter === 'ONCE' ? theme.chipActiveBg : theme.chipInactiveBg },
            ]}
            onPress={() => setFilter('ONCE')}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filter === 'ONCE' ? '#FFFFFF' : theme.textPrimary },
              ]}
            >
              One-Time ({reminders.length - repeatingCount})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.blue} />
          </View>
        ) : filteredReminders.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg }]}>
            <Ionicons name="checkbox-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {filter === 'REPEATING'
                ? 'No Repeating Reminders'
                : filter === 'ONCE'
                ? 'No One-Time Reminders'
                : 'No Reminders Yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {filter === 'REPEATING'
                ? 'Set the "Repeat" option on your reminders to make them recur automatically.'
                : `Tap the '+' button below to add a reminder for ${selectedUser?.name || 'this user'}.`}
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {filter === 'REPEATING' ? 'Repeating Reminders' : 'Active Tasks'}
            </Text>
            {filteredReminders.map((item) => {
              const hasRepeat = Boolean(item.repeat && item.repeat !== 'Never');
              return (
                <View key={item.id} style={[styles.taskRow, { borderBottomColor: theme.separator }]}>
                  {/* Complete Checkbox */}
                  <TouchableOpacity
                    style={styles.circleContainer}
                    onPress={() => toggleComplete(item)}
                  >
                    <Ionicons
                      name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                      size={26}
                      color={item.completed ? theme.green : theme.textSecondary}
                    />
                  </TouchableOpacity>

                  {/* Task Details */}
                  <View style={styles.taskDetails}>
                    <Text
                      style={[
                        styles.taskTitle,
                        { color: theme.textPrimary },
                        item.completed && { textDecorationLine: 'line-through', color: theme.textSecondary },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.notes ? (
                      <Text style={[styles.taskSubtext, { color: theme.textSecondary }]}>{item.notes}</Text>
                    ) : null}

                    {/* Metadata Badges (Repeat, Time, Urgent, Category) */}
                    <View style={styles.tagsContainer}>
                      {/* Repeat badge - clickable to edit recurrence */}
                      <TouchableOpacity
                        style={[
                          styles.badge,
                          {
                            backgroundColor: hasRepeat
                              ? isDark
                                ? 'rgba(10, 132, 255, 0.22)'
                                : 'rgba(10, 132, 255, 0.12)'
                              : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                            borderColor: hasRepeat ? theme.blue : 'transparent',
                            borderWidth: hasRepeat ? 0.5 : 0,
                          },
                        ]}
                        onPress={() => setActiveReminderForRepeat(item)}
                        activeOpacity={0.7}
                      >
                        <Feather
                          name="repeat"
                          size={11}
                          color={hasRepeat ? theme.blue : theme.textSecondary}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.badgeText,
                            { color: hasRepeat ? theme.blue : theme.textSecondary, fontWeight: hasRepeat ? '600' : '400' },
                          ]}
                        >
                          {hasRepeat ? item.repeat : 'Repeat'}
                        </Text>
                      </TouchableOpacity>

                      {/* Time badge */}
                      {item.time ? (
                        <View style={[styles.badge, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                          <Feather name="clock" size={11} color={theme.textSecondary} style={{ marginRight: 4 }} />
                          <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                            {formatReminderTime(item.time)}
                          </Text>
                        </View>
                      ) : null}

                      {/* Urgent badge */}
                      {item.urgent ? (
                        <View style={styles.urgentBadge}>
                          <Text style={styles.urgentBadgeText}>URGENT</Text>
                        </View>
                      ) : null}

                      {/* Category badge */}
                      {item.category ? (
                        <View style={[styles.badge, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                          <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                            {item.category === 'MEDS' ? '💊 Meds' : item.category === 'HABIT' ? '🏃 Habit' : '📋 Task'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Delete Button */}
                  <TouchableOpacity style={{ padding: 8 }} onPress={() => handleDelete(item.id)}>
                    <Feather name="trash-2" size={18} color={theme.red} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.cyan }]}
        onPress={() => router.push('/new-reminder')}
      >
        <Feather name="plus" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Repeat Frequency Modal for existing reminder */}
      <Modal
        visible={Boolean(activeReminderForRepeat)}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveReminderForRepeat(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.modalBg }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Set Repetition</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  {activeReminderForRepeat?.title}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveReminderForRepeat(null)}
                style={styles.modalCloseIcon}
              >
                <Feather name="x" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {REPEAT_OPTIONS.map((opt) => {
              const isSelected =
                (activeReminderForRepeat?.repeat || 'Never') === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.categoryOption,
                    isSelected && { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' },
                  ]}
                  onPress={() => handleUpdateRepeat(opt.value)}
                  disabled={updatingRepeat}
                >
                  <View>
                    <Text style={[styles.categoryOptionText, { color: theme.textPrimary }]}>
                      {opt.label}
                    </Text>
                    {opt.sublabel ? (
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                        {opt.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected && <Feather name="check" size={20} color={theme.blue} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setActiveReminderForRepeat(null)}
            >
              <Text style={{ color: theme.blue, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 14,
    marginTop: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  circleContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  taskDetails: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  taskSubtext: {
    fontSize: 13,
    marginTop: 3,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
  },
  urgentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentBadgeText: {
    color: '#FF3B30',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
    maxWidth: 260,
  },
  modalCloseIcon: {
    padding: 4,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalCloseBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
