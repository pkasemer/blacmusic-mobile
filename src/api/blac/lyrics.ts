import { useQuery } from '@tanstack/react-query';
import { USES_BACKEND } from './config';
import { queryClient } from '@/api/queryClient';
import { ApiError, apiRequest } from './http';

/** One line of a song's lyrics. `timeSec` is when it is sung, or null when the lyrics are not timed. */
export interface LyricLine {
  timeSec: number | null;
  text: string;
}

export interface Lyrics {
  /** The lines carry times, so the player can follow along. */
  synced: boolean;
  lines: LyricLine[];
}

interface WireLyrics {
  lyrics?: {
    synced?: boolean;
    lines?: { timeMs?: number | null; text: string }[];
    text?: string;
  } | null;
}

/** A song's lyrics, or `null` when it has none (or the server cannot give lyrics yet). */
async function fetchLyrics(trackId: string): Promise<Lyrics | null> {
  if (!USES_BACKEND) return null;
  try {
    const data = await apiRequest<WireLyrics>(`/v1/tracks/${encodeURIComponent(trackId)}/lyrics`);
    const wire = data.lyrics;
    if (!wire) return null;
    if (wire.lines && wire.lines.length > 0) {
      const lines = wire.lines.map((l) => ({ timeSec: l.timeMs === null || l.timeMs === undefined ? null : l.timeMs / 1000, text: l.text }));
      return { synced: wire.synced === true && lines.every((l) => l.timeSec !== null), lines };
    }
    if (wire.text && wire.text.trim()) {
      return { synced: false, lines: wire.text.split(/\r?\n/).map((text) => ({ timeSec: null, text })) };
    }
    return null;
  } catch (e) {
    // No lyrics for this song, or a server older than the app: nothing to show either way.
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
}

export const useLyrics = (trackId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['music', 'lyrics', trackId] as const,
    queryFn: () => fetchLyrics(trackId as string),
    enabled: enabled && !!trackId,
    staleTime: 10 * 60_000,
    retry: 1,
  });

// ---- For artists: read and change the lyrics of their own tracks -----------------------------------------

/** What the artist sees when editing: the plain text, and whether the lyrics are timed. */
export async function fetchLyricsForEdit(trackId: string): Promise<{ text: string; synced: boolean } | null> {
  try {
    const data = await apiRequest<WireLyrics>(`/v1/tracks/${encodeURIComponent(trackId)}/lyrics`);
    const wire = data.lyrics;
    if (!wire) return null;
    return { text: wire.text ?? (wire.lines ?? []).map((l) => l.text).join('\n'), synced: wire.synced === true };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
}

/** Text that carries LRC time stamps like [01:23.45], which the server turns into timed lyrics. */
export const looksTimed = (text: string) => /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(text);

/** Saves lyrics. Text with time stamps is sent as timed (LRC) lyrics, anything else as plain text. */
export async function saveLyrics(trackId: string, text: string): Promise<void> {
  await apiRequest<unknown>(`/v1/tracks/${encodeURIComponent(trackId)}/lyrics`, {
    method: 'PUT',
    body: looksTimed(text) ? { lrc: text } : { text },
  });
  void queryClient.invalidateQueries({ queryKey: ['music', 'lyrics', trackId] });
}

export async function removeLyrics(trackId: string): Promise<void> {
  await apiRequest<void>(`/v1/tracks/${encodeURIComponent(trackId)}/lyrics`, { method: 'DELETE' });
  void queryClient.invalidateQueries({ queryKey: ['music', 'lyrics', trackId] });
}
