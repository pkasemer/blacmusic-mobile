/** Who a song is by: its own artist, then whoever is featured on it. */
import type { Album, Playable, Track } from './types';

export interface SongArtist {
  /** The artist's profile on Blac, or `null` for a name with no profile to open. */
  id: string | null;
  name: string;
  imageUrl?: string | null;
  verified?: boolean;
  featured: boolean;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Every artist on the song, the main one first, nobody twice. */
export function artistsOf(track: Pick<Track, 'artistId' | 'artistName' | 'artistVerified' | 'artistImageUrl' | 'featuredArtists'>): SongArtist[] {
  const all: SongArtist[] = [
    { id: track.artistId || null, name: track.artistName, imageUrl: track.artistImageUrl, verified: track.artistVerified, featured: false },
  ];
  for (const other of track.featuredArtists ?? []) {
    if (!other.name.trim()) continue;
    if (all.some((a) => (other.id && a.id === other.id) || sameName(a.name, other.name))) continue;
    all.push({ ...other, featured: true });
  }
  return all;
}

/** The featured names as they follow the main one: ", Ava, Ben". Empty when nobody is featured. */
export const featuredSuffix = (track: Parameters<typeof artistsOf>[0]) =>
  artistsOf(track)
    .slice(1)
    .map((a) => `, ${a.name}`)
    .join('');

/** One line of text for a song or episode: every artist, comma separated, or the podcast's name. */
export const artistLine = (item: Playable) => (item.kind === 'track' ? item.artistName + featuredSuffix(item) : item.podcastTitle);

type Feature = NonNullable<Track['featuredArtists']>[number];
const isIn = (list: Feature[], one: Feature) => list.some((a) => (one.id && a.id === one.id) || sameName(a.name, one.name));

/**
 * A release with who is featured on it. What the server says, when it does; otherwise what its songs tell: all of a
 * single's features, or, for a longer release, only those on every one of its songs.
 */
export function releaseWithFeatures(release: Album, tracks: Track[] = []) {
  if (release.featuredArtists?.length || tracks.length === 0) return release;
  const each = tracks.map((t) => t.featuredArtists ?? []);
  const featuredArtists = release.type === 'single' ? each.flat() : each[0].filter((a) => each.every((list) => isIn(list, a)));
  return { ...release, featuredArtists };
}

/** One line for a release: its artist, then everyone featured, comma separated. */
export const releaseLine = (release: Album) => release.artistName + featuredSuffix(release);
