import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { USES_BACKEND } from '@/api/blac';
import { fetchShowcase, type ShowcaseItem } from '@/api/blac/showcase';
import { persistStorage } from './storage';

/**
 * The artists and covers the Blac team picked to show before sign-in. The last answer is kept on the phone, so
 * the next launch shows it at once while a fresh one loads.
 */
interface ShowcaseState {
  items: ShowcaseItem[];
  fetchedAt: number;
  refresh: () => Promise<void>;
}

const MAX_AGE_MS = 60 * 60 * 1000;

export const useShowcaseStore = create<ShowcaseState>()(
  persist(
    (set, get) => ({
      items: [],
      fetchedAt: 0,
      refresh: async () => {
        if (!USES_BACKEND || Date.now() - get().fetchedAt < MAX_AGE_MS) return;
        try {
          const items = await fetchShowcase();
          set({ items, fetchedAt: Date.now() });
        } catch {
          // Offline or the server is down: keep what is saved.
        }
      },
    }),
    { name: 'blac-showcase', storage: persistStorage },
  ),
);

/** The showcase items (possibly none), refreshed in the background when the screen opens. */
export function useShowcase(): ShowcaseItem[] {
  const items = useShowcaseStore((s) => s.items);
  const refresh = useShowcaseStore((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return items;
}
