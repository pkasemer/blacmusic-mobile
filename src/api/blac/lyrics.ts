import { useQuery } from '@tanstack/react-query';
import { USES_BACKEND } from './config';
import { queryClient } from '@/api/queryClient';
import { checkLyrics, toLrc } from '@/domain/lyricsFormat';
import { ApiError, apiRequest } from './http';

/** One line of a song's lyrics. `timeSec` is when it is sung, or null when the lyrics are not timed. */
export interface LyricLine {
  timeSec: number | null;
  text: string;
  /** The line in English. Only timed lyrics have translations, and not every line needs one. */
  translation?: string;
}

export interface Lyrics {
  /** The lines carry times, so the player can follow along. */
  synced: boolean;
  lines: LyricLine[];
}

interface WireLyrics {
  lyrics?: {
    synced?: boolean;
    lines?: { timeMs?: number | null; text: string; translation?: string | null }[];
    text?: string;
    /** Timed lyrics as written, translations included, for editing. */
    lrc?: string;
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
      const lines = wire.lines.map((l) => ({
        timeSec: l.timeMs === null || l.timeMs === undefined ? null : l.timeMs / 1000,
        text: l.text,
        translation: l.translation?.trim() || undefined,
      }));
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

/**
 * What the artist sees when editing, and whether the lyrics are timed. Timed lyrics come with their times and
 * translations written out, so saving them again loses neither.
 */
export async function fetchLyricsForEdit(trackId: string): Promise<{ text: string; synced: boolean } | null> {
  try {
    const data = await apiRequest<WireLyrics>(`/v1/tracks/${encodeURIComponent(trackId)}/lyrics`);
    const wire = data.lyrics;
    if (!wire) return null;
    const lines = wire.lines ?? [];
    if (wire.synced === true && lines.length > 0 && lines.every((l) => typeof l.timeMs === 'number')) {
      const timed = lines.map((l) => ({ timeSec: (l.timeMs as number) / 1000, text: l.text, translation: l.translation?.trim() || undefined }));
      return { text: wire.lrc?.trim() || toLrc(timed), synced: true };
    }
    return { text: wire.text ?? lines.map((l) => l.text).join('\n'), synced: false };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
}

/**
 * Saves lyrics. Text with time stamps is sent as timed (LRC) lyrics, anything else as plain text. `translationsLost`
 * is true when translations were sent and the server did not keep them (it cannot yet).
 */
export async function saveLyrics(trackId: string, text: string): Promise<{ translationsLost: boolean }> {
  const checked = checkLyrics(text);
  const data = await apiRequest<WireLyrics | undefined>(`/v1/tracks/${encodeURIComponent(trackId)}/lyrics`, {
    method: 'PUT',
    body: checked.timed ? { lrc: text } : { text },
  });
  void queryClient.invalidateQueries({ queryKey: ['music', 'lyrics', trackId] });
  const sent = checked.lines.some((l) => l.translation);
  return { translationsLost: sent && !(data?.lyrics?.lines ?? []).some((l) => l.translation) };
}

export async function removeLyrics(trackId: string): Promise<void> {
  await apiRequest<void>(`/v1/tracks/${encodeURIComponent(trackId)}/lyrics`, { method: 'DELETE' });
  void queryClient.invalidateQueries({ queryKey: ['music', 'lyrics', trackId] });
}
