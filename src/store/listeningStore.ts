import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

/** One thing the listener did, waiting to be sent to the server. */
export interface ListeningEvent {
  /** Made on the phone, so a batch sent twice can be recognised. */
  id: string;
  type: 'listen' | 'like' | 'unlike' | 'playlist_add' | 'session_start' | 'session_end';
  /** ISO time it happened. */
  at: string;
  sessionId?: string;
  trackId?: string;
  playlistId?: string;
  listenedSec?: number;
  durationSec?: number;
  completion?: number;
  outcome?: 'completed' | 'skipped' | 'stopped';
  replay?: boolean;
  source?: string;
}

/** What the phone remembers about a song, to keep "Your sound" close to what is really enjoyed. */
export interface Taste {
  artistId?: string;
  completed: number;
  skipped: number;
  replays: number;
  liked: boolean;
  at: number;
}

/** The newest events kept while they cannot be sent. */
export const MAX_PENDING = 1000;
const MAX_TASTES = 300;

interface ListeningState {
  pending: ListeningEvent[];
  tastes: Record<string, Taste>;
  add: (event: ListeningEvent) => void;
  sent: (ids: string[]) => void;
  taste: (trackId: string, change: (taste: Taste) => Taste) => void;
  reset: () => void;
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set) => ({
      pending: [],
      tastes: {},
      add: (event) => set((s) => ({ pending: [...s.pending, event].slice(-MAX_PENDING) })),
      sent: (ids) => {
        const gone = new Set(ids);
        set((s) => ({ pending: s.pending.filter((e) => !gone.has(e.id)) }));
      },
      taste: (trackId, change) =>
        set((s) => {
          const before = s.tastes[trackId] ?? { completed: 0, skipped: 0, replays: 0, liked: false, at: 0 };
          const tastes = { ...s.tastes, [trackId]: { ...change(before), at: Date.now() } };
          const keys = Object.keys(tastes);
          if (keys.length > MAX_TASTES) keys.sort((a, b) => tastes[a].at - tastes[b].at).slice(0, keys.length - MAX_TASTES).forEach((k) => delete tastes[k]);
          return { tastes };
        }),
      reset: () => set({ pending: [], tastes: {} }),
    }),
    { name: 'blac-listening-signals-v1', storage: persistStorage },
  ),
);
