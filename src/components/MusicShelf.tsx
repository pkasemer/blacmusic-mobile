import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MoreList } from '@/domain/more';
import type { Album, Artist, Playlist, Podcast } from '@/domain/types';
import { VerifiedBadge } from './VerifiedBadge';
import { ArtistName } from './ArtistName';
import { Artwork } from './Artwork';
import { Avatar } from './Avatar';
import { PlaylistCover } from './PlaylistCover';
import { Text } from './Text';

const CARD = 140;
const STRIDE = CARD + 14;

/** Where a section's "More" link goes. */
export interface ShelfMore {
  list: MoreList;
  /** The artist, album or playlist group the list belongs to. */
  ref?: string;
}

/** A section's title with "More" on the right, which opens the whole list. */
function ShelfHeader({ title, more }: { title: string; more?: ShelfMore }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 }}>
      <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {more ? (
        <Pressable
          onPress={() => router.push({ pathname: '/more/[list]', params: { list: more.list, title, ...(more.ref ? { ref: more.ref } : null) } })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`More ${title}`}
        >
          <Text variant="bodyStrong" color="accent">
            More
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Horizontal row of podcast covers; tapping one opens its episode list. */
export function PodcastShelf({ podcasts, more }: { podcasts: Podcast[] | undefined; more?: ShelfMore }) {
  const router = useRouter();
  if (!podcasts || podcasts.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <ShelfHeader title="Podcasts" more={more} />
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
export function ArtistShelf({ title, artists, more }: { title: string; artists: Artist[] | undefined; more?: ShelfMore }) {
  const router = useRouter();
  if (!artists || artists.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <ShelfHeader title={title} more={more} />
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
export function AlbumShelf({ title, albums, more }: { title: string; albums: Album[] | undefined; more?: ShelfMore }) {
  const router = useRouter();
  if (!albums || albums.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <ShelfHeader title={title} more={more} />
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
  more,
}: {
  title: string;
  playlists: Playlist[] | undefined;
  more?: ShelfMore;
}) {
  const router = useRouter();
  if (!playlists || playlists.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      <ShelfHeader title={title} more={more} />
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
