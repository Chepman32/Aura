import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getFilterById } from '../filters';
import { executeExport, cancelExport } from '../services/ffmpeg';
import { cleanup } from '../services/fileSystem';
import { useExportStore } from '../store/useExportStore';
import {
  spacing,
  typography,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from '../theme';
import { SPRING_STIFF, SPRING_GENTLE } from '../theme/animations';
import type { RootStackParamList } from '../app/navigation/types';

import ProgressRing from '../components/export/ProgressRing';
import ParticleEffect from '../components/export/ParticleEffect';
import CompletionBurst from '../components/export/CompletionBurst';
import AnimatedPressable from '../components/shared/AnimatedPressable';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Fraction of screen height the user must swipe to cancel the export. */
const CANCEL_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<RootStackParamList, 'Export'>;

type ExportPhase =
  | 'exporting'
  | 'saving'
  | 'complete'
  | 'error';

function toCameraRollUri(path: string): string {
  if (path.startsWith('file://')) {
    return path;
  }

  if (path.startsWith('/')) {
    return `file://${path}`;
  }

  return path;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExportScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const colors = theme.colors;
  const { videoUri, filterId, intensity } = route.params;

  // ── Store ────────────────────────────────────────────────────────────────
  const setProgress = useExportStore((s) => s.setProgress);
  const startExport = useExportStore((s) => s.startExport);
  const completeExport = useExportStore((s) => s.completeExport);
  const setError = useExportStore((s) => s.setError);
  const cancelExportStore = useExportStore((s) => s.cancelExport);
  const reset = useExportStore((s) => s.reset);
  const progress = useExportStore((s) => s.progress);

  // ── Filter ───────────────────────────────────────────────────────────────
  const filter = getFilterById(filterId);
  const dominantColor = filter?.dominantColor ?? colors.textPrimary;

  // ── Local state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<ExportPhase>('exporting');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Track the output path so we can clean it up on unmount if needed.
  const outputPathRef = useRef<string | null>(null);
  // Guard against state updates after unmount.
  const isMountedRef = useRef(true);

  // ── Slide-up entrance animation ──────────────────────────────────────────
  const translateY = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    translateY.value = withSpring(0, SPRING_STIFF);
  }, [translateY]);

  // ── Pan gesture for swipe-down-to-cancel ─────────────────────────────────
  const handleCancel = useCallback(() => {
    cancelExport().catch(() => {});
    cancelExportStore();
    navigation.goBack();
  }, [cancelExportStore, navigation]);

  const dismissAfterComplete = useCallback(() => {
    reset();
    navigation.goBack();
  }, [reset, navigation]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      // No setup needed; translationY is relative to the gesture start.
    })
    .onUpdate((event) => {
      // Only allow downward drags (positive translationY).
      const drag = Math.max(0, event.translationY);
      // Rubber-band: resistance grows as drag increases.
      const rubberBand = drag / (1 + drag / (SCREEN_HEIGHT * 0.5));
      translateY.value = rubberBand;
    })
    .onEnd((event) => {
      const drag = Math.max(0, event.translationY);
      if (drag > SCREEN_HEIGHT * CANCEL_THRESHOLD) {
        // Animate off-screen then cancel.
        translateY.value = withSpring(SCREEN_HEIGHT, SPRING_STIFF, (finished) => {
          if (finished) {
            runOnJS(handleCancel)();
          }
        });
      } else {
        // Snap back.
        translateY.value = withSpring(0, SPRING_GENTLE);
      }
    });

  // ── Main slide animated style ────────────────────────────────────────────
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ── FFmpeg export lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function runExport(): Promise<void> {
      if (!filter) {
        setPhase('error');
        setErrorMessage('Unknown filter. Please go back and try again.');
        setError('Unknown filter.');
        return;
      }

      startExport();

      try {
        const outputPath = await executeExport(
          videoUri,
          filter.id,
          filter.colorMatrix,
          intensity,
          (progressValue: number) => {
            if (cancelled || !isMountedRef.current) {
              return;
            }
            setProgress(Math.min(1, progressValue));
          },
        );

        if (cancelled || !isMountedRef.current) {
          await cleanup(outputPath);
          return;
        }

        outputPathRef.current = outputPath;

        // ── Save to camera roll ─────────────────────────────────────────
        setPhase('saving');

        try {
          await CameraRoll.saveAsset(toCameraRollUri(outputPath), { type: 'video' });
        } catch (saveErr) {
          // Saving failed — still mark complete so the user isn't stuck, but
          // surface an error message.
          if (isMountedRef.current) {
            setPhase('error');
            setErrorMessage(
              `Export succeeded but could not save to Photos: ${
                saveErr instanceof Error ? saveErr.message : String(saveErr)
              }`,
            );
            setError('Save failed.');
          }
          await cleanup(outputPath);
          return;
        }

        if (!isMountedRef.current) {
          return;
        }

        // ── Completion ─────────────────────────────────────────────────
        // Haptic is fired by CompletionBurst at the burst moment,
        // so we do not fire it here to avoid a double tap.
        completeExport();
        setPhase('complete');

        // Cleanup temp file; it's now in the camera roll.
        await cleanup(outputPath);
        outputPathRef.current = null;

      } catch (err) {
        if (cancelled || !isMountedRef.current) {
          return;
        }

        const message =
          err instanceof Error ? err.message : 'An unknown error occurred.';

        if (message === 'Export cancelled.') {
          // User-initiated cancel — already handled by handleCancel.
          return;
        }

        setPhase('error');
        setErrorMessage(message);
        setError(message);
      }
    }

    runExport();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Cancel any in-flight FFmpeg session.
      cancelExport().catch(() => {});
      // Clean up any orphaned output file.
      if (outputPathRef.current) {
        cleanup(outputPathRef.current).catch(() => {});
      }
      reset();
    };
  }, [reset]);

  // ── Retry handler ─────────────────────────────────────────────────────────
  // Navigation-based retry: go back and let the user re-initiate.
  const handleRetry = useCallback(() => {
    reset();
    navigation.goBack();
  }, [reset, navigation]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isComplete = phase === 'complete';
  const isError = phase === 'error';
  const isExporting = phase === 'exporting' || phase === 'saving';

  const statusLabel =
    phase === 'saving'
      ? 'Saving to Photos...'
      : phase === 'complete'
      ? 'Done!'
      : 'Exporting...';

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, slideStyle]}>
        {/* ----------------------------------------------------------------
            Tap-anywhere-to-dismiss overlay (only active after completion).
        ---------------------------------------------------------------- */}
        {isComplete && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissAfterComplete}
            accessibilityLabel="Dismiss export screen"
          />
        )}

        {/* ----------------------------------------------------------------
            Visual: particle layer + ring/burst, stacked in the center zone.
        ---------------------------------------------------------------- */}
        <View style={styles.visualArea}>
          {/* Particles float behind the ring */}
          <ParticleEffect
            progress={progress}
            dominantColor={dominantColor}
            active={isExporting}
          />

          {/* Ring during export / burst on completion */}
          {!isComplete ? (
            <ProgressRing
              progress={progress}
              dominantColor={dominantColor}
            />
          ) : (
            <CompletionBurst
              triggered={isComplete}
              dominantColor={dominantColor}
            />
          )}
        </View>

        {/* ----------------------------------------------------------------
            Status label.
        ---------------------------------------------------------------- */}
        {!isError && (
          <Text style={[styles.statusLabel, isComplete && styles.doneLabel]}>
            {statusLabel}
          </Text>
        )}

        {/* ----------------------------------------------------------------
            Error state.
        ---------------------------------------------------------------- */}
        {isError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Export Failed</Text>
            <Text style={styles.errorMessage} numberOfLines={3}>
              {errorMessage}
            </Text>
            <AnimatedPressable
              style={styles.retryButton}
              onPress={handleRetry}
              accessibilityLabel="Retry export"
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* ----------------------------------------------------------------
            Cancel button — only shown during active export.
        ---------------------------------------------------------------- */}
        {isExporting && (
          <View style={styles.cancelArea}>
            <AnimatedPressable
              style={styles.cancelButton}
              onPress={handleCancel}
              accessibilityLabel="Cancel export"
              accessibilityRole="button"
              pressedScale={0.92}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* ----------------------------------------------------------------
            Swipe hint — a small drag handle at the very top.
        ---------------------------------------------------------------- */}
        <View style={styles.dragHandle} pointerEvents="none" />
      </Animated.View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: AppTheme) => {
  const colors = theme.colors;

  return {
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    visualArea: {
      width: 260,
      height: 260,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    statusLabel: {
      ...typography.subtitle,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    doneLabel: {
      color: colors.textPrimary,
    },
    errorContainer: {
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      marginTop: spacing.md,
      gap: spacing.md,
    },
    errorTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    errorMessage: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      backgroundColor: colors.accent,
      borderRadius: 12,
    },
    retryButtonText: {
      ...typography.bodyMedium,
      color: colors.accentForeground,
    },
    cancelArea: {
      position: 'absolute',
      bottom: spacing.xxl,
      alignItems: 'center',
    },
    cancelButton: {
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
      borderRadius: 24,
      backgroundColor: colors.surfaceLight,
    },
    cancelText: {
      ...typography.bodyMedium,
      color: colors.textSecondary,
    },
    dragHandle: {
      position: 'absolute',
      top: spacing.sm,
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
  };
};
