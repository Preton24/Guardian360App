import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function LocationScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    accent: isDark ? '#38BDF8' : '#0EA5E9',
    border: isDark ? '#334155' : '#E2E8F0',
  };

  return (
    <View style={styles.container}>
      {/* Mock Map Background */}
      <Image
        source={{
          uri: isDark
            ? 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop'
            : 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop'
        }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        opacity={0.7}
      />  

      <SafeAreaView style={styles.safeArea}>
        {/* Floating Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: theme.cardBg }]}>
            <Feather name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Center Marker Mock */}
        <View style={styles.markerContainer}>
          <View style={[styles.markerPulse, { backgroundColor: theme.accent }]} />
          <View style={[styles.markerPin, { backgroundColor: theme.accent }]}>
            <Ionicons name="person" size={20} color="#FFF" />
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Bottom Info Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[styles.bottomCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.userInfo}>
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <Text style={styles.avatarText}>SR</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={[styles.userName, { color: theme.textPrimary }]}>Steve Roger</Text>
              <Text style={[styles.userStatus, { color: theme.textSecondary }]}>Near Home • Updated Just Now</Text>
            </View>
            <View style={styles.batteryBadge}>
              <Ionicons name="battery-full" size={16} color="#10B981" />
              <Text style={styles.batteryText}>85%</Text>
            </View>
          </View>

          <View style={[styles.addressContainer, { borderTopColor: theme.border }]}>
            <Feather name="map-pin" size={20} color={theme.textSecondary} />
            <Text style={[styles.addressText, { color: theme.textPrimary }]}>
              123 Maple Street, Springfield
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.accent }]}>
              <Feather name="navigation" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
              <Feather name="bell" size={20} color={theme.textPrimary} />
              <Text style={[styles.actionBtnTextSecondary, { color: theme.textPrimary }]}>Notify</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.addFamilyBtn, { borderColor: theme.border }]}>
            <Feather name="user-plus" size={20} color={theme.accent} />
            <Text style={[styles.addFamilyText, { color: theme.accent }]}>Add Family Member</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 10,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  markerContainer: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: -24, // half of width
    marginTop: -24,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  markerPulse: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    opacity: 0.3,
  },
  markerPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomCard: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  batteryText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 20,
    marginBottom: 24,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionBtnTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addFamilyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addFamilyText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
