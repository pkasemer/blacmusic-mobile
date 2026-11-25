import type { Album, Artist, Track } from '@/domain/types';

/**
 * Builds artist and album lists out of a list of tracks. The Home sections use this while the backend has no
 * dedicated "featured artists" or "albums" lists, and the sample data uses it always.
 */

/** Each artist once, in the order they first appear. */
export function artistsFromTracks(tracks: Track[]): Artist[] {
  const seen = new Map<string, Artist>();
  for (const t of tracks) {
    if (!t.artistId || seen.has(t.artistId)) continue;
    seen.set(t.artistId, {
      id: t.artistId,
      name: t.artistName,
      avatarUrl: t.artistImageUrl ?? null,
      verification: t.artistVerified ? 'verified' : 'unverified',
    });
  }
  return [...seen.values()];
}

/** Each album or single once, in the order they first appear. Tracks that belong to no release are skipped. */
export function albumsFromTracks(tracks: Track[]): Album[] {
  const seen = new Map<string, Album>();
  for (const t of tracks) {
    if (!t.releaseId || seen.has(t.releaseId)) continue;
    const trackCount = tracks.filter((x) => x.releaseId === t.releaseId).length;
    seen.set(t.releaseId, {
      id: t.releaseId,
      type: trackCount === 1 ? 'single' : 'album',
      title: t.albumTitle ?? t.title,
      artworkUrl: t.artworkUrl,
      artistId: t.artistId,
      artistName: t.artistName,
      artistVerified: t.artistVerified,
      releaseDate: t.releaseDate,
      trackCount,
    });
  }
  return [...seen.values()];
}
