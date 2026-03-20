import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '../../theme';
import { formatDuration } from '../../utils/formatDuration';

interface DurationBadgeProps {
  /** Duration in seconds. */
  duration: number;
}

/**
 * Translucent pill overlaid at the bottom-right of a video thumbnail.
 * Shows formatted duration in "M:SS" format.
 * The parent must have `position: 'relative'` (default for Views) and
 * overflow handling if needed.
 */
export default function DurationBadge({
  duration,
}: DurationBadgeProps): React.JSX.Element {
  return (
    <View style={styles.badge} pointerEvents="none">
      <Text style={styles.text} numberOfLines={1}>
        {formatDuration(duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    ...typography.badge,
    color: '#FFFFFF',
  },
});
