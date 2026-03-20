import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../app/navigation/types';
import { useLibraryStore } from '../store/useLibraryStore';
import { requestMediaLibrary } from '../services/permissions';
import type { PermissionStatus } from '../services/permissions';
import BlurHeader, { HEADER_CONTENT_HEIGHT } from '../components/home/BlurHeader';
import LibraryGrid from '../components/home/LibraryGrid';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import AnimatedPressable from '../components/shared/AnimatedPressable';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Home screen — the video library.
 *
 * State machine:
 *   'idle'    → permission check hasn't run yet (very first render)
 *   'loading' → permission granted, first page of videos being fetched
 *   'ready'   → videos loaded (list may be empty)
 *   'denied'  → user dismissed the permission prompt
 *   'blocked' → permission is permanently denied; must go to Settings
 */
type ScreenState = 'idle' | 'loading' | 'ready' | 'denied' | 'blocked';

export default function HomeScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [screenState, setScreenState] = useState<ScreenState>('idle');

  const { videos, isLoading, hasNextPage, endCursor, fetchVideos, reset } =
    useLibraryStore();

  // Guard against double-invoke in StrictMode / fast-refresh.
  const didMount = useRef(false);

  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bootstrap(): Promise<void> {
    const status: PermissionStatus = await requestMediaLibrary();

    if (status === 'granted') {
      reset(); // clear any stale data from a previous session
      setScreenState('loading');
      await fetchVideos(); // first page — no cursor
      setScreenState('ready');
    } else if (status === 'blocked') {
      setScreenState('blocked');
    } else {
      setScreenState('denied');
    }
  }

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasNextPage && endCursor) {
      void fetchVideos(endCursor);
    }
  }, [isLoading, hasNextPage, endCursor, fetchVideos]);

  const handleVideoPress = useCallback(
    (videoUri: string) => {
      navigation.navigate('Editor', { videoUri });
    },
    [navigation],
  );

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  // ─── Render helpers ────────────────────────────────────────────────────────

  function renderContent(): React.JSX.Element {
    const headerHeight = insets.top + HEADER_CONTENT_HEIGHT;

    // First-load skeleton
    if (screenState === 'loading') {
      return (
        <View
          style={[
            styles.centeredContent,
            { paddingTop: headerHeight + spacing.sm },
          ]}
        >
          <SkeletonLoader count={9} columns={3} />
        </View>
      );
    }

    // Permission blocked — must open Settings to grant access
    if (screenState === 'blocked') {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>No Access</Text>
          <Text style={styles.stateBody}>
            Aura needs permission to read your video library. Enable it in
            Settings.
          </Text>
          <AnimatedPressable
            onPress={handleOpenSettings}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
          >
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Permission denied (can ask again)
    if (screenState === 'denied') {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Permission Required</Text>
          <Text style={styles.stateBody}>
            Allow Aura to access your videos to build your library.
          </Text>
          <AnimatedPressable
            onPress={() => {
              didMount.current = false;
              void bootstrap();
            }}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Grant Access"
          >
            <Text style={styles.primaryButtonText}>Grant Access</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Ready but empty
    if (screenState === 'ready' && videos.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>No Videos Found</Text>
          <Text style={styles.stateBody}>
            Record some videos and they will appear here automatically.
          </Text>
        </View>
      );
    }

    // Normal grid
    return (
      <LibraryGrid
        videos={videos}
        isLoading={isLoading}
        hasNextPage={hasNextPage}
        onLoadMore={handleLoadMore}
        onVideoPress={handleVideoPress}
      />
    );
  }

  return (
    <View style={styles.root}>
      {renderContent()}
      {/* BlurHeader is rendered last so it paints on top of everything */}
      <BlurHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centeredContent: {
    flex: 1,
  },
  // ── Empty / error state ───────────────────────────────────────────────────
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stateBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  // ── CTA button ────────────────────────────────────────────────────────────
  primaryButton: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
});
