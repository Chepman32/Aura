import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../../theme';
import type { ColumnCount } from '../../hooks/usePinchToResize';

interface SkeletonLoaderProps {
  /** How many skeleton cells to render. Defaults to 9. */
  count?: number;
  /** Current column count driving the grid layout. Defaults to 3. */
  columns?: ColumnCount;
}

/**
 * A grid of shimmer placeholder cells that match the LibraryGrid layout.
 *
 * The shimmer is a bright-gradient overlay translated left-to-right in a loop
 * using Reanimated. A single shared value drives every cell so they all
 * animate in perfect sync.
 */
export default function SkeletonLoader({
  count = 9,
  columns = 3,
}: SkeletonLoaderProps): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions();

  const totalGap = columns - 1;
  const cellWidth = (screenWidth - totalGap) / columns;
  const cellHeight = (cellWidth * 9) / 16;

  // translateX moves from -cellWidth (fully left / hidden) to cellWidth
  const translateX = useSharedValue(-cellWidth);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(cellWidth, {
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // infinite
      false, // don't reverse — restart from left each cycle
    );

    return () => {
      cancelAnimation(translateX);
    };
  // cellWidth changes when columns or screen width changes — restart animation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellWidth]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.cell,
            { width: cellWidth, height: cellHeight, borderRadius: 12 },
          ]}
        >
          {/* Shimmer sweep */}
          <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
            <View style={[styles.shimmer, { width: cellWidth * 0.6 }]} />
          </Animated.View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  cell: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  shimmer: {
    height: '100%',
    // A gradient-like fade: opaque center, transparent edges.
    // Pure RN cannot do LinearGradient without an extra library, so we use a
    // lighter-toned solid that still reads clearly as a shimmer pass.
    backgroundColor: colors.shimmer,
    opacity: 0.6,
  },
});
