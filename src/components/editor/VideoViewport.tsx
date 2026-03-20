import React, { useCallback, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { useEditorStore } from '../../store/useEditorStore';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { getFilterById, IDENTITY_MATRIX } from '../../filters';
import { colors } from '../../theme';
import AuraFilteredVideoView from './AuraFilteredVideoView';

interface VideoViewportProps {
  height: number;
}

/**
 * Video viewport.
 *
 * iOS uses a native AVFoundation + Core Image pipeline for real-time filtered
 * preview frames. Android keeps the temporary overlay fallback until a
 * matching native pipeline is added there too.
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
  const filterMatrix = filter?.colorMatrix ?? IDENTITY_MATRIX;
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
          Platform.OS === 'ios' ? (
            <AuraFilteredVideoView
              sourceUri={currentVideoUri}
              style={StyleSheet.absoluteFill}
              paused={!isPlaying}
              repeatVideo
              resizeMode="cover"
              filterId={activeFilterId}
              filterMatrix={filterMatrix}
              filterMatrixPayload={filterMatrix.join(',')}
              filterIntensity={filterIntensity}
              onLoad={(event) => onLoad(event.nativeEvent.duration)}
              onProgress={(event) => onProgress(event.nativeEvent.currentTime)}
              onEnd={onEnd}
            />
          ) : (
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
          )
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
        )}

        {/* Temporary Android-only preview overlay */}
        {Platform.OS !== 'ios' && !isOriginal && overlayOpacity > 0 && (
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
