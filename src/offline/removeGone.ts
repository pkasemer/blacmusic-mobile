import { useEffect } from 'react';
import { AppState } from 'react-native';
import { ApiError, apiRequest } from '@/api/blac/http';
import { queryClient } from '@/api/queryClient';
import { dropFromPlayer } from '@/audio/music/musicEngine';
import { useNetworkStore } from '@/network/network';
import { cancelDownload } from '@/offline/downloads';
import { useAuthStore } from '@/store/authStore';
import { useDownloadStore } from '@/store/downloadStore';
import { useMusicStore } from '@/store/musicStore';
import { useRecentSearchStore } from '@/store/recentSearchStore';
import { useResumeStore } from '@/store/resumeStore';
import { showToast } from '@/store/toastStore';
import { SAVED_PATH, savedKey, verdictFor, type Saved } from './goneRules';

/**
 * Takes off the phone what is no longer on Blac, such as the songs of a banned artist: downloaded files, recent
 * searches, the "Continue listening" spot and songs waiting in the player. Lists that only keep ids (likes, history)
 * need nothing: the server leaves those songs out when it is asked for them.
 */

const AT_ONCE = 4;
/** Coming back to the app checks again only after this long; coming back online always checks. */
const MIN_GAP_MS = 5 * 60 * 1000;
/** Gives the saved lists a moment to load (and, after sign in, to come back) before looking at them. */
const START_DELAY_MS = 3000;

let running = false;
let lastCompleted = 0;

/** Everything on the phone that the server should be asked about, each thing once. */
function savedThings(): Saved[] {
  const all = new Map<string, Saved>();
  const add = (s: Saved) => all.set(savedKey(s), s);
  for (const d of Object.values(useDownloadStore.getState().items)) if (d.item.kind === 'track') add({ kind: 'track', id: d.id });
  for (const r of useRecentSearchStore.getState().items) add({ kind: r.kind, id: r.id });
  // An artist previewing their own unpublished song is not public, so it is left out.
  for (const item of useMusicStore.getState().queue) if (item.kind === 'track' && !item.preview) add({ kind: 'track', id: item.id });
  const resume = useResumeStore.getState().itemId;
  if (resume) add({ kind: 'track', id: resume });
  return [...all.values()];
}

/** Removes everything saved about the things the server said are gone. */
function remove(gone: Saved[]) {
  const tracks = new Set(gone.filter((g) => g.kind === 'track').map((g) => g.id));
  const keys = new Set(gone.map(savedKey));

  // The player first, so nothing is playing from a file that is about to be deleted.
  if (dropFromPlayer(tracks) === 'stopped') showToast('That song is no longer on Blac');
  for (const id of tracks) if (useDownloadStore.getState().items[id]) cancelDownload(id);
  for (const r of useRecentSearchStore.getState().items) if (keys.has(r.key)) useRecentSearchStore.getState().remove(r.key);
  const resume = useResumeStore.getState().itemId;
  if (resume && tracks.has(resume)) useResumeStore.getState().clear();
  // Screens that are open may still be showing it.
  void queryClient.invalidateQueries({ queryKey: ['music'] });
}

/** Asks the server about everything saved on the phone and removes what it says is gone. */
export async function removeWhatIsGone(force = false) {
  if (running || (!force && Date.now() - lastCompleted < MIN_GAP_MS)) return;
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  running = true;
  try {
    const queue = savedThings();
    const gone: Saved[] = [];
    let stopped = false;
    const worker = async () => {
      for (let next = queue.shift(); next && !stopped; next = queue.shift()) {
        try {
          await apiRequest<unknown>(`${SAVED_PATH[next.kind]}${encodeURIComponent(next.id)}`);
        } catch (e) {
          const verdict = e instanceof ApiError ? verdictFor(e.status, e.code) : 'unknown';
          if (verdict === 'gone') gone.push(next);
          else if (verdict === 'unknown') stopped = true;
        }
      }
    };
    await Promise.all(Array.from({ length: AT_ONCE }, worker));
    // Someone else may have signed in while this ran: their private things are not ours to judge.
    if (useAuthStore.getState().user?.id !== userId) return;
    if (gone.length > 0) remove(gone);
    // A check cut short does not count, so the next chance tries again.
    if (!stopped) lastCompleted = Date.now();
  } finally {
    running = false;
  }
}

/** Mount once in the root layout: checks when the app opens, comes back to the front, or comes back online. */
export function useRemoveGone(active: boolean) {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!active || !userId) return;
    const timer = setTimeout(() => void removeWhatIsGone(true), START_DELAY_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void removeWhatIsGone();
    });
    const unsubscribe = useNetworkStore.subscribe((state, previous) => {
      if (previous.online === false && state.online === true) void removeWhatIsGone(true);
    });
    return () => {
      clearTimeout(timer);
      appState.remove();
      unsubscribe();
    };
  }, [active, userId]);
}
