import React from 'react';
import { Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSpringPress } from '../../hooks/useSpringPress';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  /** Pressable content. */
  children: React.ReactNode;
  /** Additional styles applied to the outer animated container. */
  style?: StyleProp<ViewStyle>;
  /**
   * Scale target when the element is pressed.
   * Defaults to 0.95 — matches the design system press feedback spec.
   */
  pressedScale?: number;
}

/**
 * Drop-in replacement for Pressable that adds spring scale feedback on every
 * press using SPRING_BOUNCY from the design system.
 *
 * Compose this around any tappable surface instead of writing bespoke
 * Reanimated logic per component.
 */
export default function AnimatedPressable({
  children,
  style,
  pressedScale = 0.95,
  onPressIn: externalOnPressIn,
  onPressOut: externalOnPressOut,
  ...rest
}: AnimatedPressableProps): React.JSX.Element {
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress(pressedScale);

  const handlePressIn = (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
    onPressIn();
    externalOnPressIn?.(event);
  };

  const handlePressOut = (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
    onPressOut();
    externalOnPressOut?.(event);
  };

  return (
    <AnimatedPressableBase
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}
