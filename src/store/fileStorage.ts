import RNFS from 'react-native-fs';
import type { StateStorage } from 'zustand/middleware';

const DEFAULT_STORAGE_DIR = 'aura-storage';

function getStorageDir(rootDirName: string): string {
  return `${RNFS.DocumentDirectoryPath}/${rootDirName}`;
}

function getFilePath(rootDirName: string, key: string): string {
  return `${getStorageDir(rootDirName)}/${encodeURIComponent(key)}.json`;
}

export function createFileStorage(
  rootDirName: string = DEFAULT_STORAGE_DIR,
): StateStorage {
  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const path = getFilePath(rootDirName, key);
        const exists = await RNFS.exists(path);
        if (!exists) {
          return null;
        }

        return await RNFS.readFile(path, 'utf8');
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        const storageDir = getStorageDir(rootDirName);
        const dirExists = await RNFS.exists(storageDir);
        if (!dirExists) {
          await RNFS.mkdir(storageDir);
        }

        await RNFS.writeFile(getFilePath(rootDirName, key), value, 'utf8');
      } catch {
        // Best-effort persistence.
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        const path = getFilePath(rootDirName, key);
        const exists = await RNFS.exists(path);
        if (exists) {
          await RNFS.unlink(path);
        }
      } catch {
        // Best-effort cleanup.
      }
    },
  };
}

