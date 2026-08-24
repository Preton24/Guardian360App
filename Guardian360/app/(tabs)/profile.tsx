import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/context/ThemeContext';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { theme: currentThemeMode, setTheme } = useTheme();

  const theme = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    accent: isDark ? '#38BDF8' : '#0EA5E9',
    border: isDark ? '#334155' : '#E2E8F0',
    danger: '#EF4444',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info Card */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <Feather name="edit-2" size={20} color={theme.accent} />
          </TouchableOpacity>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <Text style={styles.avatarText}>SR</Text>
            </View>
            <View style={styles.profileDetails}>
              <Text style={[styles.name, { color: theme.textPrimary }]}>Steve Rogers</Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>Male, 82 years old</Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>steve.rogers@example.com</Text>
            </View>
          </View>
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
          <View style={styles.emergencyRow}>
            <View>
              <Text style={[styles.emergencyLabel, { color: theme.textSecondary }]}>Emergency Contact</Text>
              <Text style={[styles.emergencyName, { color: theme.textPrimary }]}>John Doe (Son)</Text>
            </View>
            <TouchableOpacity style={styles.callBtn}>
              <Feather name="phone-call" size={20} color={theme.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Family & Caretakers */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Family & Caretakers</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 0 }]}>
          {/* Member 1 */}
          <View style={styles.memberRow}>
            <View style={[styles.memberAvatar, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Text style={[styles.memberInitials, { color: '#10B981' }]}>JD</Text>
            </View>
            <View style={styles.memberDetails}>
              <Text style={[styles.memberName, { color: theme.textPrimary }]}>John Doe</Text>
              <Text style={[styles.memberRelation, { color: theme.textSecondary }]}>Son • Primary Caretaker</Text>
              <Text style={[styles.memberContact, { color: theme.textSecondary }]}>+1 (555) 123-4567</Text>
            </View>
            <TouchableOpacity style={styles.memberAction}>
              <Feather name="more-vertical" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 64 }]} />
          
          {/* Member 2 */}
          <View style={styles.memberRow}>
            <View style={[styles.memberAvatar, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Text style={[styles.memberInitials, { color: '#F59E0B' }]}>SD</Text>
            </View>
            <View style={styles.memberDetails}>
              <Text style={[styles.memberName, { color: theme.textPrimary }]}>Sarah Doe</Text>
              <Text style={[styles.memberRelation, { color: theme.textSecondary }]}>Daughter</Text>
              <Text style={[styles.memberContact, { color: theme.textSecondary }]}>+1 (555) 987-6543</Text>
            </View>
            <TouchableOpacity style={styles.memberAction}>
              <Feather name="more-vertical" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
          
          {/* Add Button */}
          <TouchableOpacity style={styles.addMemberBtn}>
            <Feather name="user-plus" size={20} color={theme.accent} />
            <Text style={[styles.addMemberText, { color: theme.accent }]}>Add Family Member</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Card */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Settings</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 0 }]}>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#8B5CF6' }]}>
                <Feather name="moon" size={18} color="#FFF" />
              </View>
              <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Dark Mode</Text>
            </View>
            <Switch 
              value={isDark} 
              onValueChange={(val) => setTheme(val ? 'dark' : 'light')} 
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 52 }]} />
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#10B981' }]}>
                <Feather name="bell" size={18} color="#FFF" />
              </View>
              <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Notifications</Text>
            </View>
            <Switch 
              value={true} 
              onValueChange={() => {}} 
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>
        </View>
        
        {/* Account Actions */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 0 }]}>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: theme.danger }]}>
                <Feather name="log-out" size={18} color="#FFF" />
              </View>
              <Text style={[styles.settingLabel, { color: theme.danger }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  profileDetails: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    marginBottom: 2,
  },
  separator: {
    height: 1,
    width: '100%',
  },
  emergencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  emergencyLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  emergencyName: {
    fontSize: 16,
    fontWeight: '600',
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberRelation: {
    fontSize: 13,
    marginBottom: 2,
  },
  memberContact: {
    fontSize: 13,
  },
  memberAction: {
    padding: 8,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  addMemberText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
