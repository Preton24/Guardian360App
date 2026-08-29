import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useApp } from '@/context/AppContext';
import { api, ReminderItem } from '@/services/api';

export default function RemindersListScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { selectedUser } = useApp();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const theme = {
    background: isDark ? '#000000' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    blue: '#0A84FF',
    cyan: '#32ADE6',
    red: '#FF3B30',
    separator: isDark ? '#38383A' : '#C6C6C8',
    headerBtnBg: isDark ? '#1C1C1E' : '#E5E5EA',
    cardBg: isDark ? '#1C1C1E' : '#F2F2F7',
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
    // Optimistic update
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

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.blue} />
          </View>
        ) : reminders.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg }]}>
            <Ionicons name="checkbox-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Reminders Yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Tap the '+' button below to add a reminder for {selectedUser?.name || 'this user'}.
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Active Tasks</Text>
            {reminders.map((item) => (
              <View key={item.id} style={styles.taskRow}>
                <TouchableOpacity
                  style={styles.circleContainer}
                  onPress={() => toggleComplete(item)}
                >
                  <Ionicons
                    name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={item.completed ? '#34C759' : theme.textSecondary}
                  />
                </TouchableOpacity>

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
                  {item.urgent ? (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>URGENT</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity style={{ padding: 8 }} onPress={() => handleDelete(item.id)}>
                  <Feather name="trash-2" size={18} color={theme.red} />
                </TouchableOpacity>
              </View>
            ))}
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
    marginBottom: 20,
    marginTop: 10,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  circleContainer: {
    marginRight: 12,
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
    marginTop: 2,
  },
  urgentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  urgentBadgeText: {
    color: '#FF3B30',
    fontSize: 10,
    fontWeight: '700',
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
});
