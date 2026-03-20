import { getOutputPath } from './fileSystem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProgressCallback = (progress: number) => void;

// ---------------------------------------------------------------------------
// Module-level state for cancellation
// ---------------------------------------------------------------------------

let cancelled = false;
let activeTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Runs a video export applying a 3D LUT.
 *
 * TODO: Integrate FFmpegKit when a working native binary is available.
 * Currently simulates export progress for UI development.
 *
 * When a real FFmpeg backend is connected:
 * - Full intensity: `-vf "lut3d='${lutPath}'"` with libx264 -preset medium -crf 18 -c:a copy
 * - Partial intensity: filter_complex with split/lut3d/blend
 * - Progress: parse time from FFmpegKit statistics callback
 */
export async function executeExport(
  inputUri: string,
  lutPath: string,
  intensity: number,
  onProgress?: ProgressCallback,
): Promise<string> {
  const outputPath = getOutputPath('mp4');
  cancelled = false;

  return new Promise<string>((resolve, reject) => {
    let progress = 0;

    activeTimer = setInterval(() => {
      if (cancelled) {
        if (activeTimer) clearInterval(activeTimer);
        activeTimer = null;
        reject(new Error('Export cancelled.'));
        return;
      }

      progress += 0.02 + Math.random() * 0.03;
      if (progress >= 1) {
        progress = 1;
        if (activeTimer) clearInterval(activeTimer);
        activeTimer = null;
        onProgress?.(1);
        // In production, this would return the actual rendered file path.
        // For now, return the input URI as the "exported" result.
        resolve(inputUri);
        return;
      }

      onProgress?.(progress);
    }, 100);
  });
}

/**
 * Cancels the currently running export, if any.
 */
export async function cancelExport(): Promise<void> {
  cancelled = true;
  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Command / filter graph builders (ready for FFmpegKit integration)
// ---------------------------------------------------------------------------

/**
 * Builds the FFmpeg command string.
 * Preserved for when FFmpegKit native binary becomes available.
 */
export function buildCommand(
  inputUri: string,
  lutPath: string,
  intensity: number,
  outputPath: string,
): string {
  const escapedLut = lutPath.replace(/'/g, "'\\''");
  const clampedIntensity = Math.min(1, Math.max(0, intensity));

  let vfArg: string;

  if (clampedIntensity >= 1.0) {
    vfArg = `-vf "lut3d='${escapedLut}'"`;
  } else if (clampedIntensity <= 0.0) {
    vfArg = '-vf "null"';
  } else {
    const expr = `A*${clampedIntensity.toFixed(4)}+B*${(1 - clampedIntensity).toFixed(4)}`;
    vfArg = [
      `-filter_complex`,
      `"[0:v]split=2[original][forLut];`,
      `[forLut]lut3d='${escapedLut}'[graded];`,
      `[original][graded]blend=all_expr='${expr}'[out]"`,
      `-map "[out]"`,
    ].join(' ');
  }

  return [
    `-i "${inputUri}"`,
    vfArg,
    '-c:v libx264',
    '-preset medium',
    '-crf 18',
    '-c:a copy',
    '-movflags +faststart',
    `"${outputPath}"`,
  ].join(' ');
}
