import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, RoundedRect, Rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';

import { useEditorStore } from '../../store/useEditorStore';
import { getFilterById } from '../../filters';
import { colors, spacing, typography } from '../../theme';
import { SPRING_BOUNCY, SPRING_GENTLE } from '../../theme/animations';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
const TRACK_HEIGHT = 6;
const TRACK_RADIUS = 3;
const SLIDER_PADDING_H = spacing.xl; // left + right padding inside the container
const RUBBER_BAND = 0.25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Horizontal intensity slider drawn entirely in Skia with rubber-band
 * spring at the 0 % and 100 % bounds.
 *
 * Appears / disappears with a spring translate-Y animation that is driven
 * by the `visible` prop from the parent.
 */
interface IntensitySliderProps {
  /** Whether the slider is currently visible. */
  visible: boolean;
  /** Measured width of the slider container so we can scale to track width. */
  containerWidth: number;
}

export default function IntensitySlider({
  visible,
  containerWidth,
}: IntensitySliderProps): React.JSX.Element {
  const filterIntensity = useEditorStore((s) => s.filterIntensity);
  const setFilterIntensity = useEditorStore((s) => s.setFilterIntensity);
  const activeFilterId = useEditorStore((s) => s.activeFilterId);

  const activeFilter = getFilterById(activeFilterId);
  const trackColor = activeFilter?.dominantColor ?? colors.textSecondary;

  const trackWidth = containerWidth - SLIDER_PADDING_H * 2;

  // Shared value for the fill width in pixels.
  const fillWidth = useSharedValue(filterIntensity * trackWidth);
  const dragStartFill = useSharedValue(0);

  // Sync fill width when filterIntensity changes from outside (e.g. store reset).
  useEffect(() => {
    fillWidth.value = withSpring(filterIntensity * trackWidth, SPRING_GENTLE);
  }, [filterIntensity, trackWidth, fillWidth]);

  // ---- Percentage label (derived, runs on JS thread via runOnJS)
  const percentText = useSharedValue(`${Math.round(filterIntensity * 100)}%`);

  const updateStore = useCallback(
    (intensity: number) => {
      setFilterIntensity(intensity);
    },
    [setFilterIntensity],
  );

  const updateLabel = useCallback((val: string) => {
    // This runs on JS thread — just a label update, no perf concern.
    percentText.value = val;
  }, [percentText]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      dragStartFill.value = fillWidth.value;
    })
    .onUpdate(({ translationX }) => {
      'worklet';
      if (trackWidth <= 0) return;
      const raw = dragStartFill.value + translationX;

      let clamped: number;
      if (raw < 0) {
        clamped = raw * RUBBER_BAND;
      } else if (raw > trackWidth) {
        clamped = trackWidth + (raw - trackWidth) * RUBBER_BAND;
      } else {
        clamped = raw;
      }

      fillWidth.value = clamped;

      // Update store with clamped normalized value.
      const intensity = clamp(clamped / trackWidth, 0, 1);
      runOnJS(updateStore)(intensity);
      runOnJS(updateLabel)(`${Math.round(intensity * 100)}%`);
    })
    .onEnd(() => {
      'worklet';
      if (trackWidth <= 0) return;
      // Spring back into bounds.
      const clamped = clamp(fillWidth.value, 0, trackWidth);
      fillWidth.value = withSpring(clamped, SPRING_BOUNCY);

      const intensity = clamp(clamped / trackWidth, 0, 1);
      runOnJS(updateStore)(intensity);
      runOnJS(updateLabel)(`${Math.round(intensity * 100)}%`);
    });

  // ---- Appear / disappear spring (translateY)
  const translateY = useSharedValue(visible ? 0 : 40);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : 40, SPRING_BOUNCY);
    opacity.value = withSpring(visible ? 1 : 0, SPRING_GENTLE);
  }, [visible, translateY, opacity]);

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // We need to derive fillWidth as an integer for Skia — use a derived value.
  // Skia props can be Reanimated shared values directly via useSharedValue,
  // but to keep it simple we pass them as regular numbers after clamping.
  // Since Skia re-renders on its own compositor we use a Skia-compatible
  // approach: pass the shared value directly (Skia 1.3+ supports this).

  const clampedFillWidth = useDerivedValue(() =>
    clamp(fillWidth.value, 0, trackWidth > 0 ? trackWidth : 0),
  );

  return (
    <Animated.View
      style={[styles.container, containerAnimStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <GestureDetector gesture={panGesture}>
        <View style={[styles.sliderRow, { paddingHorizontal: SLIDER_PADDING_H }]}>
          {trackWidth > 0 ? (
            <Canvas style={{ width: trackWidth, height: TRACK_HEIGHT * 3 }}>
              {/* Background track */}
              <RoundedRect
                x={0}
                y={TRACK_HEIGHT}
                width={trackWidth}
                height={TRACK_HEIGHT}
                r={TRACK_RADIUS}
                color={colors.surfaceLighter}
              />
              {/* Fill track */}
              <RoundedRect
                x={0}
                y={TRACK_HEIGHT}
                width={clampedFillWidth}
                height={TRACK_HEIGHT}
                r={TRACK_RADIUS}
                color={trackColor}
              />
            </Canvas>
          ) : (
            <View style={styles.trackPlaceholder} />
          )}
        </View>
      </GestureDetector>

      <Text style={styles.percentLabel}>
        {`${Math.round(filterIntensity * 100)}%`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  sliderRow: {
    width: '100%',
    alignItems: 'center',
  },
  trackPlaceholder: {
    height: TRACK_HEIGHT * 3,
    width: '100%',
  },
  percentLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
