import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

/** The song that was playing last and how far into it, so Home can offer to carry on from there. */
interface ResumeState {
  itemId: string | null;
  /** Seconds into the song. */
  positionSec: number;
  durationSec: number;
  save: (itemId: string, positionSec: number, durationSec: number) => void;
  clear: () => void;
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set) => ({
      itemId: null,
      positionSec: 0,
      durationSec: 0,
      save: (itemId, positionSec, durationSec) => set({ itemId, positionSec, durationSec }),
      clear: () => set({ itemId: null, positionSec: 0, durationSec: 0 }),
    }),
    { name: 'blac-resume-v1', storage: persistStorage },
  ),
);
