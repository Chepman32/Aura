import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AnimatedPressable from '../shared/AnimatedPressable';
import {
  spacing,
  typography,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from '../../theme';
import type { RootStackParamList } from '../../app/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/** Height of the visible header content (below the status bar). */
export const HEADER_CONTENT_HEIGHT = 56;

/**
 * A translucent blur header that stays pinned to the top of the screen.
 * Extends into the safe-area inset so it sits flush with the status bar.
 *
 * - Left: "Projects" title in large bold type.
 * - Right: Settings gear icon that navigates to the Settings screen.
 */
export default function BlurHeader(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const colors = theme.colors;

  const totalHeight = insets.top + HEADER_CONTENT_HEIGHT;

  return (
    <View style={[styles.wrapper, { height: totalHeight }]} pointerEvents="box-none">
      {Platform.OS === 'ios' ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={theme.blurType}
          blurAmount={20}
          reducedTransparencyFallbackColor={colors.background}
        />
      ) : (
        // Android: BlurView support varies by device; use a semi-opaque fill.
        <View style={[StyleSheet.absoluteFill, styles.androidFallback]} />
      )}

      {/* Content row sits below the status-bar safe area */}
      <View style={[styles.contentRow, { marginTop: insets.top }]}>
        <Text style={styles.title}>Projects</Text>

        <AnimatedPressable
          onPress={() => navigation.navigate('Settings')}
          style={styles.iconButton}
          pressedScale={0.88}
          accessibilityLabel="Open Settings"
          accessibilityRole="button"
        >
          <Settings
            size={22}
            color={colors.textPrimary}
            strokeWidth={1.8}
          />
        </AnimatedPressable>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const colors = theme.colors;

  return {
    wrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      overflow: 'hidden',
    },
    androidFallback: {
      backgroundColor: colors.overlay,
    },
    contentRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
    },
    title: {
      ...typography.title,
      color: colors.textPrimary,
    },
    iconButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
};
