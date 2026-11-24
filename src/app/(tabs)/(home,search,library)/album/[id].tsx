import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlbum } from '@/api/blac/queries';
import { playQueue } from '@/audio/music/musicEngine';
import { Artwork } from '@/components/Artwork';
import { Card } from '@/components/Card';
import { DetailHero, useHeroScroll } from '@/components/DetailHero';
import { DownloadAllButton, ShareLinkButton } from '@/components/CollectionActions';
import { PlayAllBar } from '@/components/PlayAllBar';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { TrackRow } from '@/components/TrackRow';
import { useTrackMenu } from '@/components/TrackActionSheet';
import { TabScreen } from '@/components/TabScreen';
import { useTheme } from '@/theme';
import { formatDate, formatTotalLength, yearOf } from '@/utils/format';

/** An album, EP or single: cover, who made it, play buttons, the track list and a few facts. */
export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeroScroll();
  const menu = useTrackMenu();
  const router = useRouter();
  const query = useAlbum(id);

  if (query.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const data = query.data;
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title="Couldn't open this album"
          message="It may have been removed, or you may be offline."
          actionLabel="Try again"
          onAction={() => void query.refetch()}
        />
      </View>
    );
  }

  const { album, tracks } = data;
  const kind = album.type === 'single' ? 'Single' : album.type === 'ep' ? 'EP' : 'Album';
  const totalSec = tracks.reduce((sum, t) => sum + t.durationSec, 0);
  const meta = [kind, yearOf(album.releaseDate), `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`, tracks.length > 0 ? formatTotalLength(totalSec) : null]
    .filter(Boolean)
    .join(' · ');
  const released = formatDate(album.releaseDate);

  return (
    <TabScreen>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: colors.bg }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <DetailHero scrollY={scrollY} artwork={{ id: album.id, logoUrl: album.artworkUrl }}>
          <Artwork id={album.id} logoUrl={album.artworkUrl} size={224} />
          <Text variant="title" numberOfLines={3} style={{ textAlign: 'center' }}>
            {album.title}
          </Text>
          {album.artistId ? (
            <Pressable
              onPress={() => router.push({ pathname: '/artist/[id]', params: { id: album.artistId } })}
              accessibilityRole="button"
              accessibilityLabel={`Open artist ${album.artistName}`}
              hitSlop={8}
            >
              <Text variant="bodyStrong">{album.artistName}</Text>
            </Pressable>
          ) : (
            <Text variant="bodyStrong">{album.artistName}</Text>
          )}
          <Text variant="caption" color="textSecondary">
            {meta}
          </Text>
        </DetailHero>

        <PlayAllBar
          items={tracks}
          source={{ type: 'album', id: album.id, name: album.title }}
          extra={
            <>
              <ShareLinkButton
                label={`Share ${album.title}`}
                message={`Listen to the ${album.type === 'single' ? 'single' : 'album'} "${album.title}" by ${album.artistName} on Blac`}
                path={`/album/${album.id}`}
              />
              <DownloadAllButton tracks={tracks} what={album.type === 'single' ? 'single' : 'album'} />
            </>
          }
        />

        <View>
          {tracks.map((track, i) => (
            <TrackRow
              key={track.id}
              item={track}
              index={i + 1}
              onPress={() => playQueue(tracks, i, { source: { type: 'album', id: album.id, name: album.title } })}
              onMore={() => menu.open(track)}
              separator={i < tracks.length - 1}
            />
          ))}
        </View>

        {album.description || album.genre || released ? (
          <View style={{ gap: 12, paddingHorizontal: 20 }}>
            <Text variant="title">About</Text>
            <Card style={{ padding: 16, gap: 8 }}>
              {album.description ? <Text variant="body">{album.description}</Text> : null}
              {album.genre ? (
                <Text variant="caption" color="accent">
                  {album.genre}
                </Text>
              ) : null}
              {released ? (
                <Text variant="caption" color="textSecondary">
                  Released {released}
                </Text>
              ) : null}
            </Card>
          </View>
        ) : null}
      </Animated.ScrollView>
      {menu.sheet}
    </TabScreen>
  );
}
