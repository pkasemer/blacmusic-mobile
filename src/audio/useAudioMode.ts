import { useEffect } from 'react';
import { setAudioModeAsync } from 'expo-audio';
import { useSettingsStore } from '@/store/settingsStore';

/** Keeps the native audio session in sync with the Playback settings. */
export function useAudioMode() {
  const backgroundPlayback = useSettingsStore((s) => s.backgroundPlayback);
  const playInSilentMode = useSettingsStore((s) => s.playInSilentMode);

  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: backgroundPlayback,
      playsInSilentMode: playInSilentMode,
      // Required for lock-screen controls to attach.
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, [backgroundPlayback, playInSilentMode]);
}
