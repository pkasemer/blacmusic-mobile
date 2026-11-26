import { FlatList, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEpisodes, usePodcasts } from '@/api/blac/queries';
import { playQueue } from '@/audio/music/musicEngine';
import { Artwork } from '@/components/Artwork';
import { ShareLinkButton } from '@/components/CollectionActions';
import { DetailActions } from '@/components/DetailActions';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { TrackRow } from '@/components/TrackRow';
import { useTheme } from '@/theme';

/** One podcast and its episodes. Tapping an episode plays it and queues the rest. */
export default function PodcastScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const podcasts = usePodcasts();
  const episodes = useEpisodes(id);
  const podcast = podcasts.data?.find((p) => p.id === id);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={episodes.data ?? []}
      keyExtractor={(e) => e.id}
      renderItem={({ item, index }) => <TrackRow item={item} onPress={() => playQueue(episodes.data ?? [], index, { source: { type: 'podcast', id, name: podcast?.title ?? 'Podcast' } })} />}
      ListHeaderComponent={
        <View style={{ paddingBottom: 12 }}>
        <View style={{ alignItems: 'center', gap: 10, padding: 20, paddingBottom: 30 }}>
          <Artwork id={id} logoUrl={podcast?.artworkUrl ?? null} size={180} />
          <Text variant="title" style={{ textAlign: 'center' }}>
            {podcast?.title ?? 'Podcast'}
          </Text>
          <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            {podcast?.host ? `Hosted by ${podcast.host}` : ''}
          </Text>
          {podcast?.description ? (
            <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              {podcast.description}
            </Text>
          ) : null}
        </View>
        <DetailActions
          items={episodes.data ?? []}
          source={{ type: 'podcast', id, name: podcast?.title ?? 'Podcast' }}
          shuffle={false}
          tools={
            <ShareLinkButton
              label={`Share ${podcast?.title ?? 'this podcast'}`}
              message={`Listen to the podcast "${podcast?.title ?? 'Podcast'}" on Blac`}
              path={`/podcast/${id}`}
            />
          }
        />
        </View>
      }
      ListEmptyComponent={
        episodes.isPending ? undefined : <ScreenState kind="empty" title="No episodes yet" message="New episodes will show up here." />
      }
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    />
  );
}
