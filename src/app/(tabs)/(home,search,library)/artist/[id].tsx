import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { blacApi } from '@/api/blac';
import { musicKeys, useArtist, useArtistAlbums, useArtistTracks, useRelatedArtists } from '@/api/blac/queries';
import { queryClient } from '@/api/queryClient';
import type { Album, Artist, Track } from '@/domain/types';
import { useArtistStore } from '@/store/artistStore';
import { haptics } from '@/utils/haptics';
import { playQueue } from '@/audio/music/musicEngine';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { DetailHero, HeroCover, HeroMeta, useHeroCoverSize, useHeroScroll } from '@/components/DetailHero';
import { AlbumShelf, ArtistShelf } from '@/components/MusicShelf';
import { ShareLinkButton } from '@/components/CollectionActions';
import { UserCheck, UserPlus } from 'lucide-react-native';
import { ActionButton, DetailActions, useSecondaryButton } from '@/components/DetailActions';
import { LatestRelease } from '@/components/LatestRelease';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { TrackRow } from '@/components/TrackRow';
import { useTrackMenu } from '@/components/TrackActionSheet';
import { TabScreen } from '@/components/TabScreen';
import { useTheme } from '@/theme';
import { formatCount } from '@/utils/format';

const POPULAR_SHOWN = 5;

/**
 * The releases with the most popular songs first. The server lists releases newest first but ranks songs by how often
 * they are saved, so a release takes the place of its best song; the others follow, newest first.
 */
function byPopularity(albums: Album[] | undefined, popular: Track[]) {
  const rank = (a: Album) => {
    const place = popular.findIndex((t) => t.releaseId === a.id);
    return place < 0 ? popular.length : place;
  };
  return albums ? [...albums].sort((a, b) => rank(a) - rank(b)) : albums;
}

/** Follow / Following. The change shows at once; if the server refuses, it goes back and says so. */
function FollowButton({ artist }: { artist: Artist }) {
  const button = useSecondaryButton();
  const key = musicKeys.artist(artist.id);
  const following = artist.following === true;

  const toggle = async () => {
    const next = !following;
    const change = (a: Artist | null | undefined, on: boolean) =>
      a ? { ...a, following: on, followerCount: Math.max(0, (a.followerCount ?? 0) + (on ? 1 : -1)) } : a;
    haptics.select();
    queryClient.setQueryData<Artist | null>(key, (a) => change(a, next));
    try {
      await blacApi.setFollowing(artist.id, next);
      // Home's New releases shows only followed artists.
      void queryClient.invalidateQueries({ queryKey: musicKeys.followedReleases });
    } catch (e) {
      queryClient.setQueryData<Artist | null>(key, (a) => change(a, !next));
      haptics.error();
      Alert.alert(next ? "Couldn't follow" : "Couldn't unfollow", e instanceof Error ? e.message : 'Try again.');
    }
  };

  const Icon = following ? UserCheck : UserPlus;
  return (
    <ActionButton
      label={following ? 'Following' : 'Follow'}
      hint={following ? `Following ${artist.name}. Tap to unfollow` : `Follow ${artist.name}`}
      active={following}
      onPress={() => void toggle()}
      icon={<Icon size={18} color={following ? button.accent : button.ink} />}
    />
  );
}

/** An artist's page: picture, name, follow and play buttons, popular songs, albums and a short bio. */
export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeroScroll();
  const artist = useArtist(id);
  const popular = useArtistTracks(id);
  const albums = useArtistAlbums(id);
  const related = useRelatedArtists(id);
  const cover = useHeroCoverSize(260);
  const [showAll, setShowAll] = useState(false);
  const ownArtistId = useArtistStore((s) => s.profile?.id);
  const menu = useTrackMenu();

  if (artist.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const data = artist.data;
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title="Couldn't open this artist"
          message="They may have been removed, or you may be offline."
          actionLabel="Try again"
          onAction={() => void artist.refetch()}
        />
      </View>
    );
  }

  const tracks = popular.data ?? [];
  const visible = showAll ? tracks : tracks.slice(0, POPULAR_SHOWN);
  const stats = [
    data.followerCount !== undefined ? `${formatCount(data.followerCount)} ${data.followerCount === 1 ? 'follower' : 'followers'}` : null,
    data.releaseCount !== undefined ? `${data.releaseCount} ${data.releaseCount === 1 ? 'release' : 'releases'}` : null,
  ].filter(Boolean);

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
        <DetailHero scrollY={scrollY} artwork={{ id: data.id, logoUrl: data.avatarUrl }}>
          <HeroCover size={cover} round>
            <Avatar url={data.avatarLargeUrl ?? data.avatarUrl} name={data.name} size={cover} />
          </HeroCover>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%', marginTop: 6 }}>
            <Text variant="display" numberOfLines={2} style={{ fontSize: 30, lineHeight: 36, textAlign: 'center', flexShrink: 1 }}>
              {data.name}
            </Text>
            {data.verification === 'verified' ? <VerifiedBadge size={24} /> : null}
          </View>
          {stats.length > 0 ? <HeroMeta>{stats.join(' · ')}</HeroMeta> : null}
        </DetailHero>

        <DetailActions
          items={tracks}
          source={{ type: 'artist', id: data.id, name: data.name }}
          tools={
            <>
              {data.id !== ownArtistId ? <FollowButton artist={data} /> : null}
              <ShareLinkButton label={`Share ${data.name}`} message={`Listen to ${data.name} on Blac`} path={`/artist/${data.id}`} />
            </>
          }
        />

        {tracks.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text variant="title" style={{ paddingHorizontal: 20 }}>
              Popular
            </Text>
            <View>
              {visible.map((track, i) => (
                <TrackRow key={track.id} item={track} index={i + 1} onPress={() => playQueue(tracks, i, { source: { type: 'artist', id: data.id, name: data.name } })} onMore={() => menu.open(track)} separator={i < visible.length - 1} />
              ))}
            </View>
            {tracks.length > POPULAR_SHOWN ? (
              <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button" style={{ paddingHorizontal: 20, paddingVertical: 6 }}>
                <Text variant="bodyStrong" color="accent">
                  {showAll ? 'Show less' : `Show all ${tracks.length}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : popular.isPending ? (
          <ActivityIndicator color={colors.accent} />
        ) : null}

        <LatestRelease albums={albums.data} />

        <AlbumShelf title="Popular releases" albums={byPopularity(albums.data, tracks)} />

        <ArtistShelf title="Related artists" artists={related.data} />

        {data.bio ? (
          <View style={{ gap: 12, paddingHorizontal: 20 }}>
            <Text variant="title">About</Text>
            <Card style={{ padding: 16 }}>
              <Text variant="body" color="textSecondary">
                {data.bio}
              </Text>
            </Card>
          </View>
        ) : null}
      </Animated.ScrollView>
      {menu.sheet}
    </TabScreen>
  );
}
