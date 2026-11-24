import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DownloadItem, Playable } from '@/domain/types';
import { persistStorage } from './storage';

interface DownloadState {
  /** Offline copies by item id. Only the records are saved here; the audio files are in the app's private storage. */
  items: Record<string, DownloadItem>;
  upsert: (item: DownloadItem) => void;
  patch: (id: string, patch: Partial<DownloadItem>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set) => ({
      items: {},
      upsert: (item) => set((s) => ({ items: { ...s.items, [item.id]: item } })),
      patch: (id, patch) =>
        set((s) => (s.items[id] ? { items: { ...s.items, [id]: { ...s.items[id], ...patch } } } : s)),
      remove: (id) =>
        set((s) => {
          const { [id]: _removed, ...rest } = s.items;
          return { items: rest };
        }),
      clear: () => set({ items: {} }),
    }),
    { name: 'blac-downloads', storage: persistStorage },
  ),
);

/** Offline file for an item, if it is fully downloaded and its licence has not run out. */
export function localUriFor(item: Playable): string | null {
  const entry = useDownloadStore.getState().items[item.id];
  if (!entry || entry.state !== 'done' || !entry.localUri) return null;
  if (entry.expiresAt !== null && entry.expiresAt < Date.now()) return null;
  return entry.localUri;
}

/** Download record for one item (re-renders only when this item changes). */
export const useDownload = (id: string): DownloadItem | undefined => useDownloadStore((s) => s.items[id]);
