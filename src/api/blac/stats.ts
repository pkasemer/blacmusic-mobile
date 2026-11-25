import { useQuery } from '@tanstack/react-query';
import { USES_BACKEND } from './config';
import { ApiError, apiRequest } from './http';

/**
 * Numbers for artists: how many plays and listeners their music gets, and how each release is doing. The backend
 * counts a play when someone listens to a song for about 30 seconds.
 */

export type StatsRange = '7d' | '28d' | '90d' | 'all';

export const RANGE_LABEL: Record<StatsRange, string> = { '7d': 'Last 7 days', '28d': 'Last 28 days', '90d': 'Last 90 days', all: 'All time' };

export interface DayPoint {
  date: string;
  plays: number;
  listeners: number;
}

export interface ArtistStats {
  range: StatsRange;
  totals: {
    plays: number;
    listeners: number;
    /** Distinct listeners in the last 30 days, whatever the range. */
    monthlyListeners: number;
    /** Compared with the 30 days before. */
    monthlyListenersChange?: number;
    followers: number;
    followersChange?: number;
    likes: number;
    /** Likes gained in the range. */
    likesChange?: number;
    /** The backend does not count downloads yet, so this is always 0 and the app does not show it. */
    downloads: number;
    playlistAdds: number;
  };
  series: DayPoint[];
  topTracks: { trackId: string; title: string; artworkUrl?: string | null; releaseId?: string; plays: number; listeners: number }[];
  releases: { releaseId: string; title: string; type?: string; artworkUrl?: string | null; plays: number; listeners: number }[];
}

export interface ReleaseStats {
  range: StatsRange;
  totals: { plays: number; listeners: number; likes: number; downloads: number; playlistAdds: number; avgListenSec?: number; completionRate?: number };
  series: DayPoint[];
  tracks: { trackId: string; title: string; plays: number; listeners: number; likes: number; completionRate?: number }[];
  sources: { source: string; plays: number }[];
}

/** `null` when the server cannot give statistics yet (an older server). */
async function load<T>(path: string, range: StatsRange): Promise<T | null> {
  if (!USES_BACKEND) return null;
  try {
    return await apiRequest<T>(path, { query: { range } });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
}

export const useArtistStats = (range: StatsRange, enabled = true) =>
  useQuery({
    queryKey: ['studio', 'stats', range] as const,
    queryFn: () => load<ArtistStats>('/v1/me/artist/stats', range),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

export const useReleaseStats = (releaseId: string, range: StatsRange, enabled = true) =>
  useQuery({
    queryKey: ['studio', 'release-stats', releaseId, range] as const,
    queryFn: () => load<ReleaseStats>(`/v1/releases/${encodeURIComponent(releaseId)}/stats`, range),
    enabled: enabled && !!releaseId,
    staleTime: 60_000,
    retry: 1,
  });

/** Tells the backend that someone listened to a song. Fire and forget; a failure is not worth telling anyone. */
let playsUnsupported = false;
export async function reportPlay(input: { trackId: string; listenedSec: number; source?: string }): Promise<void> {
  if (!USES_BACKEND || playsUnsupported) return;
  try {
    await apiRequest<void>('/v1/me/plays', { method: 'POST', body: input });
  } catch (e) {
    // A server without play tracking says 404 or 405: stop asking until the app restarts.
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) playsUnsupported = true;
  }
}
