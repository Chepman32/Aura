import {
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';

import { getOutputPath } from './fileSystem';

export type ProgressCallback = (progress: number) => void;

interface NativeVideoExportModule {
  exportVideo: (
    sourceUri: string,
    filterId: string,
    filterMatrixPayload: string,
    filterIntensity: number,
  ) => Promise<string>;
  cancelExport: () => Promise<void>;
}

const EXPORT_PROGRESS_EVENT = 'AuraVideoExporterProgress';

const nativeExporter: NativeVideoExportModule | undefined =
  NativeModules.AuraVideoExporter;

let exporterEmitter: NativeEventEmitter | null = null;
let fallbackCancelled = false;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

export async function executeExport(
  inputUri: string,
  filterId: string,
  filterMatrix: ReadonlyArray<number>,
  intensity: number,
  onProgress?: ProgressCallback,
): Promise<string> {
  if (Platform.OS === 'ios' && nativeExporter?.exportVideo) {
    return executeNativeExport(
      inputUri,
      filterId,
      filterMatrix,
      intensity,
      onProgress,
    );
  }

  return simulateExport(inputUri, onProgress);
}

export async function cancelExport(): Promise<void> {
  if (Platform.OS === 'ios' && nativeExporter?.cancelExport) {
    await nativeExporter.cancelExport();
    return;
  }

  fallbackCancelled = true;
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
}

async function executeNativeExport(
  inputUri: string,
  filterId: string,
  filterMatrix: ReadonlyArray<number>,
  intensity: number,
  onProgress?: ProgressCallback,
): Promise<string> {
  const emitter = getExporterEmitter();
  const subscription = emitter?.addListener(
    EXPORT_PROGRESS_EVENT,
    (event: { progress?: number } | undefined) => {
      if (typeof event?.progress !== 'number') {
        return;
      }

      onProgress?.(clampProgress(event.progress));
    },
  );

  try {
    const outputPath = await nativeExporter!.exportVideo(
      inputUri,
      filterId,
      filterMatrix.join(','),
      intensity,
    );

    onProgress?.(1);
    return normalizeOutputPath(outputPath);
  } finally {
    subscription?.remove();
  }
}

function getExporterEmitter(): NativeEventEmitter | null {
  if (!nativeExporter) {
    return null;
  }

  if (!exporterEmitter) {
    exporterEmitter = new NativeEventEmitter(
      nativeExporter as never,
    );
  }

  return exporterEmitter;
}

function simulateExport(
  inputUri: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const outputPath = getOutputPath('mp4');
  fallbackCancelled = false;

  return new Promise<string>((resolve, reject) => {
    let progress = 0;

    fallbackTimer = setInterval(() => {
      if (fallbackCancelled) {
        if (fallbackTimer) {
          clearInterval(fallbackTimer);
        }
        fallbackTimer = null;
        reject(new Error('Export cancelled.'));
        return;
      }

      progress += 0.02 + Math.random() * 0.03;
      if (progress >= 1) {
        progress = 1;
        if (fallbackTimer) {
          clearInterval(fallbackTimer);
        }
        fallbackTimer = null;
        onProgress?.(1);
        resolve(normalizeOutputPath(inputUri || outputPath));
        return;
      }

      onProgress?.(progress);
    }, 100);
  });
}

function normalizeOutputPath(path: string): string {
  return path.replace(/^file:\/\//, '');
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress));
}
