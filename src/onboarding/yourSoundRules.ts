/** The rules for keeping "Your sound" fresh. Kept apart from the app so they can be tested. */

export const YOUR_SOUND_NAME = 'Your sound';
export const YOUR_SOUND_DESCRIPTION = 'Made for you from what you love. Blac adds new songs as you listen.';
/** About how many songs the playlist holds, and how many new ones an update brings. */
export const YOUR_SOUND_SIZE = 40;
export const FRESH_PER_UPDATE = 8;
/** Never filled beyond this, even when nothing in it may be taken out. */
export const YOUR_SOUND_MAX = 100;
export const UPDATE_EVERY_MS = 24 * 60 * 60 * 1000;

export interface SongTaste {
  artistId?: string;
  completed: number;
  skipped: number;
  replays: number;
  liked: boolean;
}

/** Skipped more than once and never enjoyed: it should not be offered, and goes if the app put it there. */
export const isRejected = (t: SongTaste | undefined) => !!t && t.skipped >= 2 && t.completed === 0 && !t.liked;

/** The artists really enjoyed, best first: likes and replays count most, finishing counts, skips count against. */
export function favouriteArtists(tastes: Record<string, SongTaste>, limit: number): string[] {
  const score = new Map<string, number>();
  for (const t of Object.values(tastes)) {
    if (!t.artistId) continue;
    score.set(t.artistId, (score.get(t.artistId) ?? 0) + t.completed + 2 * t.replays + (t.liked ? 3 : 0) - t.skipped);
  }
  return [...score].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

/**
 * What an update changes. `items` are the playlist's songs, oldest first; `ours` are the songs the app added. Songs the
 * listener added themselves are never removed. New songs are the first candidates not already there nor rejected. Then
 * the app's rejected songs go, and its oldest ones while the playlist is over size.
 */
export function planUpdate(
  items: { itemId: string; trackId: string }[],
  ours: ReadonlySet<string>,
  candidates: string[],
  tastes: Record<string, SongTaste>,
): { add: string[]; remove: { itemId: string; trackId: string }[] } {
  const have = new Set(items.map((i) => i.trackId));
  const fresh = [...new Set(candidates)].filter((id) => !have.has(id) && !isRejected(tastes[id])).slice(0, FRESH_PER_UPDATE);
  const remove = items.filter((i) => ours.has(i.trackId) && isRejected(tastes[i.trackId]));
  let over = items.length - remove.length + fresh.length - YOUR_SOUND_SIZE;
  for (const item of items) {
    if (over <= 0) break;
    // Liked songs stay.
    if (ours.has(item.trackId) && !tastes[item.trackId]?.liked && !remove.includes(item)) {
      remove.push(item);
      over--;
    }
  }
  return { add: fresh.slice(0, Math.max(0, YOUR_SOUND_MAX - (items.length - remove.length))), remove };
}

/** The list with "Your sound" first, so it is always easy to find. */
export function pinFirst<T extends { id: string }>(playlists: T[], id: string | null): T[] {
  const pinned = playlists.find((p) => p.id === id);
  return pinned ? [pinned, ...playlists.filter((p) => p !== pinned)] : playlists;
}
