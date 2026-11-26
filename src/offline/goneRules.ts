/**
 * The rules for deciding that something saved on the phone is gone from Blac. Kept apart from React and the stores
 * so they can be checked on their own.
 */

export type SavedKind = 'track' | 'album' | 'artist' | 'playlist';

export interface Saved {
  kind: SavedKind;
  id: string;
}

export const savedKey = (s: Saved) => `${s.kind}:${s.id}`;

/** Where to ask the server whether something is still there. */
export const SAVED_PATH: Record<SavedKind, string> = {
  track: '/v1/tracks/',
  album: '/v1/releases/',
  artist: '/v1/artists/',
  playlist: '/v1/playlists/',
};

/**
 * What a failed check means:
 * - `gone`: the server itself says this thing does not exist for this person (banned, taken down, deleted, made
 *   private). Only this removes anything.
 * - `unknown`: no connection, a server problem, too many requests or a sign-in problem. Stop checking; try later.
 * - `keep`: some other answer. Leave the thing alone.
 * A plain "404 page not found" (a wrong address or a server in the way) has no `not_found` code, so it never
 * deletes anything.
 */
export function verdictFor(status: number, code: string): 'gone' | 'unknown' | 'keep' {
  if (status === 404 && code === 'not_found') return 'gone';
  if (status === 0 || status === 401 || status === 429 || status >= 500) return 'unknown';
  return 'keep';
}
