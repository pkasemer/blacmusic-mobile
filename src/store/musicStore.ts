import { create } from 'zustand';
import type { Playable, Track } from '@/domain/types';
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
  /** The order before shuffling, used when shuffle is switched off. Songs added to the queue are not in it. */
  originalQueue: Playable[];
  /** Songs added with "Add to queue" that have not had their turn yet. These are the entries in `queue` themselves. */
  waiting: ReadonlySet<Playable>;
  /** Songs autoplay added when the queue ran out, each with the song its batch was chosen from. */
  autoplay: ReadonlyMap<Playable, Track>;
  /** Autoplay is looking for songs to carry on with. */
  findingMore: boolean;
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
  waiting: new Set<Playable>() as ReadonlySet<Playable>,
  autoplay: new Map<Playable, Track>() as ReadonlyMap<Playable, Track>,
  findingMore: false,
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
