import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { playQueue, toggleMusicPlayback } from '@/audio/music/musicEngine';
import type { PlaybackSource } from '@/audio/music/source';
import { Pause, Play } from 'lucide-react-native';
import type { Album, Artist, Playlist, Podcast, Track } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { useTrackMenu } from './TrackActionSheet';
import { VerifiedBadge } from './VerifiedBadge';
import { ArtistName } from './ArtistName';
import { Artwork } from './Artwork';
import { Avatar } from './Avatar';
import { PlaylistCover } from './PlaylistCover';
import { Text } from './Text';

const CARD = 140;
const STRIDE = CARD + 14;

/**
 * One song in a shelf. Tapping the card opens the song's page (like every other card); the round button on the cover
 * plays it, or pauses it while it is the one playing. Press and hold for the song menu.
 */
function TrackCard({ tracks, index, source, onMenu }: { tracks: Track[]; index: number; source?: PlaybackSource; onMenu: (track: Track) => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const item = tracks[index];
  const current = useMusicStore((m) => m.active && m.queue[m.index]?.id === item.id);
  const playing = useMusicStore((m) => m.active && m.playing && m.queue[m.index]?.id === item.id);

  return (
    <Pressable
      onPress={() => {
        haptics.select();
        router.push({ pathname: '/track/[id]', params: { id: item.id } });
      }}
      onLongPress={() => {
        haptics.medium();
        onMenu(item);
      }}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title} by ${item.artistName}`}
      accessibilityActions={[{ name: 'play', label: playing ? 'Pause' : 'Play' }]}
      onAccessibilityAction={() => (current ? toggleMusicPlayback() : playQueue(tracks, index, { source }))}
      style={({ pressed }) => ({ width: CARD, gap: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <View>
        <Artwork id={item.id} logoUrl={item.artworkUrl} size={CARD} />
        {/* Its own button, so playing never opens the page and opening never plays */}
        <Pressable
          onPress={() => {
            haptics.select();
            if (current) toggleMusicPlayback();
            else playQueue(tracks, index, { source });
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={playing ? `Pause ${item.title}` : `Play ${item.title}`}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 8,
            bottom: 8,
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            opacity: pressed ? 0.8 : 1,
            shadowColor: '#000',
            shadowOpacity: 0.35,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          })}
        >
          {playing ? (
            <Pause size={16} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
          ) : (
            <Play size={16} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} style={{ marginLeft: 2 }} />
          )}
        </Pressable>
      </View>
      <View style={{ gap: 1 }}>
        <Text variant="headline" numberOfLines={1} color={current ? 'accent' : 'text'}>
          {item.title}
        </Text>
        <ArtistName name={item.artistName} verified={item.artistVerified} />
      </View>
    </Pressable>
  );
}

/**
 * A titled horizontal row of song covers. Tapping a card opens the song; the play button on the cover plays the row
 * from that song.
 */
export function MusicShelf({ title, tracks, source }: { title: string; tracks: Track[] | undefined; source?: PlaybackSource }) {
  const menu = useTrackMenu();
  if (!tracks || tracks.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <Text variant="title" accessibilityRole="header" style={{ paddingHorizontal: 20 }}>
        {title}
      </Text>
      <FlatList
        horizontal
        data={tracks}
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        getItemLayout={(_, index) => ({ length: STRIDE, offset: 20 + STRIDE * index, index })}
        initialNumToRender={3}
        windowSize={3}
        renderItem={({ item: _item, index }) => <TrackCard tracks={tracks} index={index} source={source} onMenu={(t) => menu.open(t)} />}
      />
      {menu.sheet}
    </View>
  );
}

/** Horizontal row of podcast covers; tapping one opens its episode list. */
export function PodcastShelf({ podcasts }: { podcasts: Podcast[] | undefined }) {
  const router = useRouter();
  if (!podcasts || podcasts.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <Text variant="title" accessibilityRole="header" style={{ paddingHorizontal: 20 }}>
        Podcasts
      </Text>
      <FlatList
        horizontal
        data={podcasts}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/podcast/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open podcast ${item.title}`}
            style={({ pressed }) => ({ width: CARD, gap: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <Artwork id={item.id} logoUrl={item.artworkUrl} size={CARD} />
            <View style={{ gap: 1 }}>
              <Text variant="headline" numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {item.host}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const ARTIST = 124;
const ARTIST_STRIDE = ARTIST + 14;

/** Round pictures of featured artists. Tapping one opens the artist's page. */
export function ArtistShelf({ title, artists }: { title: string; artists: Artist[] | undefined }) {
  const router = useRouter();
  if (!artists || artists.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <Text variant="title" accessibilityRole="header" style={{ paddingHorizontal: 20 }}>
        {title}
      </Text>
      <FlatList
        horizontal
        data={artists}
        keyExtractor={(a) => a.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        getItemLayout={(_, index) => ({ length: ARTIST_STRIDE, offset: 20 + ARTIST_STRIDE * index, index })}
        initialNumToRender={3}
        windowSize={3}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/artist/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open artist ${item.name}`}
            style={({ pressed }) => ({ width: ARTIST, alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}
          >
            <Avatar url={item.avatarUrl} name={item.name} size={ARTIST} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: ARTIST }}>
              <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'center' }}>
                {item.name}
              </Text>
              {item.verification === 'verified' ? <VerifiedBadge size={14} /> : null}
            </View>
            <Text variant="caption" color="textSecondary" style={{ marginTop: -6 }}>
              Artist
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

/** Covers of albums, EPs and singles. Tapping one opens the album's page. */
export function AlbumShelf({ title, albums }: { title: string; albums: Album[] | undefined }) {
  const router = useRouter();
  if (!albums || albums.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <Text variant="title" accessibilityRole="header" style={{ paddingHorizontal: 20 }}>
        {title}
      </Text>
      <FlatList
        horizontal
        data={albums}
        keyExtractor={(a) => a.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        getItemLayout={(_, index) => ({ length: STRIDE, offset: 20 + STRIDE * index, index })}
        initialNumToRender={3}
        windowSize={3}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/album/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open album ${item.title} by ${item.artistName}`}
            style={({ pressed }) => ({ width: CARD, gap: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <Artwork id={item.id} logoUrl={item.artworkUrl} size={CARD} />
            <View style={{ gap: 1 }}>
              <Text variant="headline" numberOfLines={1}>
                {item.title}
              </Text>
              <ArtistName
                name={item.artistName}
                verified={item.artistVerified}
                prefix={`${item.type === 'single' ? 'Single' : item.type === 'ep' ? 'EP' : 'Album'}${item.artistName ? ' ·' : ''}`}
              />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

/** Covers of playlists, with who made them. Tapping one opens the playlist's page. */
export function PlaylistShelf({
  title,
  playlists,
  onSeeAll,
}: {
  title: string;
  playlists: Playlist[] | undefined;
  /** When set, a "See all" link shows next to the title. */
  onSeeAll?: () => void;
}) {
  const router = useRouter();
  if (!playlists || playlists.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={10} accessibilityRole="button" accessibilityLabel={`See all in ${title}`}>
            <Text variant="bodyStrong" color="accent">
              See all
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={playlists}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        getItemLayout={(_, index) => ({ length: STRIDE, offset: 20 + STRIDE * index, index })}
        initialNumToRender={3}
        windowSize={3}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open playlist ${item.name}`}
            style={({ pressed }) => ({ width: CARD, gap: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <PlaylistCover playlist={item} size={CARD} />
            <View style={{ gap: 1 }}>
              <Text variant="headline" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {item.ownerName ? `By ${item.ownerName}` : `${item.trackCount} ${item.trackCount === 1 ? 'song' : 'songs'}`}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
