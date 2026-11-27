import type { ComponentProps } from 'react';
import { featuredSuffix } from '@/domain/artists';
import type { Playable } from '@/domain/types';
import { ArtistName } from './ArtistName';

/**
 * The artists of a song on one line, comma separated, the song's own artist first (with the badge when verified), then
 * whoever is featured. For a podcast episode, the podcast's name.
 */
export function SongArtists({ item, ...props }: { item: Playable } & Omit<ComponentProps<typeof ArtistName>, 'name' | 'verified' | 'others'>) {
  return item.kind === 'track' ? (
    <ArtistName {...props} name={item.artistName} verified={item.artistVerified} others={featuredSuffix(item)} />
  ) : (
    <ArtistName {...props} name={item.podcastTitle} />
  );
}
