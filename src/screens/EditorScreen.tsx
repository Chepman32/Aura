import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Play, Pause } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { RootStackParamList } from '../app/navigation/types';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';
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
  const { projectId } = route.params;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const project = useProjectStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const updateProjectSession = useProjectStore((state) => state.updateProjectSession);
  const refreshProjectPreview = useProjectStore((state) => state.refreshProjectPreview);
  const setVideoUri = useEditorStore((s) => s.setVideoUri);
  const setActiveFilter = useEditorStore((s) => s.setActiveFilter);
  const setFilterIntensity = useEditorStore((s) => s.setFilterIntensity);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setDuration = useEditorStore((s) => s.setDuration);
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
  const hydratedProjectId = useRef<string | null>(null);

  const persistProjectSnapshot = useCallback(() => {
    if (!project) {
      return;
    }

    const latestState = useEditorStore.getState();
    const previewTimeMs = Math.round(latestState.currentTime * 1000);

    updateProjectSession(projectId, {
      filterId: latestState.activeFilterId,
      filterIntensity: latestState.filterIntensity,
      previewTimeMs,
    });

    refreshProjectPreview(projectId, {
      timeMs: previewTimeMs,
      sourceVideoUri: project.sourceVideoUri,
      filterId: latestState.activeFilterId,
      filterIntensity: latestState.filterIntensity,
    }).catch(() => {});
  }, [project, projectId, refreshProjectPreview, updateProjectSession]);

  useEffect(() => {
    if (!project || hydratedProjectId.current === projectId) {
      return;
    }

    hydratedProjectId.current = projectId;
    const savedTimeSeconds = project.previewTimeMs / 1000;

    setVideoUri(project.sourceVideoUri);
    setActiveFilter(project.filterId);
    setFilterIntensity(project.filterIntensity);
    setCurrentTime(savedTimeSeconds);
    setDuration(project.duration);
    if (savedTimeSeconds > 0) {
      requestSeek(savedTimeSeconds);
    }

    return () => {
      hydratedProjectId.current = null;
      reset();
    };
  }, [
    project?.id,
    projectId,
    requestSeek,
    reset,
    setActiveFilter,
    setCurrentTime,
    setDuration,
    setFilterIntensity,
    setVideoUri,
  ]);

  useEffect(() => {
    if (!project) {
      return;
    }

    const previewTimeMs = Math.round(currentTime * 1000);
    const timeoutId = setTimeout(() => {
      updateProjectSession(projectId, {
        filterId: activeFilterId,
        filterIntensity,
        previewTimeMs,
      });
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [
    activeFilterId,
    currentTime,
    filterIntensity,
    project,
    projectId,
    updateProjectSession,
  ]);

  useEffect(() => {
    if (!project) {
      return;
    }

    const unsubscribe = navigation.addListener('blur', persistProjectSnapshot);

    return unsubscribe;
  }, [navigation, persistProjectSnapshot, project]);

  const viewportHeight = screenHeight * VIEWPORT_RATIO;
  const activeFilter = getFilterById(activeFilterId);

  const toggleSlider = useCallback(() => {
    setSliderVisible((v) => !v);
  }, []);

  const togglePlayback = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const handleGoBack = useCallback(() => {
    persistProjectSnapshot();
    navigation.goBack();
  }, [navigation, persistProjectSnapshot]);

  const handleExport = useCallback(() => {
    if (!project) {
      return;
    }

    navigation.navigate('Export', {
      videoUri: project.sourceVideoUri,
      filterId: activeFilterId,
      intensity: filterIntensity,
    });
  }, [activeFilterId, filterIntensity, navigation, project]);

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

  if (!project) {
    return (
      <View style={styles.missingState}>
        <Text style={styles.missingStateTitle}>Project Unavailable</Text>
        <Text style={styles.missingStateBody}>
          This project could not be loaded. Return to Home and try again.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Viewport */}
      <VideoViewport height={viewportHeight} />

      <AnimatedPressable
        onPress={handleGoBack}
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
        accessibilityLabel="Go Back"
        accessibilityRole="button"
      >
        <ChevronLeft size={20} color={colors.textPrimary} />
      </AnimatedPressable>

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
  backButton: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  missingStateTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  missingStateBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
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
