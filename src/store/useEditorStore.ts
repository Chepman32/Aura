import { create } from 'zustand';

interface EditorState {
  currentVideoUri: string | null;
  activeFilterId: string;
  filterIntensity: number;
  currentTime: number;
  isPlaying: boolean;
  duration: number;
}

interface EditorActions {
  setVideoUri: (uri: string | null) => void;
  setActiveFilter: (filterId: string) => void;
  setFilterIntensity: (intensity: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  reset: () => void;
}

const INITIAL_STATE: EditorState = {
  currentVideoUri: null,
  activeFilterId: 'original',
  filterIntensity: 1.0,
  currentTime: 0,
  isPlaying: false,
  duration: 0,
};

export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  ...INITIAL_STATE,

  setVideoUri: (uri) => set({ currentVideoUri: uri }),
  setActiveFilter: (filterId) => set({ activeFilterId: filterId }),
  setFilterIntensity: (intensity) => set({ filterIntensity: intensity }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setDuration: (duration) => set({ duration }),
  reset: () => set(INITIAL_STATE),
}));
