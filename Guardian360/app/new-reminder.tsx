import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function NewReminderScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [dateEnabled, setDateEnabled] = useState(false);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [urgentEnabled, setUrgentEnabled] = useState(false);

  // iOS-style colors
  const theme = {
    background: isDark ? '#1C1C1E' : '#F2F2F7',
    cardBg: isDark ? '#2C2C2E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    separator: isDark ? '#38383A' : '#C6C6C8',
    blue: '#0A84FF',
    orange: '#FF9500',
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="x" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>New Reminder</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="check" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Card 1: Text Inputs */}
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <TextInput 
              style={[styles.input, { color: theme.textPrimary }]} 
              placeholder="Title" 
              placeholderTextColor={theme.textSecondary}
            />
            <View style={[styles.separator, { backgroundColor: theme.separator }]} />
            <TextInput 
              style={[styles.input, { color: theme.textPrimary }]} 
              placeholder="Notes" 
              placeholderTextColor={theme.textSecondary}
              multiline
            />
            <View style={[styles.separator, { backgroundColor: theme.separator }]} />
            <TextInput 
              style={[styles.input, { color: theme.textPrimary }]} 
              placeholder="URL" 
              placeholderTextColor={theme.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          {/* Date & Time Section */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Date & Time</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            {/* Date Row */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: isDark ? '#48484A' : '#E5E5EA' }]}>
                  <Feather name="calendar" size={16} color={theme.textPrimary} />
                </View>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Date</Text>
              </View>
              <Switch 
                value={dateEnabled} 
                onValueChange={setDateEnabled} 
                trackColor={{ false: theme.separator, true: '#34C759' }}
              />
            </View>
            <View style={[styles.separator, { backgroundColor: theme.separator, marginLeft: 50 }]} />
            
            {/* Time Row */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: isDark ? '#48484A' : '#E5E5EA' }]}>
                  <Feather name="clock" size={16} color={theme.textPrimary} />
                </View>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Time</Text>
              </View>
              <Switch 
                value={timeEnabled} 
                onValueChange={setTimeEnabled} 
                trackColor={{ false: theme.separator, true: '#34C759' }}
              />
            </View>
            <View style={[styles.separator, { backgroundColor: theme.separator, marginLeft: 50 }]} />
            
            {/* Urgent Row */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: isDark ? '#48484A' : '#E5E5EA' }]}>
                  <Feather name="bell" size={16} color={theme.textPrimary} />
                </View>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Urgent</Text>
              </View>
              <Switch 
                value={urgentEnabled} 
                onValueChange={setUrgentEnabled} 
                trackColor={{ false: theme.separator, true: '#34C759' }}
              />
            </View>
          </View>
          <Text style={styles.footerText}>Mark this reminder as urgent to set an alarm.</Text>

          {/* More Options Section */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>More Options</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            {/* List Row */}
            <TouchableOpacity style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: theme.orange }]}>
                  <Feather name="list" size={16} color="#FFF" />
                </View>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>List</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowRightText, { color: theme.textSecondary }]}>Reminders</Text>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
            <View style={[styles.separator, { backgroundColor: theme.separator, marginLeft: 50 }]} />
            
            {/* Details Row */}
            <TouchableOpacity style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: isDark ? '#48484A' : '#E5E5EA' }]}>
                  <Feather name="info" size={16} color={theme.textPrimary} />
                </View>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Details</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142, 142, 147, 0.2)', // Semi-transparent overlay
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 50,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowText: {
    fontSize: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowRightText: {
    fontSize: 16,
    marginRight: 4,
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 16,
    marginTop: -4,
    marginBottom: 16,
  }
});
