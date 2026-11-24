import { create } from 'zustand';
import type { Playable } from '@/domain/types';
import type { RepeatMode } from '@/audio/music/queue';
import type { PlaybackSource } from '@/audio/music/source';

/**
 * State of the on-demand player (music and podcast episodes). The native player lives in
 * `audio/music/musicEngine.ts`; this store mirrors what the UI needs. Playback position is NOT kept
 * here (it changes every half second); the seek bar reads it straight from the player.
 */
interface MusicState {
  /** Play order, including items already played. Already shuffled when `shuffle` is on. */
  queue: Playable[];
  /** The order before shuffling, used when shuffle is switched off. */
  originalQueue: Playable[];
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** True while music owns the audio (as opposed to radio). Drives which mini player shows. */
  active: boolean;
  playing: boolean;
  buffering: boolean;
  /** Where this queue came from (a playlist, an album, search results…). `null` when unknown. */
  source: PlaybackSource | null;
  /** Now-playing screen open. */
  isFullOpen: boolean;
  set: (patch: Partial<Omit<MusicState, 'set'>>) => void;
  reset: () => void;
}

const EMPTY = {
  queue: [] as Playable[],
  originalQueue: [] as Playable[],
  index: 0,
  active: false,
  playing: false,
  buffering: false,
  isFullOpen: false,
  source: null as PlaybackSource | null,
};

export const useMusicStore = create<MusicState>()((set) => ({
  ...EMPTY,
  shuffle: false,
  repeat: 'off',
  set: (patch) => set(patch),
  reset: () => set(EMPTY),
}));

/** The item that is playing now, or `null`. */
export const useCurrentItem = (): Playable | null =>
  useMusicStore((s) => (s.active ? (s.queue[s.index] ?? null) : null));
