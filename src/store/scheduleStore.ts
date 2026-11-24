import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

/**
 * The go-live time an artist chose for a release that is still a draft (epoch ms). A release can only be
 * scheduled once every file has finished processing, so the choice is kept here until then. No entry means
 * "publish by hand", which is the default.
 */
interface ScheduleState {
  byRelease: Record<string, number>;
  /** `null` clears the choice (publish by hand). */
  set: (releaseId: string, at: number | null) => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set) => ({
      byRelease: {},
      set: (releaseId, at) =>
        set((state) => {
          const next = { ...state.byRelease };
          if (at === null) delete next[releaseId];
          else next[releaseId] = at;
          return { byRelease: next };
        }),
    }),
    { name: 'blac-release-schedule', storage: persistStorage },
  ),
);
