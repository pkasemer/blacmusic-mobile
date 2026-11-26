import { useEffect } from 'react';
import { blacApi } from '@/api/blac';
import { onboardingApi } from '@/api/blac/onboarding';
import { shuffled } from '@/audio/music/queue';
import { toPayload } from '@/domain/onboarding';
import type { Track } from '@/domain/types';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { onboardingApiConfig } from './useConfig';
import { starterTracks } from './starter';

/** How many songs the first listen holds, and how many picks it draws on. */
const STARTER_LENGTH = 25;
const ARTISTS_USED = 6;
const GENRES_USED = 4;

const answers = () => toPayload(useOnboardingStore.getState());

/** Saves the answers so far, when there is an account to save them to. Failure is silent: finishing sends them again. */
export function saveProgress() {
  if (!useAuthStore.getState().refreshToken) return;
  onboardingApi.save(answers()).catch(() => {});
}

/** Gives the server the finished answers. `true` once it has them. */
async function send(): Promise<boolean> {
  if (!(await onboardingApi.save(answers()))) return false;
  return onboardingApi.complete();
}

/**
 * Until the server can recommend, a first listen made from the picks: the popular songs of the chosen artists and
 * genres. Nothing is made up; with no picks, or nothing found, there is none.
 */
async function buildStarter(): Promise<Track[]> {
  const { artists, genres } = useOnboardingStore.getState();
  const catalogue = (await onboardingApiConfig()).genres;
  const lists = await Promise.allSettled([
    ...artists.slice(0, ARTISTS_USED).map((a) => blacApi.getArtistPopularTracks(a.id)),
    ...genres.slice(0, GENRES_USED).map((id) => blacApi.getTracksByGenre(catalogue.find((g) => g.id === id)?.label ?? id)),
  ]);
  return starterTracks(
    lists.map((l) => (l.status === 'fulfilled' ? l.value : [])),
    STARTER_LENGTH,
    shuffled,
  );
}

let finishing: Promise<void> | null = null;

/**
 * "Start Listening", once there is an account. Never keeps anyone waiting on the server: if it cannot be reached or
 * cannot take the answers yet, they stay on the phone and are sent later. Calling it twice does the work once.
 */
export function finishOnboarding(): Promise<void> {
  finishing ??= (async () => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const [sent, starter] = await Promise.all([send().catch(() => false), buildStarter().catch(() => [])]);
    // Signed out while this ran: nothing to finish.
    if ((useAuthStore.getState().user?.id ?? null) !== userId) return;
    useOnboardingStore.getState().update({ status: 'done', finishing: false, ownerId: userId, unsent: !sent, starter: sent ? [] : starter });
  })().finally(() => {
    finishing = null;
  });
  return finishing;
}

/** Mount once in the root layout: sends answers the server could not take earlier. */
export function useSendOnboarding(active: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  const unsent = useOnboardingStore((s) => s.status === 'done' && s.unsent && s.ownerId === userId);
  useEffect(() => {
    if (!active || !unsent) return;
    send()
      .then((sent) => {
        if (sent) useOnboardingStore.getState().update({ unsent: false });
      })
      .catch(() => {});
  }, [active, unsent]);
}
