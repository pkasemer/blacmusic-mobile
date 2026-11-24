import { create } from 'zustand';

/** Preset sleep-timer lengths, in minutes. */
export const SLEEP_PRESETS = [15, 30, 45, 60, 90, 120] as const;

interface SleepState {
  /** When the timer fires (epoch ms), or `null` when no timer is running. Not persisted on purpose. */
  endsAt: number | null;
  /** The length it was started with, so the UI can highlight the chosen preset. */
  durationMin: number | null;
  start: (minutes: number) => void;
  cancel: () => void;
}

export const useSleepStore = create<SleepState>()((set) => ({
  endsAt: null,
  durationMin: null,
  start: (minutes) => set({ endsAt: Date.now() + minutes * 60_000, durationMin: minutes }),
  cancel: () => set({ endsAt: null, durationMin: null }),
}));
