import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { Check } from 'lucide-react-native';
import { useHaptics } from '../../hooks/useHaptics';
import { SPRING_BOUNCY, SPRING_STIFF } from '../../theme/animations';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTAINER_SIZE = 260;
const CENTER = CONTAINER_SIZE / 2;
const BURST_DOT_COUNT = 8;
const BURST_RADIUS = 90;
const BURST_DOT_RADIUS = 5;
const CHECKMARK_ICON_SIZE = 64;

// Pre-compute burst dot angles (evenly spaced around the circle).
const BURST_ANGLES: number[] = Array.from(
  { length: BURST_DOT_COUNT },
  (_, i) => (i / BURST_DOT_COUNT) * Math.PI * 2,
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CompletionBurstProps {
  /** Set to true to trigger the burst sequence. */
  triggered: boolean;
  /** Hex color string from the filter's dominantColor. */
  dominantColor: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Three-phase completion animation:
 *
 *   Phase 1 (0 ms)    — Ring collapses: spring scale 1 → 0, opacity fades.
 *   Phase 2 (200 ms)  — Burst dots expand outward, heavy haptic fires.
 *   Phase 3 (400 ms)  — Check icon springs in from scale 0 → 1.
 */
export default function CompletionBurst({
  triggered,
  dominantColor,
}: CompletionBurstProps): React.JSX.Element {
  const haptics = useHaptics();

  // ── Ring collapse ──────────────────────────────────────────────────────
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(1);

  // ── Burst ─────────────────────────────────────────────────────────────
  // 0 = dots at center, 1 = fully expanded.
  const burstProgress = useSharedValue(0);
  const burstOpacity = useSharedValue(0);

  // ── Checkmark ─────────────────────────────────────────────────────────
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);

  // ── Sequence ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!triggered) {
      return;
    }

    const fireHaptic = () => haptics.heavy();

    // Phase 1: collapse ring.
    ringScale.value = withSpring(0, { damping: 20, stiffness: 400, mass: 0.4 });
    ringOpacity.value = withTiming(0, { duration: 180 });

    // Phase 2: burst dots at 200 ms.
    // Sequence: fade in instantly → hold while dots expand → fade out.
    // Haptic fires at the moment the burst becomes visible.
    burstOpacity.value = withDelay(
      200,
      withSequence(
        withTiming(1, { duration: 50 }, (finished) => {
          if (finished) {
            runOnJS(fireHaptic)();
          }
        }),
        withDelay(250, withTiming(0, { duration: 200 })),
      ),
    );
    burstProgress.value = withDelay(200, withSpring(1, SPRING_BOUNCY));

    // Phase 3: checkmark at 400 ms.
    checkScale.value = withDelay(400, withSpring(1, SPRING_STIFF));
    checkOpacity.value = withDelay(400, withTiming(1, { duration: 100 }));
  }, [triggered]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animated styles ────────────────────────────────────────────────────
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const burstContainerStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Phase 1: collapsing ring */}
      <Animated.View style={[styles.fill, ringStyle]}>
        <Canvas style={styles.canvas}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={100}
            style="stroke"
            strokeWidth={8}
            color={dominantColor}
          />
        </Canvas>
      </Animated.View>

      {/* Phase 2: burst dots */}
      <Animated.View style={[styles.fill, burstContainerStyle]}>
        <Canvas style={styles.canvas}>
          {BURST_ANGLES.map((angle, i) => (
            <BurstDot
              key={i}
              angle={angle}
              progress={burstProgress}
              color={dominantColor}
            />
          ))}
        </Canvas>
      </Animated.View>

      {/* Phase 3: checkmark */}
      <Animated.View style={[styles.checkContainer, checkStyle]}>
        <Check
          size={CHECKMARK_ICON_SIZE}
          color={dominantColor}
          strokeWidth={2.5}
        />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// BurstDot
// A single dot that travels radially outward as `progress` goes 0 → 1.
// ---------------------------------------------------------------------------

interface BurstDotProps {
  angle: number;
  progress: SharedValue<number>;
  color: string;
}

function BurstDot({ angle, progress, color }: BurstDotProps): React.JSX.Element {
  const cx = useDerivedValue(
    () => CENTER + Math.cos(angle) * BURST_RADIUS * progress.value,
  );
  const cy = useDerivedValue(
    () => CENTER + Math.sin(angle) * BURST_RADIUS * progress.value,
  );

  return <Circle cx={cx} cy={cy} r={BURST_DOT_RADIUS} color={color} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  canvas: {
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
  },
  checkContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
