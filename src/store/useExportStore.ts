import { create } from 'zustand';

interface ExportState {
  progress: number;
  isExporting: boolean;
  isComplete: boolean;
  error: string | null;
}

interface ExportActions {
  setProgress: (progress: number) => void;
  startExport: () => void;
  completeExport: () => void;
  setError: (error: string) => void;
  cancelExport: () => void;
  reset: () => void;
}

const INITIAL_STATE: ExportState = {
  progress: 0,
  isExporting: false,
  isComplete: false,
  error: null,
};

export const useExportStore = create<ExportState & ExportActions>((set) => ({
  ...INITIAL_STATE,

  setProgress: (progress) => set({ progress }),

  startExport: () =>
    set({
      isExporting: true,
      isComplete: false,
      progress: 0,
      error: null,
    }),

  completeExport: () =>
    set({
      isExporting: false,
      isComplete: true,
      progress: 1,
    }),

  setError: (error) =>
    set({
      isExporting: false,
      error,
    }),

  cancelExport: () =>
    set({
      isExporting: false,
      isComplete: false,
      progress: 0,
      error: null,
    }),

  reset: () => set(INITIAL_STATE),
}));
