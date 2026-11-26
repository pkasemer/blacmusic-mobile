import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { useNewReleaseAlbums, useSearchAlbums, useSearchArtists, useSearchPlaylists, useTrackSearch, useTrending } from '@/api/blac/queries';
import { playQueue } from '@/audio/music/musicEngine';
import type { PlaybackSource } from '@/audio/music/source';
import { ArtistName } from '@/components/ArtistName';
import { Artwork } from '@/components/Artwork';
import { Avatar } from '@/components/Avatar';
import { AlbumShelf } from '@/components/MusicShelf';
import { PlaylistCover } from '@/components/PlaylistCover';
import { ScreenState } from '@/components/ScreenState';
import { SearchResultRow } from '@/components/SearchResultRow';
import { TrackRowsSkeleton } from '@/components/Skeleton';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { useTrackMenu } from '@/components/TrackActionSheet';
import { TrackRow } from '@/components/TrackRow';
import type { Album, Artist, Playlist, Track } from '@/domain/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { refreshMusic, usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRecentSearchStore, type RecentKind, type RecentOpen } from '@/store/recentSearchStore';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';
import { topInset } from '@/utils/platform';

/** What one line of the results (or the trending list) is. */
type Entry =
  | { kind: 'artist'; artist: Artist }
  | { kind: 'album'; album: Album }
  | { kind: 'playlist'; playlist: Playlist }
  | { kind: 'track'; track: Track; index: number };

const keyOf = (e: Entry) => (e.kind === 'artist' ? `a:${e.artist.id}` : e.kind === 'album' ? `r:${e.album.id}` : e.kind === 'playlist' ? `p:${e.playlist.id}` : `t:${e.track.id}`);

const tagOfAlbum = (type: Album['type']) => (type === 'single' ? 'Single' : type === 'ep' ? 'EP' : 'Album');

const playlistLine = (p: Playlist) => (p.ownerName ? `By ${p.ownerName}` : `${p.trackCount} ${p.trackCount === 1 ? 'song' : 'songs'}`);

/** The page that opens for something found in search. */
function useOpen() {
  const router = useRouter();
  const record = useRecentSearchStore((s) => s.record);
  return useCallback(
    (kind: RecentKind, id: string, remember?: Parameters<typeof record>[0]) => {
      if (remember) record(remember);
      haptics.select();
      if (kind === 'artist') router.push({ pathname: '/artist/[id]', params: { id } });
      else if (kind === 'album') router.push({ pathname: '/album/[id]', params: { id } });
      else if (kind === 'playlist') router.push({ pathname: '/playlist/[id]', params: { id } });
      else router.push({ pathname: '/track/[id]', params: { id } });
    },
    [router, record],
  );
}

/** Things opened from search before, so they are one tap away. */
function RecentSection({ onOpen }: { onOpen: (kind: RecentKind, id: string) => void }) {
  const items = useRecentSearchStore((s) => s.items);
  const remove = useRecentSearchStore((s) => s.remove);
  const clear = useRecentSearchStore((s) => s.clear);
  const shown = items.slice(0, 8);
  if (shown.length === 0) return null;

  const leadingFor = (item: RecentOpen) =>
    item.kind === 'artist' ? <Avatar url={item.imageUrl} name={item.title} size={52} /> : <Artwork id={item.id} logoUrl={item.imageUrl} size={52} />;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 }}>
        <Text variant="title" accessibilityRole="header">
          Recent
        </Text>
        <Pressable onPress={() => { haptics.select(); clear(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear recent searches">
          <Text variant="bodyStrong" color="accent">
            Clear
          </Text>
        </Pressable>
      </View>
      {shown.map((item, i) => (
        <SearchResultRow
          key={item.key}
          leading={leadingFor(item)}
          title={item.title}
          verified={item.verified}
          tag={item.tag}
          subtitle={
            item.subtitle ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {item.subtitle}
              </Text>
            ) : undefined
          }
          onPress={() => onOpen(item.kind, item.id)}
          onRemove={() => remove(item.key)}
          separator={i < shown.length - 1}
        />
      ))}
    </View>
  );
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const refreshControl = usePullToRefresh(refreshMusic);
  const menu = useTrackMenu();
  const open = useOpen();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const searching = debouncedQuery.length > 0;

  const songs = useTrackSearch(debouncedQuery);
  const artists = useSearchArtists(debouncedQuery);
  const albums = useSearchAlbums(debouncedQuery);
  const playlists = useSearchPlaylists(debouncedQuery);
  // With nothing typed: what is new and what is popular, instead of an empty page.
  const latest = useNewReleaseAlbums();
  const trending = useTrending();

  const dismissKeyboard = useCallback(() => inputRef.current?.blur(), []);

  const trackList = useMemo(() => (searching ? (songs.data ?? []) : (trending.data ?? [])), [searching, songs.data, trending.data]);
  const source: PlaybackSource = searching ? { type: 'search', query: debouncedQuery } : { type: 'trending' };

  const entries = useMemo<Entry[]>(() => {
    const tracks = trackList.map((track, index) => ({ kind: 'track' as const, track, index }));
    if (!searching) return tracks;
    return [
      ...(artists.data ?? []).slice(0, 3).map((artist) => ({ kind: 'artist' as const, artist })),
      ...(albums.data ?? []).slice(0, 5).map((album) => ({ kind: 'album' as const, album })),
      ...(playlists.data ?? []).slice(0, 4).map((playlist) => ({ kind: 'playlist' as const, playlist })),
      ...tracks,
    ];
  }, [searching, trackList, artists.data, albums.data, playlists.data]);

  const loading = searching ? songs.isPending && artists.isPending && albums.isPending && playlists.isPending : trending.isPending;
  const failed = searching ? songs.isError && artists.isError && albums.isError && playlists.isError : trending.isError;
  const firstError = searching ? songs : trending;

  const header = (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 14 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <Text variant="display" accessibilityRole="header">
            Search
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginHorizontal: 20,
            height: 50,
            paddingHorizontal: 16,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Search size={19} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Songs, artists, albums and playlists"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={dismissKeyboard}
            accessibilityLabel="Search"
            style={{ flex: 1, ...fontStyle('rounded', '400'), fontSize: 16, color: colors.text, paddingVertical: 0 }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                haptics.select();
                setQuery('');
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!searching ? (
        <>
          <RecentSection onOpen={(kind, id) => open(kind, id)} />
          <AlbumShelf title="Latest releases" albums={latest.data} more={{ list: 'latest-releases' }} />
          <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
            <Text variant="title" accessibilityRole="header">
              Trending now
            </Text>
          </View>
        </>
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          <Text variant="caption" color="textTertiary">
            {loading ? 'Searching…' : `${entries.length} ${entries.length === 1 ? 'result' : 'results'}`}
          </Text>
        </View>
      )}
    </View>
  );

  const renderEntry = ({ item, index }: { item: Entry; index: number }) => {
    const last = index === entries.length - 1;
    if (item.kind === 'track') {
      const { track } = item;
      return (
        <TrackRow
          item={track}
          tag={searching ? 'Song' : undefined}
          separator={!last}
          onPress={() => {
            dismissKeyboard();
            open('track', track.id, { kind: 'track', id: track.id, title: track.title, subtitle: track.artistName, imageUrl: track.artworkUrl, verified: track.artistVerified, tag: 'Song' });
          }}
          onPlay={() => {
            dismissKeyboard();
            playQueue(trackList, item.index, { source });
          }}
          onMore={() => menu.open(track)}
        />
      );
    }
    if (item.kind === 'artist') {
      const { artist } = item;
      return (
        <SearchResultRow
          leading={<Avatar url={artist.avatarUrl} name={artist.name} size={52} />}
          title={artist.name}
          verified={artist.verification === 'verified'}
          tag="Artist"
          separator={!last}
          onPress={() => {
            dismissKeyboard();
            open('artist', artist.id, { kind: 'artist', id: artist.id, title: artist.name, subtitle: '', imageUrl: artist.avatarUrl, verified: artist.verification === 'verified', tag: 'Artist' });
          }}
        />
      );
    }
    if (item.kind === 'album') {
      const { album } = item;
      const tag = tagOfAlbum(album.type);
      return (
        <SearchResultRow
          leading={<Artwork id={album.id} logoUrl={album.artworkUrl} size={52} />}
          title={album.title}
          tag={tag}
          subtitle={<ArtistName name={album.artistName} verified={album.artistVerified} />}
          separator={!last}
          onPress={() => {
            dismissKeyboard();
            open('album', album.id, { kind: 'album', id: album.id, title: album.title, subtitle: album.artistName, imageUrl: album.artworkUrl, verified: album.artistVerified, tag });
          }}
        />
      );
    }
    const { playlist } = item;
    return (
      <SearchResultRow
        leading={<PlaylistCover playlist={playlist} size={52} />}
        title={playlist.name}
        tag="Playlist"
        subtitle={
          <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {playlistLine(playlist)}
          </Text>
        }
        separator={!last}
        onPress={() => {
          dismissKeyboard();
          open('playlist', playlist.id, { kind: 'playlist', id: playlist.id, title: playlist.name, subtitle: playlistLine(playlist), imageUrl: playlist.artworkUrl ?? playlist.artworkUrls[0] ?? null, tag: 'Playlist' });
        }}
      />
    );
  };

  return (
    <TabScreen>
      <FlatList
        data={loading || failed ? [] : entries}
        keyExtractor={keyOf}
        renderItem={renderEntry}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Pressable onPress={dismissKeyboard} accessibilityRole="none" style={{ flex: 1 }}>
            {loading ? (
              <TrackRowsSkeleton count={6} />
            ) : failed ? (
              <ScreenState
                kind="error"
                title="Can't search right now"
                message={firstError.error instanceof Error ? firstError.error.message : 'Check your connection and try again.'}
                actionLabel="Retry"
                onAction={() => void firstError.refetch()}
              />
            ) : (
              <ScreenState kind="empty" title="No results" message="Try a different song, artist, album or playlist name." />
            )}
          </Pressable>
        }
        contentInsetAdjustmentBehavior="automatic"
        // Easy keyboard dismissal: scroll or drag the list, press the Search key, or tap anywhere that isn't a button.
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={dismissKeyboard}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        contentContainerStyle={{ paddingTop: topInset(insets.top) + 12, paddingBottom: 28, gap: 8, flexGrow: 1 }}
      />
      {menu.sheet}
    </TabScreen>
  );
}
