import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/api/blac/onboarding';
import { queryClient } from '@/api/queryClient';
import { DEFAULT_DISCOVERY, toPayload, type OnboardingPreferences } from '@/domain/onboarding';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore, type PickedArtist } from '@/store/onboardingStore';

/**
 * Favourite artists after onboarding, marked from an artist's page. They are the same ones as in Music preferences
 * (and are not who the listener follows).
 */

/** The most the server keeps. */
export const MAX_FAVOURITE_ARTISTS = 100;

const keyFor = (userId: string | undefined) => ['onboarding', 'favourite-artists', userId] as const;
const userId = () => useAuthStore.getState().user?.id;

/** The account's answers as they are now. Saving replaces them all, so it throws rather than guess. */
async function currentAnswers(): Promise<OnboardingPreferences> {
  const local = useOnboardingStore.getState();
  // Answers the server has not had yet are newer than anything it holds.
  if (local.unsent && local.ownerId === userId()) return toPayload(local);
  const saved = await onboardingApi.getSaved();
  if (!saved) throw new Error('no preferences');
  return toPayload({
    preferred: saved.languages?.preferred ?? [],
    understood: saved.languages?.understood ?? [],
    regions: saved.regions ?? [],
    discoveryMode: saved.discoveryMode ?? DEFAULT_DISCOVERY,
    genres: saved.genres ?? [],
    artists: (saved.artistIds ?? []).map((id) => ({ id })),
  });
}

export type FavouriteResult = 'saved' | /** The only one left: one is always kept. */ 'last' | 'full';

async function change(artist: PickedArtist, on: boolean): Promise<FavouriteResult> {
  const me = userId();
  const answers = await currentAnswers();
  const others = answers.artistIds.filter((id) => id !== artist.id);
  const was = others.length !== answers.artistIds.length;
  let ids = answers.artistIds;
  if (on !== was) {
    if (!on && others.length === 0) return 'last';
    if (on && others.length >= MAX_FAVOURITE_ARTISTS) return 'full';
    ids = on ? [...others, artist.id] : others;
    if (userId() !== me) throw new Error('signed out');
    if (!(await onboardingApi.save({ ...answers, artistIds: ids }))) throw new Error('not saved');
  }
  // Keep the phone's copy (shown in Music preferences) in step.
  const local = useOnboardingStore.getState();
  if (local.ownerId === me) {
    const rest = local.artists.filter((a) => a.id !== artist.id);
    local.update({ artists: on ? [...rest, artist] : rest });
  }
  queryClient.setQueryData(keyFor(me), ids);
  return 'saved';
}

let queue: Promise<unknown> = Promise.resolve();

/** Marks or unmarks an artist. Taps are saved one after another, so none undoes another. */
export function setFavouriteArtist(artist: PickedArtist, on: boolean): Promise<FavouriteResult> {
  const next = queue.then(() => change(artist, on));
  queue = next.catch(() => {});
  return next;
}

/** The ids of the favourite artists; `undefined` until known. */
export function useFavouriteArtistIds(): string[] | undefined {
  const me = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: keyFor(me),
    queryFn: async () => (await currentAnswers()).artistIds,
    enabled: !!me,
    staleTime: 0,
  }).data;
}
