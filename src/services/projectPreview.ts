import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { getFilterById, IDENTITY_MATRIX } from '../filters';

const PREVIEW_DIR = `${RNFS.DocumentDirectoryPath}/project-previews`;

interface NativePreviewModule {
  generatePreview: (
    projectId: string,
    sourceUri: string,
    filterId: string,
    filterMatrixPayload: string,
    filterIntensity: number,
    timeMs: number,
  ) => Promise<string>;
}

interface GenerateProjectPreviewParams {
  projectId: string;
  sourceVideoUri: string;
  filterId: string;
  filterIntensity: number;
  timeMs: number;
}

const nativePreviewModule: NativePreviewModule | undefined =
  NativeModules.AuraProjectPreview;

function normalizeFileUri(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

function ensureFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export function isGeneratedProjectPreview(uri: string | null | undefined): boolean {
  if (!uri) {
    return false;
  }

  return normalizeFileUri(uri).startsWith(PREVIEW_DIR);
}

export async function cleanupProjectPreview(
  uri: string | null | undefined,
): Promise<void> {
  if (!isGeneratedProjectPreview(uri)) {
    return;
  }

  try {
    const path = normalizeFileUri(uri!);
    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }
  } catch {
    // Best-effort cleanup.
  }
}

export async function generateProjectPreview({
  projectId,
  sourceVideoUri,
  filterId,
  filterIntensity,
  timeMs,
}: GenerateProjectPreviewParams): Promise<string> {
  if (Platform.OS !== 'ios' || !nativePreviewModule?.generatePreview) {
    return sourceVideoUri;
  }

  const filterMatrixPayload = (
    getFilterById(filterId)?.colorMatrix ?? IDENTITY_MATRIX
  ).join(',');

  try {
    const previewPath = await nativePreviewModule.generatePreview(
      projectId,
      sourceVideoUri,
      filterId,
      filterMatrixPayload,
      filterIntensity,
      timeMs,
    );

    return ensureFileUri(previewPath);
  } catch {
    return sourceVideoUri;
  }
}

