import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import type { VideoItem } from '../../store/useLibraryStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import type { PermissionStatus } from '../../services/permissions';
import { requestMediaLibrary } from '../../services/permissions';
import LibraryGrid from './LibraryGrid';
import AnimatedPressable from '../shared/AnimatedPressable';
import SkeletonLoader from '../shared/SkeletonLoader';
import {
  spacing,
  typography,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from '../../theme';

type PickerState = 'idle' | 'loading' | 'ready' | 'denied' | 'blocked';

interface VideoPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectVideo: (video: VideoItem) => void;
}

export default function VideoPickerModal({
  visible,
  onClose,
  onSelectVideo,
}: VideoPickerModalProps): React.JSX.Element {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const [pickerState, setPickerState] = useState<PickerState>('idle');
  const didBootstrap = useRef(false);

  const { videos, isLoading, hasNextPage, endCursor, fetchVideos, reset } =
    useLibraryStore();

  const bootstrap = useCallback(async (): Promise<void> => {
    const status: PermissionStatus = await requestMediaLibrary();

    if (status === 'granted') {
      reset();
      setPickerState('loading');
      await fetchVideos();
      setPickerState('ready');
      return;
    }

    setPickerState(status === 'blocked' ? 'blocked' : 'denied');
  }, [fetchVideos, reset]);

  useEffect(() => {
    if (!visible) {
      didBootstrap.current = false;
      setPickerState('idle');
      reset();
      return;
    }

    if (didBootstrap.current) {
      return;
    }

    didBootstrap.current = true;
    bootstrap().catch(() => {
      setPickerState('denied');
    });
  }, [bootstrap, reset, visible]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasNextPage && endCursor) {
      fetchVideos(endCursor).catch(() => {
        setPickerState('denied');
      });
    }
  }, [endCursor, fetchVideos, hasNextPage, isLoading]);

  function renderContent(): React.JSX.Element {
    if (pickerState === 'loading') {
      return (
        <View style={styles.skeletonContainer}>
          <SkeletonLoader count={9} columns={3} />
        </View>
      );
    }

    if (pickerState === 'blocked') {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>No Photo Access</Text>
          <Text style={styles.stateBody}>
            Enable photo library access in Settings to create a project from a video.
          </Text>
          <AnimatedPressable
            onPress={() => {
              Linking.openSettings().catch(() => {});
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </AnimatedPressable>
        </View>
      );
    }

    if (pickerState === 'denied') {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Permission Required</Text>
          <Text style={styles.stateBody}>
            Aura needs access to your videos before it can create a project.
          </Text>
          <AnimatedPressable
            onPress={() => {
              didBootstrap.current = false;
              bootstrap().catch(() => {
                setPickerState('denied');
              });
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Grant Access</Text>
          </AnimatedPressable>
        </View>
      );
    }

    if (pickerState === 'ready' && videos.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>No Videos Found</Text>
          <Text style={styles.stateBody}>
            Record or import videos into Photos, then try again.
          </Text>
        </View>
      );
    }

    return (
      <LibraryGrid
        videos={videos}
        isLoading={isLoading}
        hasNextPage={hasNextPage}
        onLoadMore={handleLoadMore}
        onVideoPress={(uri) => {
          const selected = videos.find((video) => video.uri === uri);
          if (selected) {
            onSelectVideo(selected);
          }
        }}
        topInset={0}
        bottomInset={insets.bottom + spacing.lg}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.title}>New Project</Text>
          <AnimatedPressable onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.textPrimary} />
          </AnimatedPressable>
        </View>
        <View style={styles.content}>{renderContent()}</View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => {
  const colors = theme.colors;

  return {
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceLight,
    },
    content: {
      flex: 1,
    },
    skeletonContainer: {
      flex: 1,
      paddingTop: spacing.md,
    },
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
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    primaryButtonText: {
      ...typography.bodyMedium,
      color: colors.accentForeground,
    },
  };
};
