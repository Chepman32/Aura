import { create } from 'zustand';

interface EditorState {
  currentVideoUri: string | null;
  activeFilterId: string;
  filterIntensity: number;
  currentTime: number;
  isMuted: boolean;
  isPlaying: boolean;
  duration: number;
  requestedSeekTime: number;
  seekRequestId: number;
}

interface EditorActions {
  setVideoUri: (uri: string | null) => void;
  setActiveFilter: (filterId: string) => void;
  setFilterIntensity: (intensity: number) => void;
  setCurrentTime: (time: number) => void;
  setMuted: (muted: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  requestSeek: (time: number) => void;
  reset: () => void;
}

const INITIAL_STATE: EditorState = {
  currentVideoUri: null,
  activeFilterId: 'original',
  filterIntensity: 1.0,
  currentTime: 0,
  isMuted: false,
  isPlaying: false,
  duration: 0,
  requestedSeekTime: 0,
  seekRequestId: 0,
};

export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  ...INITIAL_STATE,

  setVideoUri: (uri) => set({ currentVideoUri: uri }),
  setActiveFilter: (filterId) => set({ activeFilterId: filterId }),
  setFilterIntensity: (intensity) => set({ filterIntensity: intensity }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setMuted: (muted) => set({ isMuted: muted }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setDuration: (duration) => set({ duration }),
  requestSeek: (time) =>
    set((state) => ({
      currentTime: time,
      requestedSeekTime: time,
      seekRequestId: state.seekRequestId + 1,
    })),
  reset: () => set(INITIAL_STATE),
}));
