import React, { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Fill,
  Paint,
  ColorMatrix,
  Group,
  rect,
  Rect,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  withSpring,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { useEditorStore } from '../../store/useEditorStore';
import { useFilterPreview } from '../../hooks/useFilterPreview';
import { FILTERS, getFilterById } from '../../filters';
import { SPRING_STIFF } from '../../theme/animations';

/**
 * Invisible overlay that sits on top of VideoViewport.
 *
 * When the user swipes horizontally it reveals the adjacent filter using a
 * Skia clip-rect wipe. On release:
 * - If swiped > 50% of the viewport width → commit the new filter to the store.
 * - Otherwise → spring back to reveal = 0, keeping the current filter.
 *
 * The "new filter" side is rendered as a Skia Fill with a ColorMatrix whose
 * tint communicates the incoming filter. The actual video pixels remain
 * unchanged in the native layer — the visual feedback is the dominant-color
 * tint we derive from the ColorMatrix applied to a full fill.
 */

interface FilterWipeTransitionProps {
  width: number;
  height: number;
}

export default function FilterWipeTransition({
  width,
  height,
}: FilterWipeTransitionProps): React.JSX.Element {
  const activeFilterId = useEditorStore((s) => s.activeFilterId);
  const filterIntensity = useEditorStore((s) => s.filterIntensity);
  const setActiveFilter = useEditorStore((s) => s.setActiveFilter);

  // Candidate incoming filter during a swipe — null when not swiping.
  const [pendingFilterId, setPendingFilterId] = React.useState<string | null>(null);

  // Swipe distance in pixels (positive = swipe right = reveal prev filter,
  // negative = swipe left = reveal next filter).
  const swipeX = useSharedValue(0);
  const dragStartX = useSharedValue(0);

  // Whether we are mid-swipe — controls pointer events.
  const isSwiping = useSharedValue(false);

  // Current filter matrix (what's showing now).
  const currentMatrix = useFilterPreview(activeFilterId, filterIntensity);
  // Pending filter matrix (what we're swiping toward).
  const pendingMatrix = useFilterPreview(
    pendingFilterId ?? activeFilterId,
    filterIntensity,
  );

  const getAdjacentId = useCallback(
    (direction: 'prev' | 'next'): string | null => {
      const idx = FILTERS.findIndex((f) => f.id === activeFilterId);
      if (direction === 'prev' && idx > 0) return FILTERS[idx - 1].id;
      if (direction === 'next' && idx < FILTERS.length - 1) return FILTERS[idx + 1].id;
      return null;
    },
    [activeFilterId],
  );

  const commitFilter = useCallback(
    (filterId: string) => {
      setActiveFilter(filterId);
      setPendingFilterId(null);
    },
    [setActiveFilter],
  );

  const cancelSwipe = useCallback(() => {
    setPendingFilterId(null);
  }, []);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      dragStartX.value = swipeX.value;
    })
    .onUpdate(({ translationX }) => {
      'worklet';
      swipeX.value = translationX;

      // Determine which adjacent filter to show.
      const direction = translationX > 0 ? 'prev' : 'next';
      runOnJS(
        (d: 'prev' | 'next') => {
          const adjacentId = getAdjacentId(d);
          if (adjacentId) {
            setPendingFilterId(adjacentId);
          }
        },
      )(direction);
    })
    .onEnd(({ translationX }) => {
      'worklet';
      const threshold = width * 0.5;
      const committed = Math.abs(translationX) > threshold;

      if (committed) {
        const direction = translationX > 0 ? 'prev' : 'next';
        // Spring to full reveal then commit.
        swipeX.value = withSpring(
          translationX > 0 ? width : -width,
          SPRING_STIFF,
          (finished) => {
            if (finished) {
              runOnJS(
                (d: 'prev' | 'next') => {
                  const adjacentId = getAdjacentId(d);
                  if (adjacentId) {
                    commitFilter(adjacentId);
                  }
                  swipeX.value = 0;
                },
              )(direction);
            }
          },
        );
      } else {
        // Spring back.
        swipeX.value = withSpring(0, SPRING_STIFF, (finished) => {
          if (finished) {
            runOnJS(cancelSwipe)();
          }
        });
      }
    });

  if (width === 0 || height === 0) {
    return <></>;
  }

  // The wipe clip rects — the revealed strip width is |swipeX|.
  // When swipeX > 0 (right swipe): previous filter reveals from the left.
  // When swipeX < 0 (left swipe): next filter reveals from the right.

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.overlay]}
        pointerEvents="box-only"
      >
        {pendingFilterId ? (
          <Canvas style={{ width, height }}>
            {/*
             * The "old" filter side — shown on the side NOT being revealed.
             * Rendered as a full-screen tinted fill then clipped.
             */}
            <Group
              clip={rect(
                swipeX.value >= 0 ? Math.abs(swipeX.value) : 0,
                0,
                swipeX.value >= 0 ? width - Math.abs(swipeX.value) : width,
                height,
              )}
            >
              <Fill color="transparent">
                <Paint>
                  <ColorMatrix matrix={currentMatrix} />
                </Paint>
              </Fill>
            </Group>

            {/*
             * The "new" filter side — the revealing strip.
             * Clips to just the revealed portion.
             */}
            <Group
              clip={rect(
                swipeX.value >= 0 ? 0 : width + swipeX.value,
                0,
                Math.abs(swipeX.value),
                height,
              )}
            >
              <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                color={
                  getFilterById(pendingFilterId)?.dominantColor ?? 'transparent'
                }
                opacity={0.25}
              />
            </Group>
          </Canvas>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'transparent',
  },
});
