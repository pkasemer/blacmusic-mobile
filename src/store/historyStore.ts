import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCurrentItem } from './musicStore';
import { persistStorage } from './storage';

export interface HistoryEntry {
  /** Song or episode id. */
  itemId: string;
  /** Epoch milliseconds of the most recent play. */
  playedAt: number;
}

const MAX_ENTRIES = 30;

interface HistoryState {
  /** Newest first, one entry per song or episode. */
  entries: HistoryEntry[];
  record: (itemId: string) => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      record: (itemId) =>
        set((state) => ({
          entries: [{ itemId, playedAt: Date.now() }, ...state.entries.filter((e) => e.itemId !== itemId)].slice(
            0,
            MAX_ENTRIES,
          ),
        })),
      clear: () => set({ entries: [] }),
    }),
    // New key each time old entries must not carry over: v1 held radio stations, and the first Blac
    // history also recorded Studio previews of unpublished tracks.
    { name: 'blac-listening-history-v2', storage: persistStorage },
  ),
);

/** Mount once in the root layout: adds each song or episode to the history when it becomes the current one (not Studio previews). */
export function useRecordListeningHistory() {
  const item = useCurrentItem();
  // An artist checking their own unpublished track is not a listen.
  const id = item && !(item.kind === 'track' && item.preview) ? item.id : null;
  const record = useHistoryStore((s) => s.record);
  useEffect(() => {
    if (id) record(id);
  }, [id, record]);
}
