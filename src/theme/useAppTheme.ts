import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { getThemeDefinition, type AppTheme } from './palettes';

export function useAppTheme(): AppTheme {
  const themeId = useSettingsStore((state) => state.themeId);
  return getThemeDefinition(themeId);
}

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T,
): T {
  const theme = useAppTheme();

  return useMemo(
    () => StyleSheet.create(factory(theme)),
    [factory, theme],
  );
}
