import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Path,
  BlurMask,
  Text as SkiaText,
  matchFont,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withSpring,
  useDerivedValue,
  interpolate,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { SPRING_GENTLE } from '../../theme/animations';
import { useAppTheme } from '../../theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_SIZE = 260;
const CENTER = CANVAS_SIZE / 2;
const RING_RADIUS = 100;
const STROKE_WIDTH = 8;
const FONT_SIZE = 32;

// The arc starts at 12 o'clock. In SVG/Skia convention:
//   0° = 3 o'clock, so 12 o'clock = -90° = 270°.
const START_ANGLE_DEG = -90;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Produces an SVG-compatible arc path string for a given sweep angle.
 *
 * SVG arc path has the form:
 *   M startX startY A rx ry xRot largeArcFlag sweepFlag endX endY
 *
 * We use this instead of Skia.Path.Make() because addArc cannot be called
 * on the Reanimated UI thread (it is not a worklet-compatible function).
 * Skia's <Path path="..."> accepts plain SVG path strings and parses them
 * natively, so building the string on the UI thread is safe and efficient.
 */
function buildSvgArc(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  sweepDeg: number,
): string {
  'worklet';

  // Clamp sweep so we never try to draw a degenerate arc.
  const clampedSweep = Math.max(0.01, Math.min(359.99, sweepDeg));

  const startRad = (startDeg * Math.PI) / 180;
  const endRad = ((startDeg + clampedSweep) * Math.PI) / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  // Large arc flag: 1 if sweep > 180°.
  const largeArc = clampedSweep > 180 ? 1 : 0;

  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProgressRingProps {
  /** 0–1 export progress value. */
  progress: number;
  /** Hex color string from the filter's dominantColor. */
  dominantColor: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Circular progress ring drawn with Skia.
 *
 * - Dark gray background ring (full circle).
 * - Dominant-color foreground arc sweeping clockwise from 12 o'clock.
 * - Soft outer glow via BlurMask on a wider duplicate arc.
 * - Percentage label in the center using Skia's text rendering.
 *
 * All animation is driven by Reanimated shared values piped directly into
 * Skia via useDerivedValue — zero JS-to-UI-thread bridge overhead.
 */
export default function ProgressRing({
  progress,
  dominantColor,
}: ProgressRingProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withSpring(progress, SPRING_GENTLE);
  }, [progress, animatedProgress]);

  // Sweep in degrees [0, 360].
  const sweepDegrees = useDerivedValue(() =>
    interpolate(animatedProgress.value, [0, 1], [0, 360]),
  );

  // SVG arc path strings derived on the UI thread.
  const arcPath = useDerivedValue(() =>
    buildSvgArc(CENTER, CENTER, RING_RADIUS, START_ANGLE_DEG, sweepDegrees.value),
  );

  const glowArcPath = useDerivedValue(() =>
    buildSvgArc(CENTER, CENTER, RING_RADIUS, START_ANGLE_DEG, sweepDegrees.value),
  );

  // Percentage text.
  const percentText = useDerivedValue(() =>
    `${Math.round(animatedProgress.value * 100)}%`,
  );

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        {/* Background ring */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          style="stroke"
          strokeWidth={STROKE_WIDTH}
          color={colors.surfaceLighter}
        />

        {/* Glow arc — wider stroke with outer blur */}
        <Path
          path={glowArcPath}
          style="stroke"
          strokeWidth={STROKE_WIDTH + 10}
          strokeCap="round"
          color={dominantColor}
          opacity={0.45}
        >
          <BlurMask blur={14} style="outer" respectCTM={false} />
        </Path>

        {/* Foreground progress arc */}
        <Path
          path={arcPath}
          style="stroke"
          strokeWidth={STROKE_WIDTH}
          strokeCap="round"
          color={dominantColor}
        />

        {/* Center percentage label */}
        <CenterLabel
          cx={CENTER}
          cy={CENTER}
          percentText={percentText}
          dominantColor={dominantColor}
        />
      </Canvas>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CenterLabel sub-component
// ---------------------------------------------------------------------------

interface CenterLabelProps {
  cx: number;
  cy: number;
  percentText: SharedValue<string>;
  dominantColor: string;
}

function CenterLabel({
  cx,
  cy,
  percentText,
  dominantColor,
}: CenterLabelProps): React.JSX.Element | null {
  const font = matchFont({
    fontFamily: 'System',
    fontSize: FONT_SIZE,
    fontWeight: 'bold',
  });

  // Approximate horizontal centering: ~0.55 × fontSize per character.
  const textX = useDerivedValue(() => {
    const estimatedWidth = percentText.value.length * FONT_SIZE * 0.55;
    return cx - estimatedWidth / 2;
  });

  // Baseline sits ~1/3 of the font size below the center.
  const textY = useDerivedValue(() => cy + FONT_SIZE / 3);

  if (!font) {
    return null;
  }

  return (
    <SkiaText
      x={textX}
      y={textY}
      text={percentText}
      font={font}
      color={dominantColor}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  },
});
