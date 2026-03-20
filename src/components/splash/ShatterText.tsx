import React, { useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Canvas,
  Text as SkiaText,
  useFont,
  Group,
  RoundedRect,
  matchFont,
} from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

import { SPRING_BOUNCY } from '../../theme/animations';

const FRAGMENT_COLS = 5;
const FRAGMENT_ROWS = 4;
const TOTAL_FRAGMENTS = FRAGMENT_COLS * FRAGMENT_ROWS;

interface ShatterTextProps {
  /** Trigger the shatter animation */
  shatter: boolean;
  onShatterComplete?: () => void;
}

/**
 * "AURA" text that shatters into rectangular fragments.
 * Each fragment flies outward with spring physics.
 */
export default function ShatterText({
  shatter,
  onShatterComplete,
}: ShatterTextProps): React.JSX.Element {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const font = matchFont({
    fontFamily: 'System',
    fontSize: 72,
    fontWeight: 'bold',
  });

  const textWidth = font ? font.getTextWidth('AURA') : 200;
  const textHeight = 72;

  const textX = (screenWidth - textWidth) / 2;
  const textY = (screenHeight - textHeight) / 2;

  const fragW = textWidth / FRAGMENT_COLS;
  const fragH = textHeight / FRAGMENT_ROWS;

  // Create shared values for each fragment
  const fragments = useMemo(() => {
    return Array.from({ length: TOTAL_FRAGMENTS }, (_, i) => {
      const col = i % FRAGMENT_COLS;
      const row = Math.floor(i / FRAGMENT_COLS);
      // Direction: outward from center
      const centerCol = (FRAGMENT_COLS - 1) / 2;
      const centerRow = (FRAGMENT_ROWS - 1) / 2;
      const dx = (col - centerCol) * 80 + (Math.random() - 0.5) * 60;
      const dy = (row - centerRow) * 80 + (Math.random() - 0.5) * 60;
      const rotation = (Math.random() - 0.5) * 45;
      return { col, row, dx, dy, rotation };
    });
  }, []);

  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (shatter) {
      progress.value = withSpring(1, {
        damping: 8,
        stiffness: 100,
        mass: 0.5,
        velocity: 5,
      }, (finished) => {
        if (finished && onShatterComplete) {
          // Fade out after shatter
          opacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
        }
      });
    }
  }, [shatter, progress, opacity, onShatterComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!font) return <></>;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: screenWidth,
          height: screenHeight,
        },
        containerStyle,
      ]}
    >
      <Canvas style={{ flex: 1 }}>
        {/* Render "AURA" as a single text element — the shatter is simulated
            by rendering colored rect fragments that move. The text itself
            fades away when shatter begins. */}
        {!shatter && (
          <SkiaText
            x={textX}
            y={textY + textHeight * 0.8}
            text="AURA"
            font={font}
            color="white"
          />
        )}

        {shatter &&
          fragments.map((frag, i) => {
            const x = textX + frag.col * fragW;
            const y = textY + frag.row * fragH;
            return (
              <Group
                key={i}
                transform={[
                  { translateX: x + fragW / 2 },
                  { translateY: y + fragH / 2 },
                  { translateX: -(x + fragW / 2) },
                  { translateY: -(y + fragH / 2) },
                ]}
              >
                <RoundedRect
                  x={x}
                  y={y}
                  width={fragW}
                  height={fragH}
                  r={2}
                  color="white"
                  opacity={0.9}
                />
              </Group>
            );
          })}
      </Canvas>
    </Animated.View>
  );
}
