import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { playQueue } from '@/audio/music/musicEngine';
import type { PlaybackSource } from '@/audio/music/source';
import { BadgeCheck } from 'lucide-react-native';
import type { Album, Artist, Playlist, Podcast, Track } from '@/domain/types';
import { useTheme } from '@/theme';
import { Artwork } from './Artwork';
import { Avatar } from './Avatar';
import { PlaylistCover } from './PlaylistCover';
import { Text } from './Text';

const CARD = 140;
const STRIDE = CARD + 14;

/** A titled horizontal row of covers. Tapping one plays the whole row from that song. */
export function MusicShelf({ title, tracks, source }: { title: string; tracks: Track[] | undefined; source?: PlaybackSource }) {
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
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => playQueue(tracks, index, { source })}
            accessibilityRole="button"
            accessibilityLabel={`Play ${item.title} by ${item.artistName}`}
            style={({ pressed }) => ({ width: CARD, gap: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <Artwork id={item.id} logoUrl={item.artworkUrl} size={CARD} />
            <View style={{ gap: 1 }}>
              <Text variant="headline" numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {item.artistName}
              </Text>
            </View>
          </Pressable>
        )}
      />
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
  const { colors } = useTheme();
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
              {item.verification === 'verified' ? <BadgeCheck size={14} color={colors.accent} /> : null}
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
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {[item.type === 'single' ? 'Single' : item.type === 'ep' ? 'EP' : 'Album', item.artistName].filter(Boolean).join(' · ')}
              </Text>
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
