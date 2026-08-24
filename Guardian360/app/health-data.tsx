import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HealthDataScreen() {
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

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>All Health Data</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.timestamp, { color: theme.textSecondary }]}>Last updated: {currentTime}</Text>
        
        {/* Heart Rate Card */}
        <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.cardInfo}>
            <View style={styles.iconContainer}>
              <Feather name="heart" size={24} color="#EF4444" />
            </View>
            <View>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Heart Rate</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>-- BPM</Text>
            </View>
          </View>
          <View style={styles.mockGraph}>
             <View style={[styles.graphBar, { height: '30%', backgroundColor: '#EF4444' }]} />
             <View style={[styles.graphBar, { height: '50%', backgroundColor: '#EF4444' }]} />
             <View style={[styles.graphBar, { height: '40%', backgroundColor: '#EF4444' }]} />
             <View style={[styles.graphBar, { height: '70%', backgroundColor: '#EF4444' }]} />
             <View style={[styles.graphBar, { height: '60%', backgroundColor: '#EF4444' }]} />
             <View style={[styles.graphBar, { height: '80%', backgroundColor: '#EF4444' }]} />
          </View>
        </View>

        {/* BP Stats Card */}
        <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.cardInfo}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="heart-pulse" size={28} color="#8B5CF6" />
            </View>
            <View>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Blood Pressure</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>--/-- mmHg</Text>
            </View>
          </View>
          <View style={styles.mockGraph}>
             <View style={[styles.graphBar, { height: '80%', backgroundColor: '#8B5CF6' }]} />
             <View style={[styles.graphBar, { height: '85%', backgroundColor: '#8B5CF6' }]} />
             <View style={[styles.graphBar, { height: '90%', backgroundColor: '#8B5CF6' }]} />
             <View style={[styles.graphBar, { height: '85%', backgroundColor: '#8B5CF6' }]} />
             <View style={[styles.graphBar, { height: '80%', backgroundColor: '#8B5CF6' }]} />
             <View style={[styles.graphBar, { height: '85%', backgroundColor: '#8B5CF6' }]} />
          </View>
        </View>

        {/* Cognitive Trend Card */}
        <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.cardInfo}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="brain" size={24} color="#3B82F6" />
            </View>
            <View>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Cognitive Trend</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>-- score</Text>
            </View>
          </View>
          <View style={styles.mockGraph}>
             <View style={[styles.graphBar, { height: '20%', backgroundColor: '#3B82F6' }]} />
             <View style={[styles.graphBar, { height: '40%', backgroundColor: '#3B82F6' }]} />
             <View style={[styles.graphBar, { height: '30%', backgroundColor: '#3B82F6' }]} />
             <View style={[styles.graphBar, { height: '60%', backgroundColor: '#3B82F6' }]} />
             <View style={[styles.graphBar, { height: '50%', backgroundColor: '#3B82F6' }]} />
             <View style={[styles.graphBar, { height: '90%', backgroundColor: '#3B82F6' }]} />
          </View>
        </View>
        
        {/* Fall Risk Card */}
        <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.cardInfo}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="alert-rhombus-outline" size={26} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Fall Risk</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>Low / --</Text>
            </View>
          </View>
          <View style={styles.mockGraph}>
             <View style={[styles.graphBar, { height: '80%', backgroundColor: '#F59E0B' }]} />
             <View style={[styles.graphBar, { height: '70%', backgroundColor: '#F59E0B' }]} />
             <View style={[styles.graphBar, { height: '60%', backgroundColor: '#F59E0B' }]} />
             <View style={[styles.graphBar, { height: '40%', backgroundColor: '#F59E0B' }]} />
             <View style={[styles.graphBar, { height: '20%', backgroundColor: '#F59E0B' }]} />
             <View style={[styles.graphBar, { height: '10%', backgroundColor: '#F59E0B' }]} />
          </View>
        </View>
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
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
  },
  timestamp: {
    fontSize: 14,
    marginBottom: 20,
    fontWeight: '500',
  },
  dataCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  mockGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
    width: 80,
  },
  graphBar: {
    width: 8,
    borderRadius: 4,
    opacity: 0.8,
  },
});
