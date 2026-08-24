import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppThemeProvider, useTheme } from '@/context/ThemeContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { activeTheme } = useTheme();

  return (
    <ThemeProvider value={activeTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="health-data" options={{ headerShown: false }} />
        <Stack.Screen name="location" options={{ headerShown: false }} />
        <Stack.Screen name="reminders-list" options={{ headerShown: false }} />
        <Stack.Screen name="new-reminder" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={activeTheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutNav />
    </AppThemeProvider>
  );
}
