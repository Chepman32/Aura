import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../app/navigation/types';
import { useSettingsStore } from '../store/useSettingsStore';
import type { CustomPreset } from '../store/useSettingsStore';
import { useEditorStore } from '../store/useEditorStore';
import AnimatedPressable from '../components/shared/AnimatedPressable';
import { FILTERS } from '../filters';
import { colors, spacing, typography } from '../theme';
import { SPRING_GENTLE } from '../theme/animations';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// ---------------------------------------------------------------------------
// Accordion Section
// ---------------------------------------------------------------------------
interface AccordionProps {
  title: string;
  children: React.ReactNode;
}

function Accordion({ title, children }: AccordionProps) {
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
    maxHeight: height.value * 400,
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
          <ChevronDown size={20} color={colors.textSecondary} />
        </Animated.View>
      </AnimatedPressable>
      <Animated.View style={contentStyle}>{children}</Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Settings Screen
// ---------------------------------------------------------------------------
export default function SettingsScreen(_props: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const defaultIntensity = useSettingsStore((s) => s.defaultIntensity);
  const setDefaultIntensity = useSettingsStore((s) => s.setDefaultIntensity);
  const customPresets = useSettingsStore((s) => s.customPresets);
  const addPreset = useSettingsStore((s) => s.addPreset);
  const removePreset = useSettingsStore((s) => s.removePreset);

  const handleIntensityChange = useCallback(
    (text: string) => {
      const val = parseInt(text, 10);
      if (!isNaN(val)) {
        setDefaultIntensity(Math.max(0, Math.min(100, val)) / 100);
      }
    },
    [setDefaultIntensity],
  );

  const handleAddPreset = useCallback(() => {
    const id = `preset_${Date.now()}`;
    const preset: CustomPreset = {
      id,
      name: `Preset ${customPresets.length + 1}`,
      filterId: 'cinematic',
      intensity: defaultIntensity,
    };
    addPreset(preset);
  }, [addPreset, customPresets.length, defaultIntensity]);

  const handleRemovePreset = useCallback(
    (id: string, name: string) => {
      Alert.alert('Delete Preset', `Remove "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removePreset(id),
        },
      ]);
    },
    [removePreset],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      {/* Default Intensity */}
      <Accordion title="Default Intensity">
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Intensity (%)</Text>
          <TextInput
            style={styles.input}
            value={`${Math.round(defaultIntensity * 100)}`}
            onChangeText={handleIntensityChange}
            keyboardType="number-pad"
            maxLength={3}
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <Text style={styles.hint}>
          New edits will start at this intensity level.
        </Text>
      </Accordion>

      {/* Custom Presets */}
      <Accordion title="Custom Presets">
        {customPresets.length === 0 ? (
          <Text style={styles.emptyText}>No custom presets yet.</Text>
        ) : (
          customPresets.map((preset) => (
            <View key={preset.id} style={styles.presetRow}>
              <View style={styles.presetInfo}>
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetDetail}>
                  {FILTERS.find((f) => f.id === preset.filterId)?.name ?? preset.filterId}{' '}
                  · {Math.round(preset.intensity * 100)}%
                </Text>
              </View>
              <AnimatedPressable
                onPress={() => handleRemovePreset(preset.id, preset.name)}
                style={styles.deleteButton}
              >
                <Trash2 size={18} color={colors.textTertiary} />
              </AnimatedPressable>
            </View>
          ))
        )}
        <AnimatedPressable onPress={handleAddPreset} style={styles.addButton}>
          <Plus size={18} color={colors.textPrimary} />
          <Text style={styles.addButtonText}>Add Preset</Text>
        </AnimatedPressable>
      </Accordion>

      {/* About */}
      <Accordion title="About">
        <Text style={styles.aboutText}>
          Aura — Offline Video Color Grading{'\n'}
          Version 1.0.0
        </Text>
      </Accordion>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  accordionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
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
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: 64,
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  presetDetail: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  aboutText: {
    ...typography.body,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    lineHeight: 22,
  },
});
