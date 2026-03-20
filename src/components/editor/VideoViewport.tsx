import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { useEditorStore } from '../../store/useEditorStore';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { getFilterById } from '../../filters';
import { colors } from '../../theme';

interface VideoViewportProps {
  height: number;
}

/**
 * Video viewport with a colored overlay that represents the active filter.
 *
 * Since Skia BackdropFilter cannot capture native Video pixels (different
 * compositor), we use a semi-transparent colored View overlay. The overlay
 * color is the filter's dominantColor at reduced opacity scaled by intensity.
 * This gives clear visual feedback when switching filters.
 *
 * Long press: temporarily hides overlay to preview original.
 * Tap: play/pause toggle.
 */
export default function VideoViewport({ height }: VideoViewportProps): React.JSX.Element {
  const currentVideoUri = useEditorStore((s) => s.currentVideoUri);
  const activeFilterId = useEditorStore((s) => s.activeFilterId);
  const filterIntensity = useEditorStore((s) => s.filterIntensity);
  const setFilterIntensity = useEditorStore((s) => s.setFilterIntensity);
  const isPlaying = useEditorStore((s) => s.isPlaying);

  const savedIntensity = useRef<number>(filterIntensity);
  const { videoRef, toggle, onLoad, onProgress, onEnd } = useVideoPlayer();

  const filter = getFilterById(activeFilterId);
  const dominantColor = filter?.dominantColor ?? '#FFFFFF';
  const isOriginal = activeFilterId === 'original';

  // Overlay opacity = 0.35 * intensity for non-original filters
  const overlayOpacity = isOriginal ? 0 : 0.35 * filterIntensity;

  // Long-press gesture — show original while held
  const isLongPressing = useSharedValue(false);

  const restoreIntensity = useCallback(() => {
    setFilterIntensity(savedIntensity.current);
  }, [setFilterIntensity]);

  const saveAndZeroIntensity = useCallback(() => {
    savedIntensity.current = filterIntensity;
    setFilterIntensity(0);
  }, [filterIntensity, setFilterIntensity]);

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      'worklet';
      isLongPressing.value = true;
      runOnJS(saveAndZeroIntensity)();
    })
    .onFinalize(() => {
      'worklet';
      if (isLongPressing.value) {
        isLongPressing.value = false;
        runOnJS(restoreIntensity)();
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    'worklet';
    runOnJS(toggle)();
  });

  const composedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={[styles.container, { height }]}>
        {currentVideoUri ? (
          <Video
            ref={videoRef}
            source={{ uri: currentVideoUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            paused={!isPlaying}
            repeat
            onLoad={({ duration }) => onLoad(duration)}
            onProgress={({ currentTime }) => onProgress(currentTime)}
            onEnd={onEnd}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
        )}

        {/* Color overlay representing the active filter */}
        {!isOriginal && overlayOpacity > 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: dominantColor,
                opacity: overlayOpacity,
              },
            ]}
            pointerEvents="none"
          />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.black,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  placeholder: {
    backgroundColor: colors.surface,
  },
});
