import { mergeConfig, type OnboardingConfig, type OnboardingPreferences } from '@/domain/onboarding';
import type { PickedArtist } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { reachable } from './config';
import { ApiError, apiRequest } from './http';
import { USES_BACKEND, blacApi } from './index';

/**
 * Onboarding calls. The server does not have the `/v1/onboarding/…` routes yet: each call says so with "not found",
 * and the app carries on with what it has (built-in catalogue, artists for signed-in people, answers kept to send later).
 */

const notThere = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405);
const signedIn = () => useAuthStore.getState().refreshToken !== null;

/** Thrown when artists cannot be listed until there is an account. */
export class NeedsAccount extends Error {}

interface WireArtist {
  id: string;
  name: string;
  imageUrl?: string | null;
  verified?: boolean;
}

const toPicked = (a: WireArtist): PickedArtist => ({ id: a.id, name: a.name, avatarUrl: reachable(a.imageUrl), verified: a.verified === true });

export const onboardingApi = {
  async getConfig(): Promise<OnboardingConfig> {
    if (!USES_BACKEND) return mergeConfig(null);
    try {
      return mergeConfig(await apiRequest<Partial<OnboardingConfig>>('/v1/onboarding/config', { auth: signedIn() }));
    } catch {
      // Not there yet, or offline: onboarding must not wait on it.
      return mergeConfig(null);
    }
  },

  /** Artists from the catalogue, all of them or those matching `search`. */
  async getArtists(search: string): Promise<PickedArtist[]> {
    const q = search.trim();
    if (!USES_BACKEND) {
      const found = q ? await blacApi.searchArtists(q) : await blacApi.getFeaturedArtists();
      return found.map((a) => ({ id: a.id, name: a.name, avatarUrl: a.avatarUrl, verified: a.verification === 'verified' }));
    }
    try {
      const data = await apiRequest<{ artists: WireArtist[] }>('/v1/onboarding/artists', { query: { q, limit: 40 }, auth: signedIn() });
      return data.artists.map(toPicked);
    } catch (error) {
      const refused = error instanceof ApiError && error.status === 401;
      if (!notThere(error) && !refused) throw error;
      // The ordinary artist lists need an account.
      if (!signedIn()) throw new NeedsAccount();
      const data = q
        ? await apiRequest<{ artists: WireArtist[] }>('/v1/search/artists', { query: { q, limit: 40 } })
        : await apiRequest<{ artists: WireArtist[] }>('/v1/browse/artists', { query: { sort: 'featured', limit: 40 } });
      return data.artists.map(toPicked);
    }
  },

  /** What the server has for this account, or `null` when it cannot say. */
  async getSaved(): Promise<{ completed: boolean } | null> {
    if (!USES_BACKEND) return null;
    try {
      return await apiRequest<{ completed: boolean }>('/v1/onboarding/preferences');
    } catch (error) {
      if (notThere(error)) return null;
      throw error;
    }
  },

  /** `false` when the server cannot keep preferences yet. */
  async save(preferences: OnboardingPreferences): Promise<boolean> {
    if (!USES_BACKEND) return true;
    try {
      await apiRequest<void>('/v1/onboarding/preferences', { method: 'POST', body: preferences });
      return true;
    } catch (error) {
      if (notThere(error)) return false;
      throw error;
    }
  },

  /** Records onboarding as done, which starts the listener's recommendation profile. `false` when not there yet. */
  async complete(): Promise<boolean> {
    if (!USES_BACKEND) return true;
    try {
      await apiRequest<void>('/v1/onboarding/complete', { method: 'POST', body: {} });
      return true;
    } catch (error) {
      if (notThere(error)) return false;
      throw error;
    }
  },
};
