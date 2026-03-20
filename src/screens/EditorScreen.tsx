import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../app/navigation/types';
import { useEditorStore } from '../store/useEditorStore';
import VideoViewport from '../components/editor/VideoViewport';
import AuraRibbon from '../components/editor/AuraRibbon';
import IntensitySlider from '../components/editor/IntensitySlider';
import TimelineScrubber from '../components/editor/TimelineScrubber';
import AnimatedPressable from '../components/shared/AnimatedPressable';
import { getFilterById } from '../filters';
import { colors, spacing, typography } from '../theme';
import { SPRING_BOUNCY } from '../theme/animations';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

const VIEWPORT_RATIO = 0.65;

export default function EditorScreen({ route, navigation }: Props): React.JSX.Element {
  const { videoUri } = route.params;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const setVideoUri = useEditorStore((s) => s.setVideoUri);
  const activeFilterId = useEditorStore((s) => s.activeFilterId);
  const filterIntensity = useEditorStore((s) => s.filterIntensity);
  const reset = useEditorStore((s) => s.reset);

  const [sliderVisible, setSliderVisible] = useState(false);

  // Set video URI on mount, reset on unmount
  useEffect(() => {
    setVideoUri(videoUri);
    return () => {
      reset();
    };
  }, [videoUri, setVideoUri, reset]);

  const viewportHeight = screenHeight * VIEWPORT_RATIO;
  const controlDeckHeight = screenHeight * (1 - VIEWPORT_RATIO);

  const activeFilter = getFilterById(activeFilterId);

  const toggleSlider = useCallback(() => {
    setSliderVisible((v) => !v);
  }, []);

  const handleExport = useCallback(() => {
    navigation.navigate('Export', {
      videoUri,
      filterId: activeFilterId,
      intensity: filterIntensity,
    });
  }, [navigation, videoUri, activeFilterId, filterIntensity]);

  return (
    <View style={styles.container}>
      {/* Video Viewport — top 65% */}
      <VideoViewport height={viewportHeight} />

      {/* Control Deck — bottom 35% */}
      <View style={[styles.controlDeck, { height: controlDeckHeight, paddingBottom: insets.bottom }]}>
        {/* Filter name — tap to toggle intensity slider */}
        <AnimatedPressable onPress={toggleSlider} style={styles.filterNameButton}>
          <Text style={styles.filterName}>
            {activeFilter?.name ?? 'Original'}
          </Text>
          <Text style={styles.intensityHint}>
            {sliderVisible ? 'Hide Intensity' : 'Adjust Intensity'}
          </Text>
        </AnimatedPressable>

        {/* Intensity Slider */}
        <IntensitySlider
          visible={sliderVisible}
          containerWidth={screenWidth}
        />

        {/* Aura Ribbon */}
        <AuraRibbon containerWidth={screenWidth} />

        {/* Timeline Scrubber area */}
        <TimelineScrubber containerWidth={screenWidth} />

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
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
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
