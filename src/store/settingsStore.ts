import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StreamQuality } from '@/api/blac/api';
import { persistStorage } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  themeMode: ThemeMode;
  /** Keep playing when the app is backgrounded or the screen locks. */
  backgroundPlayback: boolean;
  /** iOS: keep playing when the ringer switch is on silent. */
  playInSilentMode: boolean;
  /** Vibration feedback on taps, playback changes and errors. */
  hapticsEnabled: boolean;
  /** Notifications switched off inside Blac (the phone's own permission is separate). */
  pushOptOut: boolean;
  setPushOptOut: (value: boolean) => void;
  /** Lower the volume gradually before the sleep timer stops playback. */
  sleepFadeOut: boolean;
  /** Music streaming quality: low data (48 kbps), standard (128) or high (256). */
  streamQuality: StreamQuality;
  setStreamQuality: (value: StreamQuality) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setBackgroundPlayback: (value: boolean) => void;
  setPlayInSilentMode: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setSleepFadeOut: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      backgroundPlayback: true,
      playInSilentMode: true,
      hapticsEnabled: true,
      pushOptOut: false,
      setPushOptOut: (pushOptOut) => set({ pushOptOut }),
      sleepFadeOut: true,
      streamQuality: 'medium',
      setStreamQuality: (streamQuality) => set({ streamQuality }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setBackgroundPlayback: (backgroundPlayback) => set({ backgroundPlayback }),
      setPlayInSilentMode: (playInSilentMode) => set({ playInSilentMode }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setSleepFadeOut: (sleepFadeOut) => set({ sleepFadeOut }),
    }),
    { name: 'blac-settings', storage: persistStorage },
  ),
);
