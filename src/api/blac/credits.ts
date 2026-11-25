import { useQuery } from '@tanstack/react-query';
import type { Credit } from '@/domain/credits';
import { queryClient } from '@/api/queryClient';
import { USES_BACKEND } from './config';
import { ApiError, apiRequest } from './http';

/**
 * Credits: who produced, wrote, engineered or released a song or a whole release. `null` means the server does not
 * have credits yet (an older server), as opposed to an empty list, which means nobody has been credited.
 */

async function load(path: string): Promise<Credit[] | null> {
  if (!USES_BACKEND) return null;
  try {
    const data = await apiRequest<{ credits: Credit[] }>(path);
    return data.credits ?? [];
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
}

export const fetchReleaseCredits = (releaseId: string) => load(`/v1/releases/${encodeURIComponent(releaseId)}/credits`);

/** The credits of a release (for the release page, and for the artist's editor). */
export const useReleaseCredits = (releaseId: string | undefined | null) =>
  useQuery({
    queryKey: ['music', 'credits', 'release', releaseId] as const,
    queryFn: () => fetchReleaseCredits(releaseId as string),
    enabled: !!releaseId,
    staleTime: 5 * 60_000,
    retry: 1,
  });

/** The credits of one song: its own, then the ones for the whole release. */
export const useTrackCredits = (trackId: string | undefined) =>
  useQuery({
    queryKey: ['music', 'credits', 'track', trackId] as const,
    queryFn: () => load(`/v1/tracks/${encodeURIComponent(trackId as string)}/credits`),
    enabled: !!trackId,
    staleTime: 5 * 60_000,
    retry: 1,
  });

/** Saves the whole list of credits for a release (it replaces what was there). */
export async function saveReleaseCredits(releaseId: string, credits: Credit[]): Promise<void> {
  await apiRequest<unknown>(`/v1/releases/${encodeURIComponent(releaseId)}/credits`, {
    method: 'PUT',
    body: {
      credits: credits.map((c) => ({
        name: c.name.trim(),
        role: c.role,
        ...(c.role === 'other' && c.roleLabel?.trim() ? { roleLabel: c.roleLabel.trim() } : {}),
        ...(c.trackId ? { trackId: c.trackId } : {}),
        ...(c.artistId ? { artistId: c.artistId } : {}),
      })),
    },
  });
  void queryClient.invalidateQueries({ queryKey: ['music', 'credits'] });
}
