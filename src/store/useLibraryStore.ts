import { create } from 'zustand';
import { getVideos } from '../services/mediaLibrary';

export interface VideoItem {
  uri: string;
  duration: number;
  filename: string;
}

interface LibraryState {
  videos: VideoItem[];
  isLoading: boolean;
  endCursor: string | null;
  hasNextPage: boolean;
}

interface LibraryActions {
  setVideos: (videos: VideoItem[]) => void;
  appendVideos: (videos: VideoItem[]) => void;
  setLoading: (loading: boolean) => void;
  setCursor: (cursor: string | null, hasNextPage: boolean) => void;
  reset: () => void;
  fetchVideos: (cursor?: string) => Promise<void>;
}

const INITIAL_STATE: LibraryState = {
  videos: [],
  isLoading: false,
  endCursor: null,
  hasNextPage: true,
};

export const useLibraryStore = create<LibraryState & LibraryActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    setVideos: (videos) => set({ videos }),
    appendVideos: (videos) =>
      set((state) => ({ videos: [...state.videos, ...videos] })),
    setLoading: (loading) => set({ isLoading: loading }),
    setCursor: (cursor, hasNextPage) =>
      set({ endCursor: cursor, hasNextPage }),
    reset: () => set(INITIAL_STATE),

    fetchVideos: async (cursor?: string) => {
      const { isLoading, hasNextPage } = get();

      // Guard: skip if already loading or no more pages on a paginated fetch
      if (isLoading) return;
      if (cursor !== undefined && !hasNextPage) return;

      set({ isLoading: true });

      try {
        const result = await getVideos(cursor);

        if (cursor === undefined) {
          // Fresh load — replace the entire list
          set({ videos: result.videos });
        } else {
          // Paginated append
          set((state) => ({
            videos: [...state.videos, ...result.videos],
          }));
        }

        set({
          endCursor: result.endCursor,
          hasNextPage: result.hasNextPage,
        });
      } finally {
        set({ isLoading: false });
      }
    },
  }),
);
