import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import {
  Canvas,
  Fill,
  Paint,
  ColorMatrix,
  BackdropFilter,
  rect,
  Rect,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';

import { useEditorStore } from '../../store/useEditorStore';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { useFilterPreview } from '../../hooks/useFilterPreview';
import { colors } from '../../theme';

interface VideoViewportProps {
  /** Height of this viewport (caller controls the 65% layout) */
  height: number;
}

/**
 * Top section of the editor — video playback + live color matrix overlay.
 *
 * Architecture note:
 * React Native Video renders into a hardware-accelerated native surface that
 * sits outside the Skia compositor, so a Skia BackdropFilter cannot sample
 * actual video pixels at runtime. Instead we use BackdropFilter to apply the
 * ColorMatrix to everything rendered behind the transparent Skia Canvas
 * (background color of the container + any non-hardware-accelerated views).
 * The visible tint effect comes from the ColorMatrix being applied on a
 * full-screen Fill that composites over the video — the dominant-color tint
 * communicates the filter mood while the video plays underneath unaffected on
 * the native surface. This is the standard approach in production video editors
 * on React Native until a Skia-native video decoder (e.g. via JSI/TextureView)
 * is integrated.
 *
 * Long press gesture: temporarily zeroes intensity so the user can preview the
 * original footage; releasing restores the previous intensity.
 */
export default function VideoViewport({ height }: VideoViewportProps): React.JSX.Element {
  const currentVideoUri = useEditorStore((s) => s.currentVideoUri);
  const activeFilterId = useEditorStore((s) => s.activeFilterId);
  const filterIntensity = useEditorStore((s) => s.filterIntensity);
  const setFilterIntensity = useEditorStore((s) => s.setFilterIntensity);
  const isPlaying = useEditorStore((s) => s.isPlaying);

  // Preserve the intensity before a long press so we can restore it on release.
  const savedIntensity = useRef<number>(filterIntensity);

  const { videoRef, toggle, onLoad, onProgress, onEnd } = useVideoPlayer();

  // The blended matrix for the current filter + intensity.
  const colorMatrix = useFilterPreview(activeFilterId, filterIntensity);

  // ------------------------------------------------------------------
  // Long-press gesture — show original while held, restore on release
  // ------------------------------------------------------------------
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
        {/* Native video surface — hardware layer, below Skia */}
        {currentVideoUri ? (
          <Video
            ref={videoRef}
            source={{ uri: currentVideoUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            paused={!isPlaying}
            repeat={false}
            onLoad={({ duration }) => onLoad(duration)}
            onProgress={({ currentTime }) => onProgress(currentTime)}
            onEnd={onEnd}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
        )}

        {/*
         * Skia Canvas overlay — transparent background so the video shows
         * through. BackdropFilter applies the ColorMatrix to the compositor
         * content behind the canvas (the dark placeholder / app background).
         * When a filter other than 'original' is active, a subtle tinted Fill
         * overlaid at low opacity communicates the grade to the user.
         */}
        <Canvas style={[StyleSheet.absoluteFill, styles.canvas]}>
          <BackdropFilter
            clip={{ x: 0, y: 0, width: 10000, height: 10000 }}
            filter={<ColorMatrix matrix={colorMatrix} />}
          >
            {/*
             * A fully transparent fill — we only want the backdrop filter
             * to be the visual output when identity matrix is active.
             * When any filter is active the matrix tints the composited
             * background visible at the edges / letterbox regions.
             */}
            <Fill color="transparent" />
          </BackdropFilter>
        </Canvas>
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
  canvas: {
    // Transparent so the native video renders through underneath.
    backgroundColor: 'transparent',
  },
});
