import { getOutputPath } from './fileSystem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThumbnailResult {
  path: string;
  timeMs: number;
}

// ---------------------------------------------------------------------------
// Thumbnail extraction
// ---------------------------------------------------------------------------

/**
 * Extracts a single frame from a video at the given time.
 *
 * TODO: Integrate FFmpegKit when a working native binary is available.
 * Currently returns a placeholder path for UI development.
 */
export async function extractThumbnail(
  videoUri: string,
  timeMs: number,
): Promise<string> {
  // In production, this would run:
  // FFmpegKit.execute(`-ss ${timeMs/1000} -i "${videoUri}" -frames:v 1 -q:v 2 "${outputPath}"`)
  const outputPath = getOutputPath('jpg');
  return outputPath;
}

/**
 * Extracts evenly-spaced frames from a video for timeline display.
 *
 * TODO: Integrate FFmpegKit for actual frame extraction.
 * Currently returns placeholder paths.
 */
export async function extractTimelineFrames(
  videoUri: string,
  count: number,
  durationMs: number,
): Promise<ThumbnailResult[]> {
  const results: ThumbnailResult[] = [];
  const interval = durationMs / count;

  for (let i = 0; i < count; i++) {
    const timeMs = interval * i + interval / 2;
    const path = getOutputPath('jpg');
    results.push({ path, timeMs });
  }

  return results;
}
