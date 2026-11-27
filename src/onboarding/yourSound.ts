import { useEffect } from 'react';
import { AppState } from 'react-native';
import { blacApi } from '@/api/blac';
import { ApiError, apiRequest } from '@/api/blac/http';
import { onboardingApi } from '@/api/blac/onboarding';
import { refreshPlaylistQueries } from '@/api/blac/playlistCache';
import { shuffled } from '@/audio/music/queue';
import type { Track } from '@/domain/types';
import { useAuthStore } from '@/store/authStore';
import { useListeningStore } from '@/store/listeningStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useYourSoundStore } from '@/store/yourSoundStore';
import { starterTracks } from './starter';
import { onboardingApiConfig } from './useConfig';
import {
  favouriteArtists,
  planUpdate,
  UPDATE_EVERY_MS,
  YOUR_SOUND_DESCRIPTION,
  YOUR_SOUND_NAME,
  YOUR_SOUND_SIZE,
} from './yourSoundRules';

/**
 * "Your sound": a private playlist in the listener's own account, so it is always in their Library. A server that
 * keeps it itself says so (`GET /v1/me/your-sound`); until then the app makes it and, about once a day, adds songs
 * chosen from what is really listened to, falling back on the onboarding picks.
 */

/** The server's own "Your sound", or `null` while it has none. */
async function serverPlaylistId(): Promise<string | null> {
  try {
    return (await apiRequest<{ playlistId: string }>('/v1/me/your-sound')).playlistId;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) return null;
    throw error;
  }
}

/** Songs to offer: popular ones by the artists enjoyed most and picked, then of the picked genres. */
async function candidates(): Promise<Track[]> {
  const local = useOnboardingStore.getState();
  // The account's saved picks (so a new phone has them too), else the ones made on this phone.
  const saved = await onboardingApi.getSaved().catch(() => null);
  const picks = {
    artistIds: saved?.artistIds?.length ? saved.artistIds : local.artists.map((a) => a.id),
    genres: saved?.genres?.length ? saved.genres : local.genres,
  };
  const artists = [...new Set([...favouriteArtists(useListeningStore.getState().tastes, 6), ...picks.artistIds])].slice(0, 8);
  const catalogue = picks.genres.length > 0 ? (await onboardingApiConfig()).genres : [];
  const lists = await Promise.allSettled([
    ...artists.map((id) => blacApi.getArtistPopularTracks(id)),
    ...picks.genres.slice(0, 4).map((id) => blacApi.getTracksByGenre(catalogue.find((g) => g.id === id)?.label ?? id)),
  ]);
  const found = starterTracks(lists.map((l) => (l.status === 'fulfilled' ? l.value : [])), YOUR_SOUND_SIZE, shuffled);
  return found.length > 0 ? found : blacApi.getTrending();
}

/** The listener's own "Your sound", if the account has one already (after signing in again, or on a new phone). */
async function findExisting(userId: string): Promise<string | null> {
  const mine = await blacApi.getMyPlaylists();
  return mine.find((p) => p.name === YOUR_SOUND_NAME && p.description === YOUR_SOUND_DESCRIPTION && (!p.ownerId || p.ownerId === userId))?.id ?? null;
}

async function addAll(playlistId: string, trackIds: string[]): Promise<string[]> {
  const done: string[] = [];
  // One at a time, so they keep their order. One that cannot be added is left out.
  for (const id of trackIds) {
    try {
      await blacApi.addToPlaylist(playlistId, id);
      done.push(id);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 0) break;
    }
  }
  return done;
}

async function run(userId: string, first: Track[]) {
  const store = useYourSoundStore.getState;
  const same = () => useAuthStore.getState().user?.id === userId;
  store().switchTo(userId);
  const hadOne = store().playlistId !== null;

  const kept = await serverPlaylistId();
  if (!same()) return;
  if (kept) {
    store().update({ playlistId: kept, added: [] });
    refreshPlaylistQueries(kept);
    return;
  }

  let id = store().playlistId ?? (await findExisting(userId));
  let detail = id ? await blacApi.getPlaylist(id) : null;
  if (!same()) return;
  if (!detail) {
    // None yet, or it was deleted: make it.
    // The very first one holds the songs just shown; one made again later is chosen afresh.
    const songs = !hadOne && first.length > 0 ? first : await candidates();
    if (songs.length === 0 || !same()) return;
    store().update({ saving: true });
    id = (await blacApi.createPlaylist({ name: YOUR_SOUND_NAME, description: YOUR_SOUND_DESCRIPTION })).id;
    store().update({ playlistId: id, added: [] });
    const added = await addAll(id, songs.map((t) => t.id));
    // With nothing in it, the next check fills it.
    if (same()) store().update({ added, updatedAt: added.length > 0 ? Date.now() : 0 });
    refreshPlaylistQueries(id);
    return;
  }

  const playlistId = detail.playlist.id;
  store().update({ playlistId });
  const items = detail.tracks.map((t, i) => ({ trackId: t.id, itemId: detail!.itemIds[i] }));
  if (items.length > 0 && Date.now() - store().updatedAt < UPDATE_EVERY_MS) return;
  const offered = (await candidates()).map((t) => t.id);
  if (!same()) return;
  const plan = planUpdate(items, new Set(store().added), offered, useListeningStore.getState().tastes);
  const added = await addAll(playlistId, plan.add);
  for (const item of plan.remove) await blacApi.removeFromPlaylist(playlistId, item.itemId).catch(() => {});
  if (!same()) return;
  const gone = new Set(plan.remove.map((r) => r.trackId));
  store().update({ added: [...store().added.filter((t) => !gone.has(t)), ...added], updatedAt: Date.now() });
  if (added.length > 0 || plan.remove.length > 0) refreshPlaylistQueries(playlistId);
}

let running: Promise<void> | null = null;

/** Makes "Your sound" if the account has none, and brings it up to date when due. Failures are tried again later. */
export function keepYourSound(first: Track[] = []): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return Promise.resolve();
  running ??= run(userId, first)
    .catch(() => {})
    .finally(() => {
      useYourSoundStore.getState().update({ saving: false });
      running = null;
    });
  return running;
}

/** Mount once in the root layout: checks when the app opens and each time it comes back to the front. */
export function useYourSound(active: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  // Only accounts that have finished onboarding have one.
  const ready = useOnboardingStore((s) => s.status === 'done' && s.ownerId === userId);
  useEffect(() => {
    if (!active || !ready) return;
    const check = () => void keepYourSound(useOnboardingStore.getState().starter);
    check();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => appState.remove();
  }, [active, ready]);
}
