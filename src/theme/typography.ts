import { Platform } from 'react-native';
import { colors } from './colors';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const systemFontMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

const systemFontSemibold = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

const systemFontBold = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const typography = {
  title: {
    fontFamily: systemFontBold,
    fontSize: 28,
    fontWeight: Platform.select<'700' | 'bold'>({ ios: '700', android: 'bold', default: '700' }),
    lineHeight: 34,
    letterSpacing: 0.36,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: systemFontSemibold,
    fontSize: 20,
    fontWeight: Platform.select<'600'>({ ios: '600', android: '600', default: '600' }),
    lineHeight: 25,
    letterSpacing: 0.38,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: Platform.select<'400'>({ ios: '400', android: '400', default: '400' }),
    lineHeight: 22,
    letterSpacing: -0.41,
    color: colors.textPrimary,
  },
  bodyMedium: {
    fontFamily: systemFontMedium,
    fontSize: 17,
    fontWeight: Platform.select<'500'>({ ios: '500', android: '500', default: '500' }),
    lineHeight: 22,
    letterSpacing: -0.41,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: Platform.select<'400'>({ ios: '400', android: '400', default: '400' }),
    lineHeight: 16,
    letterSpacing: 0,
    color: colors.textSecondary,
  },
  captionMedium: {
    fontFamily: systemFontMedium,
    fontSize: 12,
    fontWeight: Platform.select<'500'>({ ios: '500', android: '500', default: '500' }),
    lineHeight: 16,
    letterSpacing: 0,
    color: colors.textSecondary,
  },
  badge: {
    fontFamily: systemFontBold,
    fontSize: 11,
    fontWeight: Platform.select<'700'>({ ios: '700', android: '700', default: '700' }),
    lineHeight: 13,
    letterSpacing: 0.06,
    color: colors.textPrimary,
  },
} as const;

export type TypographyKey = keyof typeof typography;
