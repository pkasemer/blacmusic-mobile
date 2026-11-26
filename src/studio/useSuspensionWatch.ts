import { useEffect } from 'react';
import { AppState } from 'react-native';
import { setApiErrorListener } from '@/api/blac/http';
import { useArtistStore } from '@/store/artistStore';
import { useUploadStore } from '@/store/uploadStore';
import { refreshArtist } from './suspension';
import { suspensionSignal } from './suspensionRules';

/** While files are going up, how often to make sure the artist is still allowed to send them. */
const WHILE_UPLOADING_MS = 30_000;

const checkIfArtist = () => {
  if (useArtistStore.getState().profile) void refreshArtist();
};

/**
 * Mount once in the root layout. Notices a suspension from any refused call, when the app comes back to the front,
 * and while uploads are running (their files go straight to storage, so no call to Blac would reveal it).
 */
export function useSuspensionWatch(active: boolean) {
  const uploading = useUploadStore((s) => Object.values(s.jobs).some((j) => j.state === 'waiting' || j.state === 'uploading'));

  useEffect(() => {
    if (!active) return;
    setApiErrorListener((error, path) => {
      const signal = suspensionSignal(error.code, path);
      if (signal === null) return;
      if (signal === 'suspended') useArtistStore.getState().markSuspended();
      checkIfArtist();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkIfArtist();
    });
    return () => {
      setApiErrorListener(null);
      appState.remove();
    };
  }, [active]);

  useEffect(() => {
    if (!active || !uploading) return;
    const timer = setInterval(checkIfArtist, WHILE_UPLOADING_MS);
    return () => clearInterval(timer);
  }, [active, uploading]);
}
