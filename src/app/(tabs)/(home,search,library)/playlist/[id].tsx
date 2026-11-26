import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pencil } from 'lucide-react-native';
import { blacApi } from '@/api/blac';
import { refreshPlaylistQueries } from '@/api/blac/playlistCache';
import { usePlaylist } from '@/api/blac/queries';
import { playQueue } from '@/audio/music/musicEngine';
import { DownloadAllButton, ShareLinkButton } from '@/components/CollectionActions';
import { DetailHero, HeroCover, HeroMeta, HeroTitle, useHeroCoverSize, useHeroScroll } from '@/components/DetailHero';
import { ActionPill, DetailActions, useSecondaryButton } from '@/components/DetailActions';
import { PlaylistCover } from '@/components/PlaylistCover';
import { PlaylistFormSheet } from '@/components/PlaylistSheets';
import { ScreenState } from '@/components/ScreenState';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { useTrackMenu } from '@/components/TrackActionSheet';
import { TrackRow } from '@/components/TrackRow';
import { useAuthStore } from '@/store/authStore';
import { showToast } from '@/store/toastStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { formatTotalLength } from '@/utils/format';

/** A playlist: cover, name, who made it, play buttons, and its songs. */
export default function PlaylistScreen() {
  const button = useSecondaryButton();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeroScroll();
  const menu = useTrackMenu();
  const router = useRouter();
  const me = useAuthStore((s) => s.user?.id);
  const [editing, setEditing] = useState(false);
  const query = usePlaylist(id);
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
          title="Couldn't open this playlist"
          message="It may be private or removed, or you may be offline."
          actionLabel="Try again"
          onAction={() => void query.refetch()}
        />
      </View>
    );
  }

  const { playlist, tracks, itemIds } = data;
  /** Your own playlist: you can edit it and take songs out. */
  const mine = !!me && playlist.ownerId === me;

  const removeAt = (index: number) => {
    const track = tracks[index];
    const itemId = itemIds[index];
    if (!track || !itemId) return;
    blacApi
      .removeFromPlaylist(playlist.id, itemId)
      .then(() => {
        refreshPlaylistQueries(playlist.id);
        showToast(`Removed from ${playlist.name}`);
      })
      .catch((e) => {
        haptics.error();
        Alert.alert("Couldn't remove it", e instanceof Error ? e.message : 'Try again.');
      });
  };
  const totalSec = tracks.reduce((sum, t) => sum + t.durationSec, 0);
  const meta = [
    playlist.ownerName ? `By ${playlist.ownerName}` : null,
    mine ? (playlist.isPublic ? 'Public' : 'Private') : null,
    `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`,
    tracks.length > 0 ? formatTotalLength(totalSec) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // The colours behind the page come from the first cover.
  const tintSource = playlist.artworkUrl ?? playlist.artworkUrls[0] ?? null;

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
        <DetailHero scrollY={scrollY} artwork={{ id: playlist.id, logoUrl: tintSource }}>
          <HeroCover size={cover}>
            <PlaylistCover playlist={{ ...playlist, artworkUrl: playlist.artworkLargeUrl ?? playlist.artworkUrl }} size={cover} />
          </HeroCover>
          <HeroTitle>{playlist.name}</HeroTitle>
          {playlist.description ? (
            <Text variant="body" color="textSecondary" numberOfLines={3} style={{ textAlign: 'center', paddingHorizontal: 8 }}>
              {playlist.description}
            </Text>
          ) : null}
          <HeroMeta>{meta}</HeroMeta>
        </DetailHero>

        <DetailActions
          items={tracks}
          source={{ type: 'playlist', id: playlist.id, name: playlist.name }}
          tools={
            <>
              <DownloadAllButton tracks={tracks} what="playlist" />
              <ShareLinkButton
                label={`Share ${playlist.name}`}
                message={`Listen to the playlist "${playlist.name}" on Blac`}
                path={`/playlist/${playlist.id}`}
              />
              {mine ? (
                <ActionPill
                  label="Edit"
                  hint="Edit this playlist"
                  icon={<Pencil size={17} color={button.ink} />}
                  onPress={() => {
                    haptics.select();
                    setEditing(true);
                  }}
                />
              ) : null}
            </>
          }
        />

        {tracks.length === 0 ? (
          <Text variant="body" color="textSecondary" style={{ paddingHorizontal: 20, textAlign: 'center' }}>
            {mine ? 'No songs yet. Open the ••• menu on any song and choose Add to playlist.' : 'This playlist has no songs yet.'}
          </Text>
        ) : (
          <View>
            {tracks.map((track, i) => (
              <TrackRow
                key={`${track.id}-${i}`}
                item={track}
                onPress={() => playQueue(tracks, i, { source: { type: 'playlist', id: playlist.id, name: playlist.name } })}
                onMore={() => menu.open(track, mine ? { onRemove: () => removeAt(i) } : undefined)}
                separator={i < tracks.length - 1}
              />
            ))}
          </View>
        )}
      </Animated.ScrollView>
      {menu.sheet}
      <PlaylistFormSheet visible={editing} onClose={() => setEditing(false)} playlist={playlist} onDeleted={() => router.back()} />
    </TabScreen>
  );
}
