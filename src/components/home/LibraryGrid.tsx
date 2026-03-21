import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { usePinchToResize } from '../../hooks/usePinchToResize';
import type { ColumnCount } from '../../hooks/usePinchToResize';
import { useHaptics } from '../../hooks/useHaptics';
import LibraryCard from './LibraryCard';
import SkeletonLoader from '../shared/SkeletonLoader';
import type { VideoItem } from '../../store/useLibraryStore';
import { colors, spacing } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LibraryGridProps {
  videos: VideoItem[];
  isLoading: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onVideoPress: (uri: string) => void;
  topInset?: number;
  bottomInset?: number;
}

/**
 * Renders the video library as a responsive pinch-to-resize grid.
 *
 * Key design decisions:
 *
 * 1. FlatList does not support changing `numColumns` at runtime. The standard
 *    workaround is to pass a `key` prop that changes whenever `numColumns`
 *    changes, forcing a full unmount/remount. This is intentional and safe
 *    here because the data set is small enough that the cost is imperceptible.
 *
 * 2. `columns` is a Reanimated SharedValue (lives on the UI thread). We bridge
 *    it to React state with `useAnimatedReaction` + `runOnJS` so FlatList —
 *    a JS-thread component — can react to pinch changes.
 *
 * 3. A haptic tick fires each time the column count changes, giving tactile
 *    confirmation of the layout step without any extra bookkeeping.
 */
export default function LibraryGrid({
  videos,
  isLoading,
  hasNextPage,
  onLoadMore,
  onVideoPress,
  topInset = 0,
  bottomInset,
}: LibraryGridProps): React.JSX.Element {
  const { columns, pinchGesture } = usePinchToResize();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();

  // JS-thread mirror of the UI-thread SharedValue.
  const [columnCount, setColumnCount] = useState<ColumnCount>(
    columns.value as ColumnCount,
  );

  const handleColumnChange = useCallback(
    (next: ColumnCount) => {
      setColumnCount(next);
      haptics.light();
    },
    [haptics],
  );

  // Bridge SharedValue → JS state. Fires whenever columns.value changes on
  // the UI thread, then calls handleColumnChange on the JS thread.
  useAnimatedReaction(
    () => columns.value,
    (next, prev) => {
      if (next !== prev) {
        runOnJS(handleColumnChange)(next);
      }
    },
    [handleColumnChange],
  );

  const renderItem = useCallback(
    ({ item }: { item: VideoItem }) => (
      <LibraryCard
        uri={item.uri}
        duration={item.duration}
        filename={item.filename}
        columns={columnCount}
        onPress={() => onVideoPress(item.uri)}
      />
    ),
    [columnCount, onVideoPress],
  );

  const keyExtractor = useCallback((item: VideoItem) => item.uri, []);

  const handleEndReached = useCallback(() => {
    if (!isLoading && hasNextPage) {
      onLoadMore();
    }
  }, [isLoading, hasNextPage, onLoadMore]);

  const ListFooter = useCallback(() => {
    if (!isLoading || videos.length === 0) return null;
    // Show a smaller skeleton row while paginating.
    return (
      <View style={styles.footer}>
        <SkeletonLoader count={columnCount} columns={columnCount} />
      </View>
    );
  }, [isLoading, videos.length, columnCount]);

  return (
    <GestureDetector gesture={pinchGesture}>
      {/*
       * The key forces FlatList to remount when columnCount changes.
       * This is the only correct way to change numColumns on FlatList.
       */}
      <FlatList
        key={`grid-${columnCount}`}
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={columnCount}
        columnWrapperStyle={columnCount > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: topInset },
          { paddingBottom: bottomInset ?? insets.bottom + spacing.md },
        ]}
        ItemSeparatorComponent={() => <View style={styles.rowGap} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        // Improves scroll performance for image-heavy grids.
        removeClippedSubviews
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={30}
        windowSize={7}
        initialNumToRender={9}
      />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  columnWrapper: {
    gap: 1,
  },
  rowGap: {
    height: 1,
  },
  listContent: {
    backgroundColor: colors.background,
  },
  footer: {
    marginTop: 1,
  },
});
