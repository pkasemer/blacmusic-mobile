import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

export type RecentKind = 'track' | 'album' | 'playlist' | 'artist';

/** Something the person opened from the search results, kept so it is one tap away next time. */
export interface RecentOpen {
  /** `kind:id`, so the same thing appears once. */
  key: string;
  kind: RecentKind;
  id: string;
  title: string;
  /** The line under the title (the artist, who made the playlist, how many songs). */
  subtitle: string;
  imageUrl: string | null;
  verified?: boolean;
  /** "Song", "Album", "EP", "Single", "Playlist" or "Artist". */
  tag: string;
  at: number;
}

const MAX_ITEMS = 6;

interface RecentSearchState {
  /** Newest first. */
  items: RecentOpen[];
  record: (item: Omit<RecentOpen, 'key' | 'at'>) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export const useRecentSearchStore = create<RecentSearchState>()(
  persist(
    (set) => ({
      items: [],
      record: (item) =>
        set((state) => {
          const key = `${item.kind}:${item.id}`;
          return { items: [{ ...item, key, at: Date.now() }, ...state.items.filter((i) => i.key !== key)].slice(0, MAX_ITEMS) };
        }),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'blac-recent-search-v1',
      storage: persistStorage,
      // A phone that saved more before keeps only the newest.
      merge: (saved, current) => {
        const items = (saved as Partial<RecentSearchState> | undefined)?.items ?? current.items;
        return { ...current, items: items.slice(0, MAX_ITEMS) };
      },
    },
  ),
);
