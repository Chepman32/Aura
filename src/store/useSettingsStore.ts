import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createFileStorage } from './fileStorage';
import { DEFAULT_THEME_ID, type AppThemeId } from '../theme/palettes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormatId = 'mp4' | 'hevc';

interface SettingsState {
  themeId: AppThemeId;
  exportFormat: ExportFormatId;
}

interface SettingsActions {
  setThemeId: (themeId: AppThemeId) => void;
  setExportFormat: (exportFormat: ExportFormatId) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // State
      themeId: DEFAULT_THEME_ID,
      exportFormat: 'mp4',

      // Actions
      setThemeId: (themeId) => set({ themeId }),
      setExportFormat: (exportFormat) => set({ exportFormat }),
    }),
    {
      name: 'aura-settings',
      version: 3,
      storage: createJSONStorage(() => createFileStorage()),
      partialize: (state) => ({
        themeId: state.themeId,
        exportFormat: state.exportFormat,
      }),
      migrate: (persistedState) => {
        const state = (persistedState as Partial<SettingsState> | undefined) ?? {};

        return {
          themeId: state.themeId ?? DEFAULT_THEME_ID,
          exportFormat: state.exportFormat ?? 'mp4',
        };
      },
    },
  ),
);
