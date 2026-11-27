import { useQuery } from '@tanstack/react-query';
import { blacApi } from '@/api/blac';
import { onboardingApi } from '@/api/blac/onboarding';
import { DEFAULT_DISCOVERY, toPayload } from '@/domain/onboarding';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore, type PickedArtist } from '@/store/onboardingStore';
import { keepYourSound } from './yourSound';

/** Music preferences after onboarding: the same answers, changed from Settings. */

/** The saved ids as artists to show. One no longer on Blac is left out; any other failure stops the load. */
async function artistsFor(ids: string[]): Promise<PickedArtist[]> {
  const known = new Map(useOnboardingStore.getState().artists.map((a) => [a.id, a]));
  const found = await Promise.all(
    ids.map(async (id) => {
      const have = known.get(id);
      if (have) return have;
      const artist = await blacApi.getArtist(id);
      return artist ? { id: artist.id, name: artist.name, avatarUrl: artist.avatarUrl, verified: artist.verification === 'verified' } : null;
    }),
  );
  return found.filter((a): a is PickedArtist => a !== null);
}

/**
 * Puts the account's current answers on the phone, ready to edit. Saving replaces them all on the server, so this must
 * succeed first (it throws when it cannot): otherwise changing one thing on a new phone would wipe the rest.
 */
export async function loadPreferences(): Promise<true> {
  const userId = useAuthStore.getState().user?.id ?? null;
  const local = useOnboardingStore.getState();
  // Answers the server has not had yet are newer than anything it holds.
  if (local.unsent && local.ownerId === userId) return true;
  const saved = await onboardingApi.getSaved();
  if (!saved) return true;
  const artists = await artistsFor(saved.artistIds ?? []);
  if ((useAuthStore.getState().user?.id ?? null) !== userId) throw new Error('signed out');
  useOnboardingStore.getState().update({
    preferred: saved.languages?.preferred ?? [],
    understood: saved.languages?.understood ?? [],
    regions: saved.regions ?? [],
    discoveryMode: saved.discoveryMode ?? DEFAULT_DISCOVERY,
    genres: saved.genres ?? [],
    artists,
  });
  return true;
}

/** Saves the answers as they are now to the account. Throws when the server does not take them. */
export async function savePreferences(): Promise<void> {
  const state = useOnboardingStore.getState();
  if (!(await onboardingApi.save(toPayload(state)))) throw new Error('not saved');
  // Onboarding that never reached the server is finished there too.
  if (state.unsent && (await onboardingApi.complete().catch(() => false))) useOnboardingStore.getState().update({ unsent: false });
  void keepYourSound();
}

/** Loads the answers once for as long as a preferences screen is open, so edits are not overwritten under way. */
export function useMyPreferences() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['onboarding', 'mine', userId] as const,
    queryFn: loadPreferences,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnReconnect: false,
    retry: 1,
  });
}
