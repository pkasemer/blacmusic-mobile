import { blacApi, USES_BACKEND } from '@/api/blac';
import { useArtistStore } from '@/store/artistStore';
import { useAuthStore } from '@/store/authStore';

let refreshing: Promise<void> | null = null;
/** Someone asked while a fetch was already on its way, so that answer may be older than what they saw. */
let askAgain = false;

/**
 * Fetches the artist profile again, which is how the app learns that it was suspended or let back in, or that the
 * team gave this account an artist or took it away. Safe to call at any time: calls made together share one fetch,
 * and a failed fetch keeps what is already known.
 */
export function refreshArtist(): Promise<void> {
  if (refreshing) {
    askAgain = true;
    return refreshing;
  }
  refreshing = (async () => {
    do {
      askAgain = false;
      const userId = useAuthStore.getState().user?.id;
      // The sample data has no server to ask.
      if (!USES_BACKEND || !userId) return;
      try {
        const artist = await blacApi.getMyArtist();
        // Someone else may have signed in meanwhile.
        if (useAuthStore.getState().user?.id !== userId) return;
        if (artist) useArtistStore.getState().setProfile(artist);
        else useArtistStore.getState().clear();
      } catch {
        // Offline or the server is down.
      }
    } while (askAgain);
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
