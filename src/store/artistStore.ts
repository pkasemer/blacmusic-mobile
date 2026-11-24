import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Artist, VerificationStatus } from '@/domain/types';
import { persistStorage } from './storage';

interface ArtistState {
  /** The signed-in user's artist profile, or `null` if they have not become an artist. Saved on the device until accounts exist. */
  profile: Artist | null;
  setProfile: (profile: Artist) => void;
  setVerification: (status: VerificationStatus) => void;
  clear: () => void;
}

export const useArtistStore = create<ArtistState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile) => set({ profile }),
      setVerification: (verification) =>
        set((s) => (s.profile ? { profile: { ...s.profile, verification } } : s)),
      clear: () => set({ profile: null }),
    }),
    { name: 'blac-artist', storage: persistStorage },
  ),
);

/** True once the user has an artist profile; the Studio tab is only shown then. */
export const useIsArtist = () => useArtistStore((s) => s.profile !== null);
