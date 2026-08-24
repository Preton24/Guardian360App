import React, { createContext, useContext, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextProps {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  activeTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: 'system',
  setTheme: () => {},
  activeTheme: 'light',
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [theme, setTheme] = useState<ThemeType>('system');
  
  const activeTheme = theme === 'system' ? (systemColorScheme || 'light') : theme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, activeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
