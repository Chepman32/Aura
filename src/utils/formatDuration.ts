/**
 * Formats a duration in seconds to "M:SS" string format.
 *
 * @param seconds - Duration in seconds (non-negative). Fractional values are floored.
 * @returns Formatted string, e.g. 0 -> "0:00", 65 -> "1:05", 3661 -> "61:01"
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0');
  return `${minutes}:${paddedSeconds}`;
}
