import { useEffect } from 'react';
import { authApi, blacApi, USES_BACKEND } from '@/api/blac';
import { queryClient } from '@/api/queryClient';
import { stopMusic } from '@/audio/music/musicEngine';
import { removeAllDownloads } from '@/offline/downloads';
import { tracker } from '@/stats/signals';
import { useArtistStore } from '@/store/artistStore';
import { useListeningStore } from '@/store/listeningStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { bringBackPersonalData, putAwayPersonalData } from '@/auth/personalData';
import { tokenToRemove } from '@/notifications/push';
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

/**
 * Forgets everything tied to the account on this device: artist profile, cached lists, offline copies, and (set aside
 * for that account) likes, history, recent searches and where they stopped listening.
 */
function forgetAccount(userId: string | undefined) {
  // Stop first, so nothing writes a position or a history entry after they have been put away.
  stopMusic();
  putAwayPersonalData(userId);
  removeAllDownloads();
  useArtistStore.getState().clear();
  useOnboardingStore.getState().reset();
  // What this person listened to must not be sent as the next one's.
  tracker.finish(Date.now());
  useListeningStore.getState().reset();
  queryClient.clear();
}

/**
 * Signs out at once: the app forgets the tokens first (so the Get started screen appears immediately, even with no
 * network), then tells the server in the background to stop notifications to this phone and end the session.
 * `useSessionSync` clears the rest from this device.
 */
export function signOut() {
  const { accessToken, accessExpiresAt, refreshToken, clear } = useAuthStore.getState();
  clear();
  if (refreshToken) void authApi.endSession({ accessToken, accessExpiresAt, refreshToken }, tokenToRemove);
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
      if (previous.refreshToken && !state.refreshToken) forgetAccount(previous.user?.id);
      else if (!previous.refreshToken && state.refreshToken && state.user) void bringBackPersonalData(state.user.id);
    });
  }, []);
}
