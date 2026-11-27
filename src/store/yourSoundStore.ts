import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

interface Saved {
  /** Whose playlist this is. */
  ownerId: string | null;
  playlistId: string | null;
  /** The songs the app put in it: only these are ever taken out again. */
  added: string[];
  /** Epoch ms of the last update. */
  updatedAt: number;
}

interface YourSoundState extends Saved {
  /** Other accounts that used this phone, so each gets its own back on signing in again. */
  others: Record<string, Saved>;
  /** Saving for the first time right now. */
  saving: boolean;
  update: (patch: Partial<Saved & { saving: boolean }>) => void;
  /** Makes the record of `userId` the current one. */
  switchTo: (userId: string) => void;
}

const empty = (ownerId: string | null): Saved => ({ ownerId, playlistId: null, added: [], updatedAt: 0 });

export const useYourSoundStore = create<YourSoundState>()(
  persist(
    (set) => ({
      ...empty(null),
      others: {},
      saving: false,
      update: (patch) => set(patch),
      switchTo: (userId) =>
        set((s) => {
          if (s.ownerId === userId) return s;
          const others = { ...s.others };
          if (s.ownerId) others[s.ownerId] = { ownerId: s.ownerId, playlistId: s.playlistId, added: s.added, updatedAt: s.updatedAt };
          const mine = others[userId] ?? empty(userId);
          delete others[userId];
          return { ...mine, others };
        }),
    }),
    {
      name: 'blac-your-sound-v1',
      storage: persistStorage,
      partialize: ({ ownerId, playlistId, added, updatedAt, others }) => ({ ownerId, playlistId, added, updatedAt, others }),
    },
  ),
);
