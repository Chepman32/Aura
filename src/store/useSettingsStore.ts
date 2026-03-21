import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createFileStorage } from './fileStorage';
import { DEFAULT_THEME_ID, type AppThemeId } from '../theme/palettes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsState {
  defaultIntensity: number;
  themeId: AppThemeId;
}

interface SettingsActions {
  setDefaultIntensity: (intensity: number) => void;
  setThemeId: (themeId: AppThemeId) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // State
      defaultIntensity: 1.0,
      themeId: DEFAULT_THEME_ID,

      // Actions
      setDefaultIntensity: (intensity) =>
        set({ defaultIntensity: intensity }),
      setThemeId: (themeId) => set({ themeId }),
    }),
    {
      name: 'aura-settings',
      version: 2,
      storage: createJSONStorage(() => createFileStorage()),
      partialize: (state) => ({
        defaultIntensity: state.defaultIntensity,
        themeId: state.themeId,
      }),
      migrate: (persistedState) => {
        const state = (persistedState as Partial<SettingsState> | undefined) ?? {};

        return {
          defaultIntensity: state.defaultIntensity ?? 1.0,
          themeId: state.themeId ?? DEFAULT_THEME_ID,
        };
      },
    },
  ),
);
