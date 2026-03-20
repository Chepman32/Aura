import RNFS from 'react-native-fs';

const TEMP_PREFIX = 'aura_';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Returns the system temporary directory path (no trailing slash).
 */
export function getTempDir(): string {
  return RNFS.TemporaryDirectoryPath.replace(/\/$/, '');
}

/**
 * Generates a unique output file path inside the temp directory.
 *
 * @param extension - File extension without a leading dot, e.g. "mp4" or "jpg".
 */
export function getOutputPath(extension: string): string {
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `${getTempDir()}/${TEMP_PREFIX}${timestamp}_${random}.${ext}`;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Deletes a single file if it exists.
 * Silently ignores errors (e.g. if the file was already removed).
 */
export async function cleanup(path: string): Promise<void> {
  try {
    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }
  } catch {
    // Intentionally swallowed — cleanup is best-effort.
  }
}

/**
 * Removes all files in the temp directory whose names start with "aura_".
 * Silently skips any file that cannot be deleted.
 */
export async function cleanupTempFiles(): Promise<void> {
  try {
    const tempDir = getTempDir();
    const items = await RNFS.readDir(tempDir);

    await Promise.allSettled(
      items
        .filter(
          (item) =>
            item.isFile() && item.name.startsWith(TEMP_PREFIX),
        )
        .map((item) => RNFS.unlink(item.path)),
    );
  } catch {
    // Intentionally swallowed — cleanup is best-effort.
  }
}
