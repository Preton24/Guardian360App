import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RemindersListScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    background: isDark ? '#000000' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    blue: '#0A84FF',
    cyan: '#32ADE6',
    red: '#FF3B30',
    separator: isDark ? '#38383A' : '#C6C6C8',
    headerBtnBg: isDark ? '#1C1C1E' : '#E5E5EA',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.headerButton, { backgroundColor: theme.headerBtnBg }]}>
          <Feather name="chevron-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.headerButton, { backgroundColor: theme.headerBtnBg }]}>
          <Feather name="more-horizontal" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: theme.blue }]}>Today</Text>
        
        {/* Morning Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Morning</Text>
          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        </View>

        {/* Afternoon Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Afternoon</Text>
          
          <TouchableOpacity style={styles.taskItem}>
            <View style={styles.circle} />
            <View style={styles.taskDetails}>
              <Text style={[styles.taskTitle, { color: theme.textPrimary }]}>Lunch today</Text>
              <Text style={[styles.taskSubtext, { color: theme.textSecondary }]}>
                Reminders  <Text style={{ color: theme.red }}>3:00 PM</Text>
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.emptyTaskItem}>
            <View style={[styles.dashedCircle, { borderColor: theme.separator }]} />
          </TouchableOpacity>
          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        </View>

        {/* Tonight Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Tonight</Text>
          
          <TouchableOpacity style={styles.taskItem}>
            <View style={styles.circle} />
            <View style={styles.taskDetails}>
              <Text style={[styles.taskTitle, { color: theme.textPrimary }]}>Gym</Text>
              <Text style={[styles.taskSubtext, { color: theme.textSecondary }]}>
                Reminders  <Text style={{ color: theme.textSecondary }}>6:00 PM</Text>
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.emptyTaskItem}>
            <View style={[styles.dashedCircle, { borderColor: theme.separator }]} />
          </TouchableOpacity>
          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        </View>
        
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
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 20,
    marginTop: 10,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#555555',
    marginRight: 12,
  },
  taskDetails: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: '400',
    marginBottom: 2,
  },
  taskSubtext: {
    fontSize: 13,
  },
  emptyTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dashedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginRight: 12,
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
  }
});
