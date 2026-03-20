import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { Volume2, VolumeX } from 'lucide-react-native';

import { useEditorStore } from '../../store/useEditorStore';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { getFilterById, IDENTITY_MATRIX } from '../../filters';
import { colors } from '../../theme';
import AuraFilteredVideoView from './AuraFilteredVideoView';
import AnimatedPressable from '../shared/AnimatedPressable';

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
  const isMuted = useEditorStore((s) => s.isMuted);
  const setMuted = useEditorStore((s) => s.setMuted);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const requestedSeekTime = useEditorStore((s) => s.requestedSeekTime);
  const seekRequestId = useEditorStore((s) => s.seekRequestId);

  const savedIntensity = useRef<number>(filterIntensity);
  const { videoRef, toggle, seek, onLoad, onProgress, onEnd } = useVideoPlayer();

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

  const toggleMuted = useCallback(() => {
    setMuted(!isMuted);
  }, [isMuted, setMuted]);

  useEffect(() => {
    if (Platform.OS !== 'ios' && seekRequestId > 0) {
      seek(requestedSeekTime);
    }
  }, [requestedSeekTime, seek, seekRequestId]);

  return (
    <View style={[styles.container, { height }]}>
      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill}>
          {currentVideoUri ? (
            Platform.OS === 'ios' ? (
              <AuraFilteredVideoView
                sourceUri={currentVideoUri}
                style={StyleSheet.absoluteFill}
                paused={!isPlaying}
                muted={isMuted}
                repeatVideo
                resizeMode="cover"
                filterId={activeFilterId}
                filterMatrix={filterMatrix}
                filterMatrixPayload={filterMatrix.join(',')}
                filterIntensity={filterIntensity}
                seekToTime={requestedSeekTime}
                seekRequestId={seekRequestId}
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
                muted={isMuted}
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

      <AnimatedPressable onPress={toggleMuted} style={styles.muteButton}>
        {isMuted ? (
          <VolumeX size={18} color={colors.textPrimary} />
        ) : (
          <Volume2 size={18} color={colors.textPrimary} />
        )}
      </AnimatedPressable>
    </View>
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
  muteButton: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
