import { useEffect } from 'react';
import { authApi, blacApi, USES_BACKEND } from '@/api/blac';
import { queryClient } from '@/api/queryClient';
import { stopMusic } from '@/audio/music/musicEngine';
import { removeAllDownloads } from '@/offline/downloads';
import { useArtistStore } from '@/store/artistStore';
import { unregisterPushToken } from '@/notifications/push';
import { useAuthStore } from '@/store/authStore';

/** Reads the account and artist profile from the server into the app. Safe to call any time while signed in. */
export async function syncAccount() {
  try {
    await authApi.refreshMe();
    const artist = await blacApi.getMyArtist();
    const store = useArtistStore.getState();
    if (artist) store.setProfile(artist);
    else store.clear();
  } catch {
    // Offline or the server is down: keep what is stored on the device.
  }
}

/** Forgets everything tied to the account on this device: tokens, artist profile, cached lists and offline copies. */
function forgetAccount() {
  stopMusic();
  removeAllDownloads();
  useArtistStore.getState().clear();
  queryClient.clear();
}

/** Signs out: clears the tokens and tells the server. `useSessionSync` then clears the rest from this device. */
export async function signOut() {
  // Stop notifications to this phone while the token still works (best effort).
  await unregisterPushToken().catch(() => {});
  await authApi.logout();
}

/**
 * Keeps the app in step with the sign-in state: loads the account when signed in, and cleans up when the
 * session ends (including when the server rejects an old refresh token).
 */
export function useSessionSync() {
  const signedIn = useAuthStore((s) => s.refreshToken !== null);

  useEffect(() => {
    if (!USES_BACKEND) return;
    if (signedIn) void syncAccount();
  }, [signedIn]);

  useEffect(() => {
    if (!USES_BACKEND) return;
    // Runs when the tokens disappear without the user pressing Sign out.
    return useAuthStore.subscribe((state, previous) => {
      if (previous.refreshToken && !state.refreshToken) forgetAccount();
    });
  }, []);
}
