import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { Canvas, Circle, BlurMask } from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

const PARTICLE_COUNT = 16;
const RING_RADIUS = 60;

interface VortexRingProps {
  active: boolean;
  onComplete?: () => void;
}

/**
 * Fragments converge into a ring formation, then the ring scales up
 * with increasing blur and fades out.
 */
export default function VortexRing({
  active,
  onComplete,
}: VortexRingProps): React.JSX.Element {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;

  const convergence = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const blur = useSharedValue(0);

  useEffect(() => {
    if (active) {
      // Phase 1: Converge particles to ring
      opacity.value = withTiming(1, { duration: 100 });
      convergence.value = withSpring(1, {
        damping: 14,
        stiffness: 160,
        mass: 0.6,
      });

      // Phase 2: Ring expands with blur
      const expandTimeout = setTimeout(() => {
        ringScale.value = withSpring(3, {
          damping: 18,
          stiffness: 80,
        });
        blur.value = withTiming(20, { duration: 300 });
        opacity.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.ease),
        }, () => {
          if (onComplete) {
            onComplete();
          }
        });
      }, 400);

      return () => clearTimeout(expandTimeout);
    }
  }, [active, convergence, ringScale, opacity, blur, onComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  // Pre-compute ring positions
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * RING_RADIUS;
    const y = centerY + Math.sin(angle) * RING_RADIUS;
    return { x, y };
  });

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
      pointerEvents="none"
    >
      <Canvas style={{ flex: 1 }}>
        {particles.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            color="white"
            opacity={0.8}
          >
            <BlurMask blur={2} style="normal" />
          </Circle>
        ))}
      </Canvas>
    </Animated.View>
  );
}
