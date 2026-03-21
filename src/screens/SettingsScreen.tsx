import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../app/navigation/types';
import { useSettingsStore } from '../store/useSettingsStore';
import AnimatedPressable from '../components/shared/AnimatedPressable';
import {
  APP_THEMES,
  APP_THEME_OPTIONS,
  SPRING_GENTLE,
  spacing,
  typography,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
  type AppThemeId,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface AccordionProps {
  title: string;
  children: React.ReactNode;
}

const THEME_COPY: Record<AppThemeId, string> = {
  dark: 'High-contrast night palette.',
  light: 'Neutral daylight surfaces.',
  solar: 'Warm parchment and honey tones.',
  mono: 'Quiet grayscale minimalism.',
};

function Accordion({ title, children }: AccordionProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const height = useSharedValue(0);
  const rotation = useSharedValue(0);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    height.value = withSpring(next ? 1 : 0, SPRING_GENTLE);
    rotation.value = withSpring(next ? 180 : 0, SPRING_GENTLE);
  }, [expanded, height, rotation]);

  const contentStyle = useAnimatedStyle(() => ({
    maxHeight: height.value * 520,
    opacity: height.value,
    overflow: 'hidden' as const,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.accordionContainer}>
      <AnimatedPressable onPress={toggle} style={styles.accordionHeader}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={20} color={theme.colors.textSecondary} />
        </Animated.View>
      </AnimatedPressable>
      <Animated.View style={contentStyle}>{children}</Animated.View>
    </View>
  );
}

export default function SettingsScreen(_props: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const defaultIntensity = useSettingsStore((state) => state.defaultIntensity);
  const setDefaultIntensity = useSettingsStore((state) => state.setDefaultIntensity);
  const themeId = useSettingsStore((state) => state.themeId);
  const setThemeId = useSettingsStore((state) => state.setThemeId);

  const handleIntensityChange = useCallback(
    (text: string) => {
      const value = parseInt(text, 10);
      if (!Number.isNaN(value)) {
        setDefaultIntensity(Math.max(0, Math.min(100, value)) / 100);
      }
    },
    [setDefaultIntensity],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Accordion title="Appearance">
        <View style={styles.themeGrid}>
          {APP_THEME_OPTIONS.map((option) => {
            const optionTheme = APP_THEMES[option.id];
            const isSelected = option.id === themeId;

            return (
              <AnimatedPressable
                key={option.id}
                onPress={() => setThemeId(option.id)}
                style={[
                  styles.themeCard,
                  isSelected && styles.themeCardSelected,
                ]}
                accessibilityLabel={`Switch to ${option.label} theme`}
                accessibilityRole="button"
              >
                <View style={styles.themeHeaderRow}>
                  <Text style={styles.themeTitle}>{option.label}</Text>
                  <View
                    style={[
                      styles.themeCheck,
                      isSelected && styles.themeCheckSelected,
                    ]}
                  >
                    {isSelected ? (
                      <Check size={14} color={theme.colors.accentForeground} strokeWidth={2.4} />
                    ) : null}
                  </View>
                </View>

                <View style={styles.themePreviewRow}>
                  <View
                    style={[
                      styles.themePreviewBlock,
                      { backgroundColor: optionTheme.colors.background },
                    ]}
                  />
                  <View
                    style={[
                      styles.themePreviewBlock,
                      { backgroundColor: optionTheme.colors.surface },
                    ]}
                  />
                  <View
                    style={[
                      styles.themePreviewAccent,
                      { backgroundColor: optionTheme.colors.accent },
                    ]}
                  />
                </View>

                <Text style={styles.themeDescription}>
                  {THEME_COPY[option.id]}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </Accordion>

      <Accordion title="Default Intensity">
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Intensity (%)</Text>
          <TextInput
            style={styles.input}
            value={`${Math.round(defaultIntensity * 100)}`}
            onChangeText={handleIntensityChange}
            keyboardType="number-pad"
            maxLength={3}
            placeholderTextColor={theme.colors.textTertiary}
            selectionColor={theme.colors.accent}
          />
        </View>
        <Text style={styles.hint}>
          New edits will start at this intensity level.
        </Text>
      </Accordion>

      <Accordion title="About">
        <Text style={styles.aboutText}>
          Aura{'\n'}
          Offline video color grading{'\n'}
          Version 1.0.0
        </Text>
      </Accordion>
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) => {
  const colors = theme.colors;

  return {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingTop: spacing.md,
      paddingHorizontal: spacing.md,
    },
    accordionContainer: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginBottom: spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    accordionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md + 2,
    },
    accordionTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    themeCard: {
      width: '48%',
      minHeight: 134,
      borderRadius: 18,
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    themeCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceLighter,
    },
    themeHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    themeTitle: {
      ...typography.bodyMedium,
      color: colors.textPrimary,
    },
    themeCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    themeCheckSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    themePreviewRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: spacing.sm,
    },
    themePreviewBlock: {
      flex: 1,
      height: 34,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    themePreviewAccent: {
      width: 26,
      height: 34,
      borderRadius: 10,
    },
    themeDescription: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    settingLabel: {
      ...typography.body,
      color: colors.textSecondary,
    },
    input: {
      ...typography.body,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceLight,
      borderRadius: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      width: 72,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    hint: {
      ...typography.caption,
      color: colors.textTertiary,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    aboutText: {
      ...typography.body,
      color: colors.textSecondary,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      lineHeight: 24,
    },
  };
};
