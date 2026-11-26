import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAlbum } from '@/api/blac/queries';
import { playQueue } from '@/audio/music/musicEngine';
import type { Album } from '@/domain/types';
import { formatDate } from '@/utils/format';
import { Artwork } from './Artwork';
import { FeaturedCard } from './HomeHero';
import { Text } from './Text';

const releasedAt = (album: Album) => Date.parse(album.releaseDate ?? '') || 0;

/** The artist's newest release, on the same big card as "Continue listening" on Home. */
export function LatestRelease({ albums }: { albums: Album[] | undefined }) {
  const router = useRouter();
  const latest = albums?.reduce<Album | undefined>((best, a) => (!best || releasedAt(a) > releasedAt(best) ? a : best), undefined);
  // Its songs, so the card can play it right away.
  const tracks = useAlbum(latest?.id ?? '').data?.tracks ?? [];
  if (!latest) return null;

  const kind = latest.type === 'single' ? 'Single' : latest.type === 'ep' ? 'EP' : 'Album';
  const count = latest.trackCount > 0 ? `${latest.trackCount} ${latest.trackCount === 1 ? 'track' : 'tracks'}` : null;

  return (
    <View style={{ gap: 12 }}>
      <Text variant="title" accessibilityRole="header" style={{ paddingHorizontal: 20 }}>
        Latest release
      </Text>
      <FeaturedCard
        featured={{
          label: kind,
          title: latest.title,
          subtitle: [formatDate(latest.releaseDate), count].filter(Boolean).join(' · '),
          art: <Artwork id={latest.id} logoUrl={latest.artworkUrl} size={112} />,
          tint: { id: latest.id, logoUrl: latest.artworkUrl },
          onPress: () => router.push({ pathname: '/album/[id]', params: { id: latest.id } }),
          onPlay: tracks.length > 0 ? () => playQueue(tracks, 0, { source: { type: 'album', id: latest.id, name: latest.title } }) : undefined,
        }}
      />
    </View>
  );
}
