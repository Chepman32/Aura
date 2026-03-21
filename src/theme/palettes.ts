import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import type { StatusBarStyle } from 'react-native';

export type AppThemeId = 'dark' | 'light' | 'solar' | 'mono';

export interface AppThemeColors {
  black: string;
  white: string;
  background: string;
  surface: string;
  surfaceLight: string;
  surfaceLighter: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentForeground: string;
  overlay: string;
  controlOverlay: string;
  selectionBorder: string;
  shimmer: string;
}

export interface AppTheme {
  id: AppThemeId;
  label: string;
  isDark: boolean;
  statusBarStyle: StatusBarStyle;
  blurType: 'dark' | 'light' | 'xlight' | 'prominent' | 'regular' | 'extraDark';
  colors: AppThemeColors;
}

export const DEFAULT_THEME_ID: AppThemeId = 'dark';

export const APP_THEMES: Record<AppThemeId, AppTheme> = {
  dark: {
    id: 'dark',
    label: 'Dark',
    isDark: true,
    statusBarStyle: 'light-content',
    blurType: 'dark',
    colors: {
      black: '#000000',
      white: '#FFFFFF',
      background: '#08090D',
      surface: '#14171D',
      surfaceLight: '#1B1F27',
      surfaceLighter: '#262B35',
      border: '#303643',
      textPrimary: '#F5F7FA',
      textSecondary: '#A8AFBB',
      textTertiary: '#737A86',
      accent: '#F5F7FA',
      accentForeground: '#0B0D12',
      overlay: 'rgba(0,0,0,0.62)',
      controlOverlay: 'rgba(0,0,0,0.45)',
      selectionBorder: 'rgba(255,255,255,0.92)',
      shimmer: '#2B313C',
    },
  },
  light: {
    id: 'light',
    label: 'Light',
    isDark: false,
    statusBarStyle: 'dark-content',
    blurType: 'light',
    colors: {
      black: '#000000',
      white: '#FFFFFF',
      background: '#F5F7FB',
      surface: '#FFFFFF',
      surfaceLight: '#EEF2F7',
      surfaceLighter: '#E3E8F0',
      border: '#D7DFE9',
      textPrimary: '#121722',
      textSecondary: '#5E6978',
      textTertiary: '#8C96A5',
      accent: '#121722',
      accentForeground: '#FFFFFF',
      overlay: 'rgba(17,22,31,0.20)',
      controlOverlay: 'rgba(255,255,255,0.80)',
      selectionBorder: 'rgba(18,23,34,0.58)',
      shimmer: '#E3E9F0',
    },
  },
  solar: {
    id: 'solar',
    label: 'Solar',
    isDark: false,
    statusBarStyle: 'dark-content',
    blurType: 'light',
    colors: {
      black: '#000000',
      white: '#FFFFFF',
      background: '#FAF3D8',
      surface: '#FFF8E6',
      surfaceLight: '#F4E9C4',
      surfaceLighter: '#E7D8A8',
      border: '#D9C58A',
      textPrimary: '#4A3915',
      textSecondary: '#7B6640',
      textTertiary: '#A08C67',
      accent: '#5A4214',
      accentForeground: '#FFF8E6',
      overlay: 'rgba(84,63,20,0.22)',
      controlOverlay: 'rgba(255,248,230,0.82)',
      selectionBorder: 'rgba(74,57,21,0.56)',
      shimmer: '#E7D9A9',
    },
  },
  mono: {
    id: 'mono',
    label: 'Mono',
    isDark: false,
    statusBarStyle: 'dark-content',
    blurType: 'light',
    colors: {
      black: '#000000',
      white: '#FFFFFF',
      background: '#E9E9EB',
      surface: '#F7F7F8',
      surfaceLight: '#E1E1E4',
      surfaceLighter: '#CFCFD4',
      border: '#B7B8BF',
      textPrimary: '#151517',
      textSecondary: '#555862',
      textTertiary: '#7D8088',
      accent: '#1A1B1E',
      accentForeground: '#F7F7F8',
      overlay: 'rgba(21,21,23,0.20)',
      controlOverlay: 'rgba(247,247,248,0.82)',
      selectionBorder: 'rgba(21,21,23,0.54)',
      shimmer: '#D7D7DA',
    },
  },
};

export const APP_THEME_OPTIONS = (
  Object.keys(APP_THEMES) as AppThemeId[]
).map((themeId) => ({
  id: themeId,
  label: APP_THEMES[themeId].label,
}));

export function getThemeDefinition(themeId: AppThemeId | undefined): AppTheme {
  if (themeId && APP_THEMES[themeId]) {
    return APP_THEMES[themeId];
  }

  return APP_THEMES[DEFAULT_THEME_ID];
}

export function createNavigationTheme(appTheme: AppTheme): NavigationTheme {
  const baseTheme = appTheme.isDark ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    dark: appTheme.isDark,
    colors: {
      ...baseTheme.colors,
      primary: appTheme.colors.accent,
      background: appTheme.colors.background,
      card: appTheme.colors.background,
      border: appTheme.colors.border,
      text: appTheme.colors.textPrimary,
      notification: appTheme.colors.accent,
    },
  };
}
