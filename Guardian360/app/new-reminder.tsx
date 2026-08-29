import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useApp } from '@/context/AppContext';
import { api } from '@/services/api';

type CategoryType = 'MEDS' | 'TASK' | 'HABIT';

export default function NewReminderScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { selectedUser } = useApp();

  // Inputs matching screenshot
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dateEnabled, setDateEnabled] = useState(false);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [urgentEnabled, setUrgentEnabled] = useState(false);
  const [category, setCategory] = useState<CategoryType>('MEDS');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('09:00 AM');

  const [submitting, setSubmitting] = useState(false);

  // Exact screenshot color palette
  const theme = {
    background: isDark ? '#1C1C1E' : '#F2F2F7',
    cardBg: isDark ? '#2C2C2E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    placeholder: isDark ? '#636366' : '#8E8E93',
    separator: isDark ? '#3A3A3C' : '#E5E5EA',
    headerCircle: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    orangeBadge: '#FF9500',
    blue: '#0A84FF',
    green: '#34C759',
  };

  const categoryLabels: Record<CategoryType, string> = {
    MEDS: 'Medication',
    TASK: 'Task',
    HABIT: 'Habit',
  };

  const handleSave = async () => {
    if (!selectedUser) {
      Alert.alert('No User Selected', 'Please select a profile first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for the reminder.');
      return;
    }

    try {
      setSubmitting(true);

      await api.createReminder(selectedUser.id, {
        title: title.trim(),
        notes: notes.trim() || undefined,
        date: dateEnabled ? selectedDate : undefined,
        time: timeEnabled ? selectedTime : undefined,
        urgent: urgentEnabled,
        category: category,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create reminder');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header matching screenshot */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.circularHeaderBtn, { backgroundColor: theme.headerCircle }]}>
            <Feather name="x" size={20} color={theme.textPrimary} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>New Reminder</Text>

          <TouchableOpacity
            onPress={handleSave}
            style={[styles.circularHeaderBtn, { backgroundColor: theme.headerCircle }]}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={theme.blue} />
            ) : (
              <Feather name="check" size={20} color={theme.textPrimary} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Card 1: Title & Notes */}
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Title"
              placeholderTextColor={theme.placeholder}
              value={title}
              onChangeText={setTitle}
            />
            <View style={[styles.separator, { backgroundColor: theme.separator }]} />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Notes"
              placeholderTextColor={theme.placeholder}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Section: Date & Time */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Date & Time</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            {/* Date Row */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="calendar" size={18} color={theme.textSecondary} style={styles.rowIcon} />
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Date</Text>
              </View>
              <Switch
                value={dateEnabled}
                onValueChange={setDateEnabled}
                trackColor={{ false: theme.separator, true: theme.green }}
              />
            </View>

            {dateEnabled && (
              <View style={styles.inlineDetailRow}>
                <TextInput
                  style={[styles.inlineInput, { color: theme.blue }]}
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.placeholder}
                />
              </View>
            )}

            <View style={[styles.separator, { backgroundColor: theme.separator, marginLeft: 44 }]} />

            {/* Time Row */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="clock" size={18} color={theme.textSecondary} style={styles.rowIcon} />
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Time</Text>
              </View>
              <Switch
                value={timeEnabled}
                onValueChange={setTimeEnabled}
                trackColor={{ false: theme.separator, true: theme.green }}
              />
            </View>

            {timeEnabled && (
              <View style={styles.inlineDetailRow}>
                <TextInput
                  style={[styles.inlineInput, { color: theme.blue }]}
                  value={selectedTime}
                  onChangeText={setSelectedTime}
                  placeholder="09:00 AM"
                  placeholderTextColor={theme.placeholder}
                />
              </View>
            )}

            <View style={[styles.separator, { backgroundColor: theme.separator, marginLeft: 44 }]} />

            {/* Urgent Row */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="bell" size={18} color={theme.textSecondary} style={styles.rowIcon} />
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Urgent</Text>
              </View>
              <Switch
                value={urgentEnabled}
                onValueChange={setUrgentEnabled}
                trackColor={{ false: theme.separator, true: theme.green }}
              />
            </View>
          </View>
          <Text style={styles.footerText}>Mark this reminder as urgent to set an alarm.</Text>

          {/* Section: More Options */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>More Options</Text>

          {/* Category Card */}
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <TouchableOpacity style={styles.row} onPress={() => setIsCategoryModalOpen(true)}>
              <View style={styles.rowLeft}>
                <View style={[styles.orangeBadge, { backgroundColor: theme.orangeBadge }]}>
                  <Ionicons name="pricetag" size={16} color="#FFF" />
                </View>
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Category</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
                  {categoryLabels[category]}
                </Text>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Modal */}
      <Modal visible={isCategoryModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Category</Text>

            {(['MEDS', 'TASK', 'HABIT'] as CategoryType[]).map((catKey) => {
              const label = categoryLabels[catKey];
              const isSelected = category === catKey;
              return (
                <TouchableOpacity
                  key={catKey}
                  style={[styles.categoryOption, isSelected && { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' }]}
                  onPress={() => {
                    setCategory(catKey);
                    setIsCategoryModalOpen(false);
                  }}
                >
                  <Text style={[styles.categoryOptionText, { color: theme.textPrimary }]}>{label}</Text>
                  {isSelected && <Feather name="check" size={20} color={theme.blue} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsCategoryModalOpen(false)}>
              <Text style={{ color: theme.blue, fontSize: 16, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  circularHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 12,
    width: 20,
    textAlign: 'center',
  },
  orangeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  rowValue: {
    fontSize: 17,
  },
  inlineDetailRow: {
    paddingLeft: 48,
    paddingRight: 16,
    paddingBottom: 10,
    marginTop: -4,
  },
  inlineInput: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 16,
    marginTop: -8,
    marginBottom: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
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
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
