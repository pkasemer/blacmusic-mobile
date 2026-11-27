import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SongArtistsSheet } from '@/components/SongArtistsSheet';
import { artistsOf, featuredSuffix, releaseLine, releaseWithFeatures } from '@/domain/artists';
import { useAlbum, useRelatedAlbums } from '@/api/blac/queries';
import { useReleaseCredits } from '@/api/blac/credits';
import { CreditsSection } from '@/components/CreditsSection';
import { AlbumShelf } from '@/components/MusicShelf';
import { playQueue } from '@/audio/music/musicEngine';
import { Artwork } from '@/components/Artwork';
import { DetailHero, HeroCover, HeroMeta, HeroTitle, useHeroCoverSize, useHeroScroll } from '@/components/DetailHero';
import { DownloadAllButton, ShareLinkButton } from '@/components/CollectionActions';
import { DetailActions } from '@/components/DetailActions';
import { ScreenState } from '@/components/ScreenState';
import { ArtistName } from '@/components/ArtistName';
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
  const related = useRelatedAlbums(query.data?.album);
  const credits = useReleaseCredits(id);
  const [showingArtists, setShowingArtists] = useState(false);
  const cover = useHeroCoverSize();

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

  const { tracks } = data;
  const album = releaseWithFeatures(data.album, tracks);
  const kind = album.type === 'single' ? 'Single' : album.type === 'ep' ? 'EP' : 'Album';
  const totalSec = tracks.reduce((sum, t) => sum + t.durationSec, 0);
  const released = formatDate(album.releaseDate);
  const meta = [kind, album.genre, released ?? yearOf(album.releaseDate), `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`, tracks.length > 0 ? formatTotalLength(totalSec) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <TabScreen>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: colors.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <DetailHero scrollY={scrollY} artwork={{ id: album.id, logoUrl: album.artworkUrl }}>
          <HeroCover size={cover}>
            <Artwork id={album.id} logoUrl={album.artworkLargeUrl ?? album.artworkUrl} size={cover} />
          </HeroCover>
          <HeroTitle>{album.title}</HeroTitle>
          {artistsOf(album).some((x) => x.id) ? (
            <Pressable onPress={() => setShowingArtists(true)} accessibilityRole="button" accessibilityLabel={`${releaseLine(album)}. Show artists`} hitSlop={8} style={{ maxWidth: '100%', paddingHorizontal: 24 }}>
              <ArtistName name={album.artistName} verified={album.artistVerified} others={featuredSuffix(album)} variant="body" color="accent" style={{ justifyContent: 'center' }} textStyle={{ fontWeight: '600' }} />
            </Pressable>
          ) : (
            <ArtistName name={album.artistName} verified={album.artistVerified} others={featuredSuffix(album)} variant="body" color="textSecondary" style={{ justifyContent: 'center' }} />
          )}
          <HeroMeta>{meta}</HeroMeta>
          {album.description ? (
            <Text variant="caption" color="textSecondary" numberOfLines={3} style={{ textAlign: 'center', paddingHorizontal: 12 }}>
              {album.description}
            </Text>
          ) : null}
        </DetailHero>

        <DetailActions
          items={tracks}
          source={{ type: 'album', id: album.id, name: album.title }}
          tools={
            <>
              <DownloadAllButton tracks={tracks} what={album.type === 'single' ? 'single' : 'album'} />
              <ShareLinkButton
                label={`Share ${album.title}`}
                message={`Listen to the ${album.type === 'single' ? 'single' : 'album'} "${album.title}" by ${releaseLine(album)} on Blac`}
                path={`/album/${album.id}`}
              />
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

        <CreditsSection credits={credits.data} perTrack />

        <AlbumShelf title="Related releases" albums={related.data} more={{ list: 'related-albums', ref: album.id }} />
      </Animated.ScrollView>
      {menu.sheet}
      <SongArtistsSheet track={showingArtists ? album : null} onClose={() => setShowingArtists(false)} onOpen={(artistId) => router.push({ pathname: '/artist/[id]', params: { id: artistId } })} />
    </TabScreen>
  );
}
