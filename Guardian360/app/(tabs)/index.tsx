import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    accent: isDark ? '#38BDF8' : '#0EA5E9',
    successBg: isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7',
    successText: isDark ? '#4ADE80' : '#166534',
    border: isDark ? '#334155' : '#E2E8F0',
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Section */}
        <Animated.View entering={FadeInUp.delay(100).duration(800)} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.greeting, { color: theme.textSecondary }]}>Good Morning</Text>
              <Text style={[styles.name, { color: theme.textPrimary }]}>Steve Roger</Text>
            </View>
            <TouchableOpacity 
              style={[styles.mapIconBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => router.push('/location')}
            >
              <Feather name="map" size={22} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Health Overview (2x2 Grid) */}
        <Animated.View entering={FadeInUp.delay(300).duration(800)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Health Overview</Text>
          <View style={styles.gridContainer}>
            {/* Heart Rate Card */}
            <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Feather name="heart" size={24} color="#EF4444" />
                <View style={styles.liveIndicator} />
              </View>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>-- <Text style={styles.cardUnit}>BPM</Text></Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Heart Rate</Text>
            </View>

            {/* BP Stats Card */}
            <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="heart-pulse" size={28} color="#8B5CF6" />
              </View>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>--/-- <Text style={styles.cardUnit}>mmHg</Text></Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>BP Stats</Text>
            </View>

            {/* Fall Risk Card */}
            <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="alert-rhombus-outline" size={26} color="#F59E0B" />
              </View>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>Low <Text style={styles.cardUnit}>/ --</Text></Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Fall Risk</Text>
            </View>

            {/* Reminders Card */}
            <TouchableOpacity 
              style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => router.push('/reminders-list')}
            >
              <View style={styles.cardHeader}>
                <Feather name="check-square" size={24} color="#10B981" />
              </View>
              <View style={{ marginVertical: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Feather name="check-circle" size={14} color="#10B981" />
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 6, textDecorationLine: 'line-through' }} numberOfLines={1}>Meds (8 AM)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Feather name="circle" size={14} color={theme.textSecondary} />
                  <Text style={{ fontSize: 13, color: theme.textPrimary, marginLeft: 6 }} numberOfLines={1}>Drink water</Text>
                </View>
              </View>
              <Text style={[styles.cardLabel, { color: theme.textSecondary, marginTop: 'auto' }]}>Reminders</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Health Trends Section */}
        <Animated.View entering={FadeInUp.delay(500).duration(800)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Cognitive Trend</Text>
          
          <View style={[styles.largeTrendCard, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 0, overflow: 'hidden' }]}>
            <Image 
              source={{ uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6Cai6gSoxEG4G-p-xBq78DTmjMI6P0xYtJzSuLIl5Lw&s" }}
              style={{ width: '100%', height: 220 }}
              contentFit="cover"
            />
          </View>
          <TouchableOpacity 
            style={[styles.showAllButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={() => router.push('/health-data')}
          >
            <Text style={[styles.showAllText, { color: theme.accent }]}>Show all health data</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Caretaker Section */}
        <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.section}>
          <TouchableOpacity style={[styles.caretakerButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.caretakerInfo}>
              <View style={[styles.caretakerAvatar, { backgroundColor: theme.accent }]}>
                <Text style={styles.caretakerInitials}>JD</Text>
              </View>
              <View>
                <Text style={[styles.caretakerRole, { color: theme.textSecondary }]}>Primary Caretaker</Text>
                <Text style={[styles.caretakerName, { color: theme.textPrimary }]}>Jane Doe</Text>
              </View>
            </View>
            <View style={[styles.callButton, { backgroundColor: theme.successBg }]}>
              <Feather name="phone" size={20} color={theme.successText} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Wellness Section */}
        <Animated.View entering={FadeInUp.delay(800).duration(800)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Wellness & Relaxation</Text>
          
          {/* Quotes Card */}
          <View style={[styles.wellnessCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.wellnessIcon}>
              <Feather name="book-open" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.wellnessInfo}>
              <Text style={[styles.wellnessTitle, { color: theme.textPrimary }]}>Daily Inspiration</Text>
              <Text style={[styles.wellnessDesc, { color: theme.textSecondary }]}>"Every moment is a fresh beginning."</Text>
            </View>
          </View>

          {/* Music Card */}
          <View style={[styles.wellnessCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.wellnessIcon, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
              <Feather name="music" size={24} color="#0EA5E9" />
            </View>
            <View style={styles.wellnessInfo}>
              <Text style={[styles.wellnessTitle, { color: theme.textPrimary }]}>Calm Soothing Music</Text>
              <Text style={[styles.wellnessDesc, { color: theme.textSecondary }]}>Relaxing nature sounds</Text>
            </View>
            <TouchableOpacity style={styles.playButton}>
              <Ionicons name="play-circle" size={40} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>

        {/* Articles Section */}
        <Animated.View entering={FadeInUp.delay(700).duration(800)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Articles & Tips</Text>
          
          <View style={[styles.articleCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?q=80&w=600&auto=format&fit=crop' }} 
              style={styles.articleImage} 
              contentFit="cover"
            />
            <View style={styles.articleContent}>
              <Text style={[styles.articleTitle, { color: theme.textPrimary }]} numberOfLines={1}>Staying Active at Home</Text>
              <Text style={[styles.articleDesc, { color: theme.textSecondary }]} numberOfLines={1}>Simple exercises to keep you moving safely indoors.</Text>
            </View>
          </View>

          <View style={[styles.articleCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?q=80&w=600&auto=format&fit=crop' }} 
              style={styles.articleImage} 
              contentFit="cover"
            />
            <View style={styles.articleContent}>
              <Text style={[styles.articleTitle, { color: theme.textPrimary }]} numberOfLines={1}>Healthy Heart Habits</Text>
              <Text style={[styles.articleDesc, { color: theme.textSecondary }]} numberOfLines={1}>Diet and lifestyle tips for better cardiovascular health.</Text>
            </View>
          </View>
        </Animated.View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60, // Adjust for safe area / header
  },
  header: {
    marginBottom: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  name: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  mapIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  dataCard: {
    width: (width - 40 - 16) / 2, // 20 padding each side, 16 gap
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    height: 28,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardUnit: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  trendsScroll: {
    gap: 16,
    paddingRight: 20, // To allow scrolling completely to the right edge
  },
  trendCard: {
    width: 160,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 16, // Instead of gap on iOS older versions, marginRight is safer, but scroll uses gap now
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  mockGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 50,
  },
  graphBar: {
    width: 12,
    borderRadius: 6,
    opacity: 0.8,
  },
  articleCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  articleImage: {
    width: '100%',
    height: 160,
  },
  articleContent: {
    padding: 16,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  articleDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  showAllButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  showAllText: {
    fontSize: 16,
    fontWeight: '600',
  },
  caretakerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  caretakerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caretakerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  caretakerInitials: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  caretakerRole: {
    fontSize: 13,
    marginBottom: 4,
  },
  caretakerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wellnessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  wellnessIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  wellnessInfo: {
    flex: 1,
  },
  wellnessTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  wellnessDesc: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  playButton: {
    paddingLeft: 12,
  },
  largeTrendCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'stretch',
    marginBottom: 8,
  },
  largeTrendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  largeTrendTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  largeTrendSubtitle: {
    fontSize: 14,
  },
  lineChartMock: {
    height: 160,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  chartStatCol: {
    flex: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 18,
    fontWeight: '600',
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  xLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
});
