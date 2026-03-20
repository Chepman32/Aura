/**
 * Clamps a value between a minimum and maximum bound (inclusive).
 *
 * @param value - The number to clamp.
 * @param min   - The lower bound.
 * @param max   - The upper bound.
 * @returns The clamped value: min if value < min, max if value > max, otherwise value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
