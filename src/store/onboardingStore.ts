import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_DISCOVERY, toggleAll, toggleId, type DiscoveryMode, type LanguageUse } from '@/domain/onboarding';
import type { Track } from '@/domain/types';
import { persistStorage } from './storage';

/** The steps after the account is made. `profile` (choosing a name) is only for Apple and Google accounts. */
export const SETUP_STEPS = ['profile', 'languages', 'regions', 'genres', 'artists', 'done'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** A chosen artist, with enough to show it again without asking the server. */
export interface PickedArtist {
  id: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
}

interface Answers {
  /** `idle`: not going through onboarding (including everyone who had the app before it). */
  status: 'idle' | 'active' | 'done';
  step: SetupStep;
  preferred: string[];
  understood: string[];
  regions: string[];
  discoveryMode: DiscoveryMode;
  genres: string[];
  artists: PickedArtist[];
  /** "Start Listening" was tapped; it finishes as soon as there is an account. */
  finishing: boolean;
  /** Whose answers these are, once an account exists. */
  ownerId: string | null;
  /** The server does not have the finished answers yet. */
  unsent: boolean;
  /** Songs from the picks: the ready-made first playlist. */
  starter: Track[];
  /** Home is to present that playlist. */
  showStarter: boolean;
}

interface OnboardingState extends Answers {
  begin: () => void;
  /** Drops onboarding before there is an account (signing in to an existing one instead). */
  abandon: () => void;
  goTo: (step: SetupStep) => void;
  toggleLanguage: (use: LanguageUse, id: string) => void;
  toggleLanguages: (use: LanguageUse, ids: string[]) => void;
  toggleRegion: (id: string) => void;
  setDiscovery: (mode: DiscoveryMode) => void;
  toggleGenre: (id: string) => void;
  toggleArtist: (artist: PickedArtist) => void;
  update: (patch: Partial<Answers>) => void;
  reset: () => void;
}

const EMPTY: Answers = {
  status: 'idle',
  step: 'profile',
  preferred: [],
  understood: [],
  regions: [],
  discoveryMode: DEFAULT_DISCOVERY,
  genres: [],
  artists: [],
  finishing: false,
  ownerId: null,
  unsent: false,
  starter: [],
  showStarter: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...EMPTY,
      // Coming back to "Get Started" keeps what was chosen before.
      begin: () => set((s) => (s.status === 'active' ? s : { ...EMPTY, status: 'active' })),
      abandon: () => set(EMPTY),
      goTo: (step) => set({ step, finishing: false }),
      toggleLanguage: (use, id) => set((s) => ({ [use]: toggleId(s[use], id) })),
      toggleLanguages: (use, ids) => set((s) => ({ [use]: toggleAll(s[use], ids) })),
      toggleRegion: (id) => set((s) => ({ regions: toggleId(s.regions, id) })),
      setDiscovery: (discoveryMode) => set({ discoveryMode }),
      toggleGenre: (id) => set((s) => ({ genres: toggleId(s.genres, id) })),
      toggleArtist: (artist) =>
        set((s) => ({ artists: s.artists.some((a) => a.id === artist.id) ? s.artists.filter((a) => a.id !== artist.id) : [...s.artists, artist] })),
      update: (patch) => set(patch),
      reset: () => set(EMPTY),
    }),
    { name: 'blac-onboarding-v1', storage: persistStorage },
  ),
);
