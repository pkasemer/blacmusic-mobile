import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Disc3, Ellipsis, ListPlus, UserRound } from 'lucide-react-native';
import { useArtistTracks, useTrack } from '@/api/blac/queries';
import { useTrackCredits } from '@/api/blac/credits';
import { CreditsSection } from '@/components/CreditsSection';
import { playQueue } from '@/audio/music/musicEngine';
import { formatTime } from '@/audio/music/queue';
import { Artwork } from '@/components/Artwork';
import { Card } from '@/components/Card';
import { DownloadAllButton } from '@/components/CollectionActions';
import { Chip } from '@/components/Chip';
import { DetailHero, HeroCover, HeroMeta, HeroTitle, useHeroCoverSize, useHeroScroll } from '@/components/DetailHero';
import { FavouriteButton } from '@/components/FavouriteButton';
import { DetailActions, RoundButton } from '@/components/DetailActions';
import { AddToPlaylistSheet } from '@/components/PlaylistSheets';
import { ScreenState } from '@/components/ScreenState';
import { ArtistName } from '@/components/ArtistName';
import { Text } from '@/components/Text';
import { TrackRow } from '@/components/TrackRow';
import { useTrackMenu } from '@/components/TrackActionSheet';
import { TabScreen } from '@/components/TabScreen';
import { useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text variant="body" color="textSecondary">
        {label}
      </Text>
      <Text variant="body" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function LinkRow({ icon, label, detail, onPress, last }: { icon: React.ReactNode; label: string; detail: string; onPress: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${detail}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        <Text variant="bodyStrong" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

/** A song's page: cover, who made it, a big Play button, its facts, links to the album and artist, and more from the artist. */
export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeroScroll();
  const router = useRouter();
  const query = useTrack(id);
  const track = query.data;
  const more = useArtistTracks(track?.artistId ?? '');
  const cover = useHeroCoverSize();
  const [adding, setAdding] = useState(false);
  const credits = useTrackCredits(id);
  const menu = useTrackMenu();

  if (query.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!track) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title="Couldn't open this song"
          message="It may have been removed, or you may be offline."
          actionLabel="Try again"
          onAction={() => void query.refetch()}
        />
      </View>
    );
  }

  const others = (more.data ?? []).filter((t) => t.id !== track.id);
  const released = formatDate(track.releaseDate);

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
        <DetailHero scrollY={scrollY} artwork={{ id: track.id, logoUrl: track.artworkUrl }}>
          <HeroCover size={cover}>
            <Artwork id={track.id} logoUrl={track.artworkLargeUrl ?? track.artworkUrl} size={cover} />
          </HeroCover>
          <HeroTitle>{track.title}</HeroTitle>
          {track.artistId ? (
            <Pressable
              onPress={() => router.push({ pathname: '/artist/[id]', params: { id: track.artistId } })}
              accessibilityRole="button"
              accessibilityLabel={`Open artist ${track.artistName}`}
              hitSlop={8}
            >
              <ArtistName name={track.artistName} verified={track.artistVerified} variant="body" color="accent" style={{ justifyContent: 'center' }} textStyle={{ fontWeight: '600' }} />
            </Pressable>
          ) : (
            <ArtistName name={track.artistName} verified={track.artistVerified} variant="body" color="textSecondary" style={{ justifyContent: 'center' }} />
          )}
          <HeroMeta>{[track.albumTitle, track.genre, formatTime(track.durationSec)].filter(Boolean).join(' · ')}</HeroMeta>
          {track.explicit ? <Chip label="Explicit" glass /> : null}
        </DetailHero>

        <DetailActions
          items={[track, ...others]}
          source={{ type: 'song', id: track.id, name: track.title }}
          currentId={track.id}
          tools={
            <>
              <FavouriteButton itemId={track.id} variant="round" />
              {track.preview ? null : (
                <RoundButton label="Add to playlist" onPress={() => setAdding(true)}>
                  <ListPlus size={20} color={colors.text} />
                </RoundButton>
              )}
              <DownloadAllButton tracks={[track]} what="song" />
              {/* The rest (add to queue, share, radio, the artist) is in the same menu every song row has. */}
              {track.preview ? null : (
                <RoundButton label="More options, including add to queue and share" onPress={() => menu.open(track)}>
                  <Ellipsis size={20} color={colors.text} />
                </RoundButton>
              )}
            </>
          }
        />

        <View style={{ gap: 12, paddingHorizontal: 20 }}>
          <Text variant="title">Details</Text>
          <Card style={{ paddingHorizontal: 16 }}>
            {track.releaseId ? (
              <LinkRow
                icon={<Disc3 size={20} color={colors.accent} />}
                label="Album"
                detail={track.albumTitle ?? 'View album'}
                onPress={() => router.push({ pathname: '/album/[id]', params: { id: track.releaseId as string } })}
              />
            ) : null}
            {track.artistId ? (
              <LinkRow
                icon={<UserRound size={20} color={colors.accent} />}
                label="Artist"
                detail={track.artistName}
                onPress={() => router.push({ pathname: '/artist/[id]', params: { id: track.artistId } })}
              />
            ) : null}
            <InfoRow label="Length" value={formatTime(track.durationSec)} last={!track.genre && !released} />
            {track.genre ? <InfoRow label="Genre" value={track.genre} last={!released} /> : null}
            {released ? <InfoRow label="Released" value={released} last /> : null}
          </Card>
        </View>

        <CreditsSection credits={credits.data} />

        {others.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text variant="title" style={{ paddingHorizontal: 20 }}>
              More from {track.artistName}
            </Text>
            <View>
              {others.slice(0, 5).map((t, i, list) => (
                <TrackRow key={t.id} item={t} onPress={() => playQueue(others, i, { source: { type: 'artist', id: track.artistId, name: track.artistName } })} onMore={() => menu.open(t)} separator={i < list.length - 1} />
              ))}
            </View>
          </View>
        ) : null}
      </Animated.ScrollView>
      <AddToPlaylistSheet track={adding ? track : null} onClose={() => setAdding(false)} />
      {menu.sheet}
    </TabScreen>
  );
}
