import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import RNFS from 'react-native-fs';

// ---------------------------------------------------------------------------
// Simple file-based StateStorage adapter
// ---------------------------------------------------------------------------

const STORAGE_DIR = `${RNFS.DocumentDirectoryPath}/aura-storage`;
const getFilePath = (key: string) => `${STORAGE_DIR}/${encodeURIComponent(key)}.json`;

const fileStorage: StateStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const path = getFilePath(key);
      const exists = await RNFS.exists(path);
      if (!exists) return null;
      return await RNFS.readFile(path, 'utf8');
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const dirExists = await RNFS.exists(STORAGE_DIR);
      if (!dirExists) {
        await RNFS.mkdir(STORAGE_DIR);
      }
      await RNFS.writeFile(getFilePath(key), value, 'utf8');
    } catch {
      // Best-effort persistence
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const path = getFilePath(key);
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
      }
    } catch {
      // Best-effort
    }
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomPreset {
  id: string;
  name: string;
  filterId: string;
  intensity: number;
}

interface SettingsState {
  defaultIntensity: number;
  customPresets: CustomPreset[];
}

interface SettingsActions {
  setDefaultIntensity: (intensity: number) => void;
  addPreset: (preset: CustomPreset) => void;
  removePreset: (id: string) => void;
  updatePreset: (id: string, changes: Partial<Omit<CustomPreset, 'id'>>) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // State
      defaultIntensity: 1.0,
      customPresets: [],

      // Actions
      setDefaultIntensity: (intensity) =>
        set({ defaultIntensity: intensity }),

      addPreset: (preset) =>
        set((state) => ({
          customPresets: [...state.customPresets, preset],
        })),

      removePreset: (id) =>
        set((state) => ({
          customPresets: state.customPresets.filter((p) => p.id !== id),
        })),

      updatePreset: (id, changes) =>
        set((state) => ({
          customPresets: state.customPresets.map((p) =>
            p.id === id ? { ...p, ...changes } : p,
          ),
        })),
    }),
    {
      name: 'aura-settings',
      storage: createJSONStorage(() => fileStorage),
    },
  ),
);
