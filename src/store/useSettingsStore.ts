import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createFileStorage } from './fileStorage';

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
      storage: createJSONStorage(() => createFileStorage()),
    },
  ),
);
