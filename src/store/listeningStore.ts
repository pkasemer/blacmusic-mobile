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
  /** Autoplay chose the song, from `autoplaySeedId`. Sent as a flag so an older server still keeps the listen. */
  autoplay?: boolean;
  autoplaySeedId?: string;
  endReason?: string;
  positionSec?: number;
  /** How the app measured: absent for the first way, whose skips include false ones. */
  capture?: number;
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
  /** The listen under way, as it should be sent if the app goes away before it ends. */
  draft: ListeningEvent | null;
  tastes: Record<string, Taste>;
  setDraft: (draft: ListeningEvent | null) => void;
  add: (event: ListeningEvent) => void;
  sent: (ids: string[]) => void;
  taste: (trackId: string, change: (taste: Taste) => Taste) => void;
  reset: () => void;
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set) => ({
      pending: [],
      draft: null,
      tastes: {},
      setDraft: (draft) => set({ draft }),
      // One event per id; recording a listen puts its draft away.
      add: (event) =>
        set((s) => ({
          pending: [...s.pending.filter((e) => e.id !== event.id), event].slice(-MAX_PENDING),
          draft: s.draft?.id === event.id ? null : s.draft,
        })),
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
      reset: () => set({ pending: [], draft: null, tastes: {} }),
    }),
    { name: 'blac-listening-signals-v1', storage: persistStorage },
  ),
);
