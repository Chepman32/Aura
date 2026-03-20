import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { SPRING_BOUNCY } from '../theme';

export interface UseSpringPressResult {
  animatedStyle: AnimatedStyle<ViewStyle>;
  onPressIn: () => void;
  onPressOut: () => void;
}

/**
 * Reusable hook for spring-based press feedback.
 *
 * Scales down to `pressedScale` on press-in and springs back to 1 on
 * press-out using SPRING_BOUNCY so the release feels lively.
 *
 * @param pressedScale - Target scale on press. Defaults to 0.95.
 */
export function useSpringPress(pressedScale = 0.95): UseSpringPressResult {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(pressedScale, SPRING_BOUNCY);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, SPRING_BOUNCY);
  };

  return { animatedStyle, onPressIn, onPressOut };
}
