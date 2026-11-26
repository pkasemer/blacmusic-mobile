import { useEffect } from 'react';
import { AppState } from 'react-native';
import { setApiErrorListener } from '@/api/blac/http';
import { youtubeKeys } from '@/api/blac/youtubeQueries';
import { queryClient } from '@/api/queryClient';
import { useArtistStore } from '@/store/artistStore';
import { useAuthStore } from '@/store/authStore';
import { showToast } from '@/store/toastStore';
import { useUploadStore } from '@/store/uploadStore';
import { artistSignal } from './artistRules';
import { refreshArtist } from './refreshArtist';

/** While files are going up, how often to make sure the artist is still allowed to send them. */
const WHILE_UPLOADING_MS = 30_000;

const checkIfArtist = () => {
  if (useArtistStore.getState().profile) void refreshArtist();
};

/**
 * Mount once in the root layout. Keeps up with changes the Blac team makes to the artist profile: suspended or let
 * back in, given to this account or taken away. It looks when a call is refused, when the app comes back to the front,
 * and while uploads are running (their files go straight to storage, so no call to Blac would reveal a suspension).
 */
export function useArtistWatch(active: boolean) {
  const uploading = useUploadStore((s) => Object.values(s.jobs).some((j) => j.state === 'waiting' || j.state === 'uploading'));

  useEffect(() => {
    if (!active) return;
    setApiErrorListener((error, path) => {
      const signal = artistSignal(error.code, path);
      if (signal === null) return;
      if (signal === 'suspended') useArtistStore.getState().markSuspended();
      checkIfArtist();
    });
    // Asked even without a profile: the team may have given this account one meanwhile.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshArtist();
    });
    const unsubscribe = useArtistStore.subscribe((state, previous) => {
      if (state.profile?.id === previous.profile?.id) return;
      // Signing out clears the profile too: that is handled with the rest of the sign out.
      if (!useAuthStore.getState().refreshToken) return;
      if (previous.profile) {
        // The Studio's saved numbers and lists belonged to the artist that is gone.
        queryClient.removeQueries({ queryKey: ['studio'] });
        void queryClient.invalidateQueries({ queryKey: youtubeKeys.transfers });
        if (!state.profile) showToast('Your account no longer has an artist profile');
      }
      void queryClient.invalidateQueries({ queryKey: ['music'] });
    });
    return () => {
      setApiErrorListener(null);
      appState.remove();
      unsubscribe();
    };
  }, [active]);

  useEffect(() => {
    if (!active || !uploading) return;
    const timer = setInterval(checkIfArtist, WHILE_UPLOADING_MS);
    return () => clearInterval(timer);
  }, [active, uploading]);
}
