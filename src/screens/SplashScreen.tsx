import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  withDelay,
  withSpring,
  useAnimatedStyle,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../app/navigation/types';
import { requestMediaLibrary } from '../services/permissions';
import { colors } from '../theme';
import { SPRING_BOUNCY } from '../theme/animations';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/**
 * Splash screen with animated "AURA" text.
 * Uses Reanimated (not Skia) for reliability.
 * Silently requests photo library permissions during the animation.
 */
export default function SplashScreen({ navigation }: Props): React.JSX.Element {
  const navigated = useRef(false);

  const goHome = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    navigation.replace('Home');
  }, [navigation]);

  // Silently request permissions during animation
  useEffect(() => {
    requestMediaLibrary().catch(() => {});
  }, []);

  // Animation values
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.8);
  const titleLetterSpacing = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // Phase 1: Title fades in and scales up (0-600ms)
    titleOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
    );
    titleScale.value = withDelay(
      200,
      withSpring(1, SPRING_BOUNCY),
    );

    // Phase 2: Letter spacing expands (600-1000ms)
    titleLetterSpacing.value = withDelay(
      600,
      withSpring(16, { damping: 10, stiffness: 100 }),
    );

    // Phase 3: Fade out and navigate (1200-1700ms)
    containerOpacity.value = withDelay(
      1300,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }, (finished) => {
        if (finished) {
          runOnJS(goHome)();
        }
      }),
    );

    // Safety timeout — navigate even if animations fail
    const safety = setTimeout(goHome, 2500);
    return () => clearTimeout(safety);
  }, [titleOpacity, titleScale, titleLetterSpacing, containerOpacity, goHome]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
    letterSpacing: titleLetterSpacing.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.Text style={[styles.title, titleStyle]}>
        AURA
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
