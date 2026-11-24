/**
 * Where the queue that is playing came from, so the player can say "Playing from Playlist · Late Night Drive"
 * and take you back to it. Every place that starts a queue passes one of these.
 */
export type PlaybackSource =
  | { type: 'playlist'; id: string; name: string }
  | { type: 'album'; id: string; name: string }
  | { type: 'artist'; id: string; name: string }
  | { type: 'podcast'; id: string; name: string }
  | { type: 'song'; id: string; name: string }
  | { type: 'release'; id: string; name: string }
  | { type: 'search'; query: string }
  | { type: 'genre'; name: string }
  | { type: 'radio'; name: string }
  | { type: 'favourites' }
  | { type: 'downloads' }
  | { type: 'recent' }
  | { type: 'trending' };

/** What to print: a short kind ("Playlist") and, when there is one, the name ("Late Night Drive"). */
export function describeSource(source: PlaybackSource): { kind: string; name?: string } {
  switch (source.type) {
    case 'playlist':
      return { kind: 'Playlist', name: source.name };
    case 'album':
      return { kind: 'Album', name: source.name };
    case 'artist':
      return { kind: 'Artist', name: source.name };
    case 'podcast':
      return { kind: 'Podcast', name: source.name };
    case 'song':
      return { kind: 'Song', name: source.name };
    case 'release':
      return { kind: 'Your release', name: source.name };
    case 'search':
      return { kind: 'Search results', name: `“${source.query}”` };
    case 'genre':
      return { kind: 'Genre', name: source.name };
    case 'radio':
      return { kind: 'Radio', name: source.name };
    case 'favourites':
      return { kind: 'Your favourites' };
    case 'downloads':
      return { kind: 'Downloads' };
    case 'recent':
      return { kind: 'Recently played' };
    case 'trending':
      return { kind: 'Popular songs' };
  }
}

/** The page the source is, if it has one: tapping "Playing from" goes there. */
export function sourceRoute(source: PlaybackSource): { pathname: string; params: { id: string } } | null {
  switch (source.type) {
    case 'playlist':
      return { pathname: '/playlist/[id]', params: { id: source.id } };
    case 'album':
      return { pathname: '/album/[id]', params: { id: source.id } };
    case 'artist':
      return { pathname: '/artist/[id]', params: { id: source.id } };
    case 'podcast':
      return { pathname: '/podcast/[id]', params: { id: source.id } };
    case 'song':
      return { pathname: '/track/[id]', params: { id: source.id } };
    case 'release':
      return { pathname: '/release/[id]', params: { id: source.id } };
    default:
      return null;
  }
}
