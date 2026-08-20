import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Decorative Background Elements */}
      <View style={[styles.circleOne, { backgroundColor: isDark ? '#38BDF8' : '#0EA5E9', opacity: 0.15 }]} />
      <View style={[styles.circleTwo, { backgroundColor: isDark ? '#818CF8' : '#6366F1', opacity: 0.15 }]} />

      <View style={styles.content}>
        <Animated.View entering={FadeInUp.delay(200).duration(1000)} style={styles.headerContainer}>
          <View style={[styles.iconContainer, { borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(14, 165, 233, 0.3)' }]}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>
          <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            Guardian360
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Your ultimate safety and tracking companion. Protect what matters most.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(1000)} style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'space-between',
    paddingTop: height * 0.2,
    paddingBottom: height * 0.1,
    zIndex: 10,
  },
  headerContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  footerContainer: {
    width: '100%',
  },
  button: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  circleOne: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    top: -width * 0.5,
    left: -width * 0.2,
  },
  circleTwo: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    bottom: -width * 0.4,
    right: -width * 0.3,
  },
});
