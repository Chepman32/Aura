import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AnimatedPressable from '../shared/AnimatedPressable';
import { colors, spacing, typography } from '../../theme';

interface NamePromptModalProps {
  visible: boolean;
  title: string;
  description: string;
  initialValue: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export default function NamePromptModal({
  visible,
  title,
  description,
  initialValue,
  confirmLabel,
  onCancel,
  onConfirm,
}: NamePromptModalProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setValue(initialValue);
    const timeoutId = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [initialValue, visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={setValue}
            style={styles.input}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.textPrimary}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => onConfirm(value)}
          />
          <View style={styles.actions}>
            <AnimatedPressable onPress={onCancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => onConfirm(value)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{confirmLabel}</Text>
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceLight,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceLight,
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  primaryButton: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.textPrimary,
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: colors.black,
  },
});

