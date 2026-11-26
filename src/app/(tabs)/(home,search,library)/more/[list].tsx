import { useMemo } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMoreList } from '@/api/blac/queries';
import { Artwork } from '@/components/Artwork';
import { Avatar } from '@/components/Avatar';
import { PlaylistCover } from '@/components/PlaylistCover';
import { ScreenState } from '@/components/ScreenState';
import { SearchResultRow } from '@/components/SearchResultRow';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { moreItemId, type MoreItem, type MoreList } from '@/domain/more';
import { useTheme } from '@/theme';

const LEAD = 52;

function Detail({ children }: { children: string }) {
  return (
    <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
      {children}
    </Text>
  );
}

const songs = (n: number) => `${n} ${n === 1 ? 'song' : 'songs'}`;

function Row({ item }: { item: MoreItem }) {
  const router = useRouter();
  if (item.kind === 'album') {
    const { album } = item;
    return (
      <SearchResultRow
        leading={<Artwork id={album.id} logoUrl={album.artworkUrl} size={LEAD} />}
        title={album.title}
        tag={album.type === 'single' ? 'Single' : album.type === 'ep' ? 'EP' : 'Album'}
        subtitle={<Detail>{album.artistName}</Detail>}
        onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })}
      />
    );
  }
  if (item.kind === 'artist') {
    const { artist } = item;
    return (
      <SearchResultRow
        leading={<Avatar url={artist.avatarUrl} name={artist.name} size={LEAD} />}
        title={artist.name}
        verified={artist.verification === 'verified'}
        tag="Artist"
        onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artist.id } })}
      />
    );
  }
  if (item.kind === 'playlist') {
    const { playlist } = item;
    return (
      <SearchResultRow
        leading={<PlaylistCover playlist={playlist} size={LEAD} />}
        title={playlist.name}
        tag="Playlist"
        subtitle={<Detail>{playlist.ownerName ? `By ${playlist.ownerName}` : songs(playlist.trackCount)}</Detail>}
        onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
      />
    );
  }
  const { podcast } = item;
  return (
    <SearchResultRow
      leading={<Artwork id={podcast.id} logoUrl={podcast.artworkUrl} size={LEAD} />}
      title={podcast.title}
      tag="Podcast"
      subtitle={<Detail>{podcast.host}</Detail>}
      onPress={() => router.push({ pathname: '/podcast/[id]', params: { id: podcast.id } })}
    />
  );
}

/** Everything in one section ("More"), loaded a page at a time as you scroll. */
export default function MoreScreen() {
  const { list, ref, title } = useLocalSearchParams<{ list: MoreList; ref?: string; title?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const query = useMoreList(list, ref);

  // A page can repeat something from the one before when the list changes in between.
  const items = useMemo(() => {
    const seen = new Map<string, MoreItem>();
    for (const page of query.data?.pages ?? []) for (const item of page.items) seen.set(moreItemId(item), item);
    return [...seen.values()];
  }, [query.data]);

  return (
    <TabScreen>
      <Stack.Screen options={{ title: title ?? 'More' }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        data={items}
        keyExtractor={moreItemId}
        renderItem={({ item }) => <Row item={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListEmptyComponent={
          query.isPending ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: 32 }} />
          ) : query.isError ? (
            <ScreenState kind="error" title="Can't load this list" message="Check your connection and try again." actionLabel="Try again" onAction={() => void query.refetch()} />
          ) : (
            <ScreenState kind="empty" title="Nothing here yet" message="Check back later." />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: 18 }} />
          ) : query.isFetchNextPageError ? (
            <View style={{ paddingVertical: 12 }}>
              <ScreenState kind="error" title="Couldn't load more" message="Check your connection and try again." actionLabel="Try again" onAction={() => void query.fetchNextPage()} />
            </View>
          ) : undefined
        }
      />
    </TabScreen>
  );
}
