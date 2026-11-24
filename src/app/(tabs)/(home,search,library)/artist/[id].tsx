import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck } from 'lucide-react-native';
import { blacApi } from '@/api/blac';
import { musicKeys, useArtist, useArtistAlbums, useArtistTracks } from '@/api/blac/queries';
import { queryClient } from '@/api/queryClient';
import type { Artist } from '@/domain/types';
import { useArtistStore } from '@/store/artistStore';
import { haptics } from '@/utils/haptics';
import { playQueue } from '@/audio/music/musicEngine';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { DetailHero, useHeroScroll } from '@/components/DetailHero';
import { AlbumShelf } from '@/components/MusicShelf';
import { PlayAllBar } from '@/components/PlayAllBar';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { TrackRow } from '@/components/TrackRow';
import { TabScreen } from '@/components/TabScreen';
import { radius, useTheme } from '@/theme';
import { formatCount } from '@/utils/format';

const POPULAR_SHOWN = 5;

/** Follow / Following. The change shows at once; if the server refuses, it goes back and says so. */
function FollowButton({ artist }: { artist: Artist }) {
  const { colors } = useTheme();
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
    } catch (e) {
      queryClient.setQueryData<Artist | null>(key, (a) => change(a, !next));
      haptics.error();
      Alert.alert(next ? "Couldn't follow" : "Couldn't unfollow", e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityState={{ selected: following }}
      accessibilityLabel={following ? `Following ${artist.name}. Tap to unfollow` : `Follow ${artist.name}`}
      style={({ pressed }) => ({
        paddingHorizontal: 22,
        paddingVertical: 9,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: following ? colors.borderStrong : colors.text,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="bodyStrong">{following ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

/** An artist's page: picture, name, play buttons, popular songs, albums and a short bio. */
export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeroScroll();
  const artist = useArtist(id);
  const popular = useArtistTracks(id);
  const albums = useArtistAlbums(id);
  const [showAll, setShowAll] = useState(false);
  const ownArtistId = useArtistStore((s) => s.profile?.id);

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
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <DetailHero scrollY={scrollY} artwork={{ id: data.id, logoUrl: data.avatarUrl }}>
          <Avatar url={data.avatarUrl} name={data.name} size={156} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
            <Text variant="display" numberOfLines={2} style={{ textAlign: 'center', flexShrink: 1 }}>
              {data.name}
            </Text>
            {data.verification === 'verified' ? <BadgeCheck size={22} color={colors.accent} /> : null}
          </View>
          {stats.length > 0 ? (
            <Text variant="caption" color="textSecondary">
              {stats.join(' · ')}
            </Text>
          ) : null}
          {data.id !== ownArtistId ? <FollowButton artist={data} /> : null}
        </DetailHero>

        <PlayAllBar items={tracks} source={{ type: 'artist', id: data.id, name: data.name }} />

        {tracks.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text variant="title" style={{ paddingHorizontal: 20 }}>
              Popular
            </Text>
            <View>
              {visible.map((track, i) => (
                <TrackRow key={track.id} item={track} index={i + 1} onPress={() => playQueue(tracks, i, { source: { type: 'artist', id: data.id, name: data.name } })} separator={i < visible.length - 1} />
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

        <AlbumShelf title="Albums and singles" albums={albums.data} />

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
    </TabScreen>
  );
}
