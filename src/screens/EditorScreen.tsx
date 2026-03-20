import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, Pause } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { RootStackParamList } from '../app/navigation/types';
import { useEditorStore } from '../store/useEditorStore';
import VideoViewport from '../components/editor/VideoViewport';
import AuraRibbon from '../components/editor/AuraRibbon';
import IntensitySlider from '../components/editor/IntensitySlider';
import AnimatedPressable from '../components/shared/AnimatedPressable';
import { getFilterById } from '../filters';
import { formatDuration } from '../utils/formatDuration';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

const VIEWPORT_RATIO = 0.50;

export default function EditorScreen({ route, navigation }: Props): React.JSX.Element {
  const { videoUri } = route.params;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const setVideoUri = useEditorStore((s) => s.setVideoUri);
  const activeFilterId = useEditorStore((s) => s.activeFilterId);
  const filterIntensity = useEditorStore((s) => s.filterIntensity);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const requestSeek = useEditorStore((s) => s.requestSeek);
  const reset = useEditorStore((s) => s.reset);

  const [sliderVisible, setSliderVisible] = useState(false);
  const [timelineWidth, setTimelineWidth] = useState(0);

  useEffect(() => {
    setVideoUri(videoUri);
    return () => {
      reset();
    };
  }, [videoUri, setVideoUri, reset]);

  const viewportHeight = screenHeight * VIEWPORT_RATIO;
  const activeFilter = getFilterById(activeFilterId);

  const toggleSlider = useCallback(() => {
    setSliderVisible((v) => !v);
  }, []);

  const togglePlayback = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const handleExport = useCallback(() => {
    navigation.navigate('Export', {
      videoUri,
      filterId: activeFilterId,
      intensity: filterIntensity,
    });
  }, [navigation, videoUri, activeFilterId, filterIntensity]);

  // Timeline progress ratio
  const progressRatio = duration > 0 ? currentTime / duration : 0;

  const seekToRatio = useCallback((ratio: number) => {
    if (duration <= 0) {
      return;
    }

    const clampedRatio = Math.max(0, Math.min(1, ratio));
    requestSeek(clampedRatio * duration);
  }, [duration, requestSeek]);

  const seekToPosition = useCallback((x: number) => {
    if (timelineWidth <= 0) {
      return;
    }

    seekToRatio(x / timelineWidth);
  }, [seekToRatio, timelineWidth]);

  const handleTimelineLayout = useCallback((event: LayoutChangeEvent) => {
    setTimelineWidth(event.nativeEvent.layout.width);
  }, []);

  const timelinePanGesture = Gesture.Pan()
    .onUpdate(({ x }) => {
      'worklet';
      runOnJS(seekToPosition)(x);
    });

  const timelineTapGesture = Gesture.Tap()
    .onEnd(({ x }) => {
      'worklet';
      runOnJS(seekToPosition)(x);
    });

  const timelineGesture = Gesture.Simultaneous(timelinePanGesture, timelineTapGesture);

  return (
    <View style={styles.container}>
      {/* Video Viewport */}
      <VideoViewport height={viewportHeight} />

      {/* Control Deck */}
      <View style={[styles.controlDeck, { paddingBottom: insets.bottom + spacing.xs }]}>

        {/* Play/Pause + Time */}
        <View style={styles.playbackRow}>
          <AnimatedPressable onPress={togglePlayback} style={styles.playButton}>
            {isPlaying ? (
              <Pause size={22} color={colors.textPrimary} fill={colors.textPrimary} />
            ) : (
              <Play size={22} color={colors.textPrimary} fill={colors.textPrimary} />
            )}
          </AnimatedPressable>
          <Text style={styles.timeText}>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </Text>
        </View>

        {/* Timeline bar */}
        <View style={styles.timelineContainer}>
          <GestureDetector gesture={timelineGesture}>
            <View onLayout={handleTimelineLayout} style={styles.timelineTrack}>
              <View
                style={[
                  styles.timelineProgress,
                  {
                    width: `${progressRatio * 100}%`,
                    backgroundColor: activeFilter?.dominantColor ?? colors.textPrimary,
                  },
                ]}
              />
              <View
                style={[
                  styles.timelineThumb,
                  {
                    left: `${progressRatio * 100}%`,
                    backgroundColor: activeFilter?.dominantColor ?? colors.textPrimary,
                  },
                ]}
              />
              <View style={styles.timelineTouchTarget} />
            </View>
          </GestureDetector>
        </View>

        {/* Filter name — tap to toggle intensity slider */}
        <AnimatedPressable onPress={toggleSlider} style={styles.filterNameButton}>
          <Text style={styles.filterName}>
            {activeFilter?.name ?? 'Original'}
          </Text>
          <Text style={styles.intensityHint}>
            {Math.round(filterIntensity * 100)}% · Tap to adjust
          </Text>
        </AnimatedPressable>

        {/* Intensity Slider */}
        <IntensitySlider
          visible={sliderVisible}
          containerWidth={screenWidth}
        />

        {/* Aura Ribbon */}
        <AuraRibbon containerWidth={screenWidth} />

        {/* Export Button */}
        <View style={styles.exportRow}>
          <AnimatedPressable onPress={handleExport} style={styles.exportButton}>
            <Text style={styles.exportText}>Export</Text>
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  controlDeck: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  timeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  timelineContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  timelineTrack: {
    height: 4,
    backgroundColor: colors.surfaceLighter,
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  timelineProgress: {
    height: '100%',
    borderRadius: 2,
  },
  timelineThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  timelineTouchTarget: {
    position: 'absolute',
    top: -14,
    right: 0,
    bottom: -14,
    left: 0,
  },
  filterNameButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  filterName: {
    ...typography.subtitle,
    color: colors.textPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  intensityHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  exportRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: 'auto',
  },
  exportButton: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    borderRadius: 24,
  },
  exportText: {
    ...typography.body,
    color: colors.black,
    fontWeight: '700',
  },
});
