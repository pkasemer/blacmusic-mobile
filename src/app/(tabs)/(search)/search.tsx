import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { useGenres, useGenreTracks, useSearchPlaylists, useTrackSearch, useTrending } from '@/api/blac/queries';
import { playQueue } from '@/audio/music/musicEngine';
import { PlaylistShelf } from '@/components/MusicShelf';
import { ScreenHero } from '@/components/ScreenHero';
import { ScreenState } from '@/components/ScreenState';
import { TrackRowsSkeleton } from '@/components/Skeleton';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { useTrackMenu } from '@/components/TrackActionSheet';
import { TrackRow } from '@/components/TrackRow';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { refreshMusic, usePullToRefresh } from '@/hooks/usePullToRefresh';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';
import { topInset } from '@/utils/platform';

/** Tile colours for the genre grid. A genre always gets the same one (picked from its name). */
const TILE_COLOURS = ['#8D67AB', '#1E3264', '#BA5D07', '#E8115B', '#148A08', '#0D73EC', '#E13300', '#477D95', '#DC148C', '#27856A', '#503750', '#7358FF'];

function colourFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TILE_COLOURS[Math.abs(h) % TILE_COLOURS.length];
}

function GenreTile({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${name}`}
      style={({ pressed }) => ({
        width: '48.5%',
        height: 88,
        borderRadius: radius.card,
        overflow: 'hidden',
        padding: 12,
        backgroundColor: colourFor(name),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text variant="headline" numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 17, lineHeight: 21, maxWidth: '75%' }}>
        {name}
      </Text>
      {/* A tilted square in the corner, like the cover on a Spotify category tile */}
      <View
        style={{
          position: 'absolute',
          right: -10,
          bottom: -6,
          width: 54,
          height: 54,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.22)',
          transform: [{ rotate: '24deg' }],
        }}
      />
    </Pressable>
  );
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const refreshControl = usePullToRefresh(refreshMusic);
  const menu = useTrackMenu();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const searching = debouncedQuery.length > 0;
  const results = useTrackSearch(debouncedQuery);
  // Public playlists that match: the Blac team's picks first, then other people's public playlists.
  const playlistResults = useSearchPlaylists(debouncedQuery);
  const genres = useGenres();
  const genreTracks = useGenreTracks(searching ? null : genre);
  // With nothing typed and no genre chosen, offer what is popular instead of an empty page.
  const trending = useTrending();
  const active = searching ? results : genre ? genreTracks : trending;
  const tracks = useMemo(() => active.data ?? [], [active.data]);

  const dismissKeyboard = useCallback(() => inputRef.current?.blur(), []);

  const browsing = !searching && !genre;

  const header = (
    <View style={{ gap: 18 }}>
      <ScreenHero label="Discover" title="Search">
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
            placeholder="Songs, artists and playlists"
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
      </ScreenHero>

      {/* Browse all: a tile for every genre, before anything is typed */}
      {browsing && (genres.data?.length ?? 0) > 0 ? (
        <View style={{ gap: 12 }}>
          <Text variant="title" style={{ paddingHorizontal: 20 }}>
            Browse all
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, paddingHorizontal: 20 }}>
            {(genres.data ?? []).map((g) => (
              <GenreTile key={g.id} name={g.name} onPress={() => setGenre(g.name)} />
            ))}
          </View>
        </View>
      ) : null}

      {searching && (playlistResults.data?.length ?? 0) > 0 ? <PlaylistShelf title="Playlists" playlists={playlistResults.data} /> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4 }}>
        <Text variant={browsing ? 'title' : 'caption'} color={browsing ? 'text' : 'textTertiary'}>
          {searching
            ? active.isPending
              ? 'Searching…'
              : `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`
            : genre
              ? genre
              : 'Trending now'}
        </Text>
        {!searching && genre ? (
          <Pressable
            onPress={() => {
              haptics.select();
              setGenre(null);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear genre"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text variant="bodyStrong" color="accent">
              All genres
            </Text>
            <X size={14} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <TabScreen>
      <FlatList
        data={active.isPending || active.isError ? [] : tracks}
        keyExtractor={(t) => t.id}
        renderItem={({ item, index }) => (
          <TrackRow
            item={item}
            onPress={() => {
              dismissKeyboard();
              playQueue(tracks, index, {
                source: searching ? { type: 'search', query: debouncedQuery } : genre ? { type: 'genre', name: genre } : { type: 'trending' },
              });
            }}
            onMore={() => menu.open(item)}
            separator={index < tracks.length - 1}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Pressable onPress={dismissKeyboard} accessibilityRole="none" style={{ flex: 1 }}>
            {active.isPending ? (
              <TrackRowsSkeleton count={6} />
            ) : active.isError ? (
              <ScreenState
                kind="error"
                title="Can't search right now"
                message={active.error instanceof Error ? active.error.message : 'Check your connection and try again.'}
                actionLabel="Retry"
                onAction={() => active.refetch()}
              />
            ) : (
              <ScreenState
                kind="empty"
                title="No songs found"
                message={genre && !searching ? 'No songs in this genre yet.' : 'Try a different song or artist name.'}
              />
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
