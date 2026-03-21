import React, { useCallback } from 'react';
import { View, FlatList } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { useEditorStore } from '../../store/useEditorStore';
import {
  spacing,
  useThemedStyles,
  type AppTheme,
} from '../../theme';
import { SPRING_BOUNCY, SPRING_GENTLE } from '../../theme/animations';

const SCRUBBER_HEIGHT = 80;
const FRAME_WIDTH = 54;
const FRAME_HEIGHT = 64;
const FRAME_GAP = 2;

interface TimelineScrubberProps {
  containerWidth: number;
}

/**
 * Swipe-up timeline scrubber with frame thumbnail placeholders.
 * Hidden by default; swipe up to reveal, swipe down to dismiss.
 */
export default function TimelineScrubber({
  containerWidth: _containerWidth,
}: TimelineScrubberProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const duration = useEditorStore((s) => s.duration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const translateY = useSharedValue(SCRUBBER_HEIGHT + 20);
  const isVisible = useSharedValue(false);
  const dragStartY = useSharedValue(0);

  const frameCount = Math.max(Math.ceil(duration), 10);

  const show = useCallback(() => {
    'worklet';
    translateY.value = withSpring(0, SPRING_BOUNCY);
    isVisible.value = true;
  }, [translateY, isVisible]);

  const hide = useCallback(() => {
    'worklet';
    translateY.value = withSpring(SCRUBBER_HEIGHT + 20, SPRING_GENTLE);
    isVisible.value = false;
  }, [translateY, isVisible]);

  const swipeGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      dragStartY.value = translateY.value;
    })
    .onUpdate(({ translationY }) => {
      'worklet';
      const next = dragStartY.value + translationY;
      translateY.value = Math.max(0, Math.min(next, SCRUBBER_HEIGHT + 20));
    })
    .onEnd(({ velocityY }) => {
      'worklet';
      if (velocityY > 300 || translateY.value > SCRUBBER_HEIGHT / 2) {
        hide();
      } else {
        show();
      }
    });

  // Tap on the scrubber area triggers reveal
  const tapGesture = Gesture.Tap().onEnd(() => {
    'worklet';
    if (!isVisible.value) {
      show();
    }
  });

  const composed = Gesture.Race(swipeGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleSeek = useCallback(
    (index: number) => {
      if (duration <= 0) return;
      const time = (index / frameCount) * duration;
      setCurrentTime(time);
    },
    [duration, frameCount, setCurrentTime],
  );

  const renderFrame = useCallback(
    ({ index }: { item: number; index: number }) => {
      const isActive =
        duration > 0 &&
        Math.floor((currentTime / duration) * frameCount) === index;
      return (
        <View
          style={[
            styles.frame,
            isActive && styles.frameActive,
          ]}
        />
      );
    },
    [currentTime, duration, frameCount, styles.frame, styles.frameActive],
  );

  const frames = Array.from({ length: frameCount }, (_, i) => i);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.handle} />
        <FlatList
          data={frames}
          renderItem={renderFrame}
          keyExtractor={(item) => item.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.frameList}
          onScroll={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const totalWidth = frameCount * (FRAME_WIDTH + FRAME_GAP);
            if (totalWidth > 0 && duration > 0) {
              const ratio = offsetX / totalWidth;
              handleSeek(Math.floor(ratio * frameCount));
            }
          }}
          scrollEventThrottle={16}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const createStyles = (theme: AppTheme) => ({
  container: {
    height: SCRUBBER_HEIGHT,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceLighter,
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  frameList: {
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    backgroundColor: theme.colors.surfaceLighter,
    borderRadius: 4,
    marginRight: FRAME_GAP,
  },
  frameActive: {
    borderWidth: 2,
    borderColor: theme.colors.textPrimary,
  },
});
