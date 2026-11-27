import { useEffect } from 'react';
import { AppState } from 'react-native';
import { ApiError, apiRequest, type RequestOptions } from '@/api/blac/http';
import { personalDataSettled } from '@/auth/personalData';
import { useAuthStore } from '@/store/authStore';
import { useFavouritesStore } from '@/store/favouritesStore';
import { merged, settled, toSend } from './likesRules';

const PAGE = 200;
/** A server library beyond this is not read in full; likes then only travel from the phone to the server. */
const MOST_PAGES = 50;
const RETRY_EVERY_MS = 60_000;

const me = () => useAuthStore.getState().user?.id;

/** Sends one like or unlike. `refused`: the server never will take it. Throws when it is worth trying again. */
async function sendLike(id: string, liked: boolean, options: RequestOptions = {}): Promise<{ refused: boolean }> {
  try {
    await apiRequest<void>(`/v1/me/library/tracks/${encodeURIComponent(id)}`, { ...options, method: liked ? 'PUT' : 'DELETE' });
    return { refused: false };
  } catch (error) {
    // Not found: the song is gone, or is not public.
    if (error instanceof ApiError && (error.status === 400 || error.status === 404 || error.status === 422)) return { refused: true };
    throw error;
  }
}

async function push(userId: string) {
  for (const [id, liked] of toSend(useFavouritesStore.getState())) {
    if (me() !== userId) return;
    // Changed again while the others were being sent.
    if (useFavouritesStore.getState().pending[id] !== liked) continue;
    const { refused } = await sendLike(id, liked);
    if (me() !== userId) return;
    useFavouritesStore.setState((s) => settled(s, id, liked, refused));
  }
}

/** Every liked song the server has, newest first, or `null` when there are too many to be sure of having them all. */
async function serverLikes(): Promise<string[] | null> {
  const ids: string[] = [];
  for (let page = 0; page < MOST_PAGES; page++) {
    const data = await apiRequest<{ tracks: { id: string }[] }>('/v1/me/library/tracks', { query: { limit: PAGE, offset: page * PAGE } });
    ids.push(...data.tracks.map((t) => t.id));
    if (data.tracks.length < PAGE) return [...new Set(ids)];
  }
  return null;
}

let running: Promise<void> | null = null;
let again = false;

async function run(pull: boolean) {
  const userId = me();
  if (!userId) return;
  // Likes put aside at the last sign-out come back first.
  await personalDataSettled();
  await push(userId);
  if (!pull || me() !== userId) return;
  const server = await serverLikes();
  if (!server || me() !== userId) return;
  useFavouritesStore.setState((s) => merged(s, server));
  // Likes from before the app sent them go up now.
  await push(userId);
}

/** Sends what is waiting and, with `pull`, brings in what changed elsewhere. Failures are tried again later. */
export function syncLikes(pull = true): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = run(pull)
    .catch(() => {})
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        // Only sending: something was tapped while the last round was under way.
        if (Object.keys(useFavouritesStore.getState().pending).length > 0) void syncLikes(false);
      }
    });
  return running;
}

/**
 * Sends likes with the token of an account the app has already signed out of. Resolves the changes the server has dealt
 * with; stops at the first failure.
 */
export async function sendLikesWithToken(changes: [string, boolean][], accessToken: string): Promise<[string, boolean][]> {
  const done: [string, boolean][] = [];
  for (const [id, liked] of changes) {
    try {
      await sendLike(id, liked, { auth: false, headers: { Authorization: `Bearer ${accessToken}` } });
    } catch {
      break;
    }
    done.push([id, liked]);
  }
  return done;
}

/** Mount once in the root layout: keeps likes in step while someone is signed in. */
export function useLikesSync(active: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (!active || !userId) return;
    void syncLikes();
    // A tap on a heart goes up straight away.
    const unwatch = useFavouritesStore.subscribe((state, previous) => {
      if (state.pending !== previous.pending && Object.keys(state.pending).length > 0) void syncLikes(false);
    });
    const retry = setInterval(() => {
      if (Object.keys(useFavouritesStore.getState().pending).length > 0) void syncLikes(false);
    }, RETRY_EVERY_MS);
    const appState = AppState.addEventListener('change', (state) => void syncLikes(state === 'active'));
    return () => {
      unwatch();
      clearInterval(retry);
      appState.remove();
    };
  }, [active, userId]);
}
