import { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

/**
 * Resistance factor applied to movement beyond the bounds.
 * Lower value = more rubber-band drag (0.3 feels natural on iOS).
 */
const RUBBER_BAND_RESISTANCE = 0.3;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

interface UseRubberBandResult {
  /** Shared value clamped with rubber-band resistance beyond the bounds. */
  clampedValue: SharedValue<number>;
  /**
   * Call this while the gesture is active to update the shared value.
   * Applies rubber-band resistance when the raw value is outside [min, max].
   */
  setValue: (raw: number) => void;
  /** Call this when the gesture ends. Springs back into bounds if over-extended. */
  release: () => void;
  /** Convenience animated style binding `translateX` to the clamped value. */
  animatedStyle: AnimatedStyle<ViewStyle>;
}

/**
 * Provides rubber-band / elastic clamping for a drag gesture.
 *
 * While dragging, movement beyond [min, max] is dampened by
 * RUBBER_BAND_RESISTANCE so it feels springy rather than hard-stopped.
 *
 * On release, `withSpring` snaps the value back into the valid range
 * (if it was over-extended) or holds it at the current position.
 *
 * @param min     - Lower bound of the valid range.
 * @param max     - Upper bound of the valid range.
 * @param initial - Optional starting value. Defaults to min.
 */
export function useRubberBand(
  min: number,
  max: number,
  initial?: number,
): UseRubberBandResult {
  const startValue = initial ?? min;
  const clampedValue = useSharedValue(startValue);

  const setValue = (raw: number): void => {
    'worklet';
    if (raw < min) {
      // Below lower bound — apply resistance
      const overflow = raw - min; // negative
      clampedValue.value = min + overflow * RUBBER_BAND_RESISTANCE;
    } else if (raw > max) {
      // Above upper bound — apply resistance
      const overflow = raw - max; // positive
      clampedValue.value = max + overflow * RUBBER_BAND_RESISTANCE;
    } else {
      clampedValue.value = raw;
    }
  };

  const release = (): void => {
    'worklet';
    const current = clampedValue.value;
    if (current < min) {
      clampedValue.value = withSpring(min, SPRING_CONFIG);
    } else if (current > max) {
      clampedValue.value = withSpring(max, SPRING_CONFIG);
    }
    // If within bounds, hold position — no snap needed.
  };

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateX: clampedValue.value }],
  }));

  return { clampedValue, setValue, release, animatedStyle };
}
