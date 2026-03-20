/**
 * Spacing scale based on a 4px base grid.
 * All spacing values are multiples of 4 for visual consistency.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type SpacingKey = keyof typeof spacing;
