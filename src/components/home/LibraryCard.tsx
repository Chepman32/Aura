import React, { memo } from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import AnimatedPressable from '../shared/AnimatedPressable';
import DurationBadge from './DurationBadge';
import type { ColumnCount } from '../../hooks/usePinchToResize';

interface LibraryCardProps {
  uri: string;
  duration: number;
  filename: string;
  columns: ColumnCount;
  onPress: () => void;
}

/**
 * A single video thumbnail cell in the library grid.
 *
 * Sizing is derived from the screen width and current column count so the
 * grid stays pixel-perfect at any column setting. A 1px gap is reserved
 * between cells (total gutter = columns - 1 gaps, split symmetrically).
 *
 * The aspect ratio is fixed at 16:9 to match common video proportions.
 */
function LibraryCard({
  uri,
  duration,
  columns,
  onPress,
}: LibraryCardProps): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions();

  // 1px gaps between columns: (columns - 1) total gap width across the row.
  const totalGap = columns - 1;
  const cellWidth = (screenWidth - totalGap) / columns;
  // 16:9 aspect ratio
  const cellHeight = (cellWidth * 9) / 16;

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.card, { width: cellWidth, height: cellHeight }]}
      pressedScale={0.97}
    >
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <DurationBadge duration={duration} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1C1C1C',
  },
  image: {
    flex: 1,
  },
});

// Memoize — the card only needs to re-render when its own props change.
export default memo(LibraryCard);
