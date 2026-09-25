// hooks/useTheme.ts
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { lightTheme, darkTheme, ThemeColors } from '@/constants/colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  setMode: (mode) => set({ mode }),
  toggleTheme: () => {
    const current = get().mode;
    set({ mode: current === 'dark' ? 'light' : 'dark' });
  },
}));

export function useTheme() {
  const systemScheme = useColorScheme();
  const { mode, setMode, toggleTheme } = useThemeStore();

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const theme: ThemeColors = isDark ? darkTheme : lightTheme;

  return {
    theme,
    colors: theme,
    isDark,
    mode,
    setMode,
    toggleTheme,
  };
}
