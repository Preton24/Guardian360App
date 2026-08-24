import { useTheme } from '@/context/ThemeContext';

export function useColorScheme() {
  const themeContext = useTheme();
  // We use optional chaining in case useTheme is called outside the provider during mount
  return themeContext?.activeTheme || 'light';
}
