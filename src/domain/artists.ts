/** Who a song is by: its own artist, then whoever is featured on it. */
import type { Playable, Track } from './types';

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
