import type { Album, Artist, Playlist, Podcast } from './types';

/** The lists behind the "More" link of each section. */
export type MoreList =
  | 'new-releases'
  | 'featured-artists'
  | 'featured-albums'
  | 'latest-releases'
  | 'playlists'
  | 'group'
  | 'podcasts'
  | 'artist-releases'
  | 'related-artists'
  | 'related-albums';

export type MoreItem =
  | { kind: 'album'; album: Album }
  | { kind: 'artist'; artist: Artist }
  | { kind: 'playlist'; playlist: Playlist }
  | { kind: 'podcast'; podcast: Podcast };

/** One page of a list. `next` is where the following page starts, or `null` after the last one. */
export interface MorePage {
  items: MoreItem[];
  next: number | null;
}

export const moreItemId = (item: MoreItem) =>
  item.kind === 'album' ? item.album.id : item.kind === 'artist' ? item.artist.id : item.kind === 'playlist' ? item.playlist.id : item.podcast.id;
