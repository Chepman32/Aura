import React, { memo } from 'react';
import {
  Image,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import DurationBadge from './DurationBadge';
import type { ColumnCount } from '../../hooks/usePinchToResize';
import {
  spacing,
  typography,
  useThemedStyles,
  type AppTheme,
} from '../../theme';

interface ProjectCardProps {
  previewUri: string;
  name: string;
  duration: number;
  columns: ColumnCount;
}

function ProjectCard({
  previewUri,
  name,
  duration,
  columns,
}: ProjectCardProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { width: screenWidth } = useWindowDimensions();
  const totalGap = spacing.sm * (columns - 1);
  const totalHorizontalPadding = spacing.md * 2;
  const cellWidth = (screenWidth - totalHorizontalPadding - totalGap) / columns;
  const cellHeight = (cellWidth * 9) / 16;

  return (
    <View style={[styles.card, { width: cellWidth }]}>
      <View style={[styles.previewFrame, { height: cellHeight }]}>
        <Image
          source={{ uri: previewUri }}
          style={styles.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <DurationBadge duration={duration} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const colors = theme.colors;

  return {
    card: {
      gap: spacing.xs + 2,
    },
    previewFrame: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surfaceLight,
    },
    image: {
      flex: 1,
    },
    title: {
      ...typography.captionMedium,
      color: colors.textPrimary,
      minHeight: 32,
      paddingRight: spacing.xs,
    },
  };
};

export default memo(ProjectCard);
