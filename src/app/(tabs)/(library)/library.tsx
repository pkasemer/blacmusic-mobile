import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownToLine, Globe, Heart, ListMusic, Lock, Plus, Trash2, X } from 'lucide-react-native';
import { useMyPlaylists, usePlayables } from '@/api/blac/queries';
import { playQueue } from '@/audio/music/musicEngine';
import { formatBytes } from '@/cache/imageCache';
import { GradientCard } from '@/components/GradientCard';
import { PlayAllBar } from '@/components/PlayAllBar';
import { PlaylistCover } from '@/components/PlaylistCover';
import { PlaylistFormSheet } from '@/components/PlaylistSheets';
import { ScreenState } from '@/components/ScreenState';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { TrackRow } from '@/components/TrackRow';
import type { DownloadItem, Playlist } from '@/domain/types';
import { cancelDownload, removeAllDownloads, retryDownload } from '@/offline/downloads';
import { useDownloadStore } from '@/store/downloadStore';
import { useFavouritesStore } from '@/store/favouritesStore';
import { refreshMusic, usePullToRefresh } from '@/hooks/usePullToRefresh';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { topInset } from '@/utils/platform';

type Segment = 'favourites' | 'playlists' | 'downloads';

/** One of your playlists: cover, name, whether it is private, and how many songs. */
function PlaylistRow({ playlist, onPress }: { playlist: Playlist; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open playlist ${playlist.name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 72,
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
      })}
    >
      <PlaylistCover playlist={playlist} size={56} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="headline" numberOfLines={1}>
          {playlist.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {playlist.isPublic ? <Globe size={12} color={colors.textTertiary} /> : <Lock size={12} color={colors.textTertiary} />}
          <Text variant="caption" color="textSecondary">
            {playlist.isPublic ? 'Public' : 'Private'} · {playlist.trackCount} {playlist.trackCount === 1 ? 'song' : 'songs'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function DownloadRow({ entry, onPlay }: { entry: DownloadItem; onPlay: () => void }) {
  const { colors } = useTheme();
  const status =
    entry.state === 'done'
      ? entry.sizeBytes
        ? formatBytes(entry.sizeBytes)
        : 'Downloaded'
      : entry.state === 'failed'
        ? 'Failed · tap to retry'
        : `${Math.round(entry.progress * 100)}%`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <TrackRow
          item={entry.item}
          detail={status}
          detailTone={entry.state === 'failed' ? 'danger' : 'normal'}
          onPress={() => {
            if (entry.state === 'done') onPlay();
            else if (entry.state === 'failed') retryDownload(entry.id);
          }}
        />
      </View>
      <Pressable
        onPress={() => cancelDownload(entry.id)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Remove download ${entry.item.title}`}
        style={{ position: 'absolute', right: 20, top: 0, bottom: 0, justifyContent: 'center', backgroundColor: colors.bg, paddingLeft: 10 }}
      >
        <X size={18} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const refreshControl = usePullToRefresh(refreshMusic);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const myPlaylists = useMyPlaylists();
  const [segment, setSegment] = useState<Segment>('favourites');
  const favouriteIds = useFavouritesStore((s) => s.ids);
  const favourites = usePlayables(favouriteIds);
  const downloads = useDownloadStore((s) => s.items);

  const favouriteItems = useMemo(() => {
    const byId = new Map((favourites.data ?? []).map((p) => [p.id, p]));
    return favouriteIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [favourites.data, favouriteIds]);

  const downloadEntries = useMemo(() => Object.values(downloads).sort((a, b) => b.addedAt - a.addedAt), [downloads]);
  const doneEntries = useMemo(() => downloadEntries.filter((d) => d.state === 'done'), [downloadEntries]);
  const playableDownloads = useMemo(() => doneEntries.map((d) => d.item), [doneEntries]);
  const usedBytes = doneEntries.reduce((sum, d) => sum + (d.sizeBytes ?? 0), 0);

  const confirmRemoveAll = () => {
    haptics.warning();
    Alert.alert('Remove all downloads?', 'Songs and episodes you saved for offline will be deleted from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove all', style: 'destructive', onPress: removeAllDownloads },
    ]);
  };

  const playlistCount = myPlaylists.data?.length ?? 0;
  const pick = (next: Segment) => {
    haptics.select();
    setSegment(next);
  };

  const header = (
    <View style={{ gap: 16, paddingBottom: 12 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Text variant="display" accessibilityRole="header">
          Library
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
        <GradientCard
          Icon={Heart}
          title="Likes"
          subtitle={`${favouriteIds.length} ${favouriteIds.length === 1 ? 'song' : 'songs'}`}
          selected={segment === 'favourites'}
          onPress={() => pick('favourites')}
        />
        <GradientCard
          Icon={ListMusic}
          title="Playlists"
          subtitle={`${playlistCount} ${playlistCount === 1 ? 'playlist' : 'playlists'}`}
          selected={segment === 'playlists'}
          onPress={() => pick('playlists')}
        />
        <GradientCard
          Icon={ArrowDownToLine}
          title="Downloads"
          subtitle={`${doneEntries.length} saved`}
          selected={segment === 'downloads'}
          onPress={() => pick('downloads')}
        />
      </View>
      {segment === 'downloads' && downloadEntries.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <Text variant="caption" color="textSecondary">
            {doneEntries.length} saved{usedBytes > 0 ? ` · ${formatBytes(usedBytes)}` : ''}
          </Text>
          <Pressable
            onPress={confirmRemoveAll}
            hitSlop={10}
            accessibilityRole="button"
            style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}
          >
            <Trash2 size={14} color={colors.danger} />
            <Text variant="caption" color="danger">
              Remove all
            </Text>
          </Pressable>
        </View>
      ) : null}
      {segment === 'playlists' ? (
        <View style={{ paddingHorizontal: 20 }}>
          <Pressable
            onPress={() => {
              haptics.select();
              setCreating(true);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 13,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Plus size={18} color={colors.onPrimary} />
            <Text variant="bodyStrong" color="onPrimary">
              New playlist
            </Text>
          </Pressable>
        </View>
      ) : (
        <PlayAllBar
          items={segment === 'favourites' ? favouriteItems : playableDownloads}
          source={segment === 'favourites' ? { type: 'favourites' } : { type: 'downloads' }}
        />
      )}
    </View>
  );

  const contentStyle = { paddingTop: topInset(insets.top) + 12, paddingBottom: 28 };

  return (
    <TabScreen>
      <PlaylistFormSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onDone={(created) => router.push({ pathname: '/playlist/[id]', params: { id: created.id } })}
      />
      {segment === 'playlists' ? (
        <FlatList
          data={myPlaylists.data ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PlaylistRow playlist={item} onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })} />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            myPlaylists.isPending ? (
              <ActivityIndicator color={colors.accent} style={{ paddingVertical: 24 }} />
            ) : myPlaylists.isError ? (
              <ScreenState kind="error" title="Can't load your playlists" message="Check your connection and try again." actionLabel="Retry" onAction={() => void myPlaylists.refetch()} />
            ) : (
              <ScreenState kind="empty" title="No playlists yet" message="Make a playlist, then add songs to it from the menu on any song." />
            )
          }
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={contentStyle}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      ) : segment === 'favourites' ? (
        <FlatList
          data={favouriteItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <TrackRow item={item} onPress={() => playQueue(favouriteItems, index, { source: { type: 'favourites' } })} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            favourites.isPending && favouriteIds.length > 0 ? undefined : (
              <ScreenState kind="empty" title="No likes yet" message="Tap the heart on a song or episode to keep it here." />
            )
          }
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={contentStyle}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={downloadEntries}
          keyExtractor={(entry) => entry.id}
          renderItem={({ item }) => (
            <DownloadRow
              entry={item}
              onPlay={() =>
                playQueue(
                  playableDownloads,
                  Math.max(
                    0,
                    playableDownloads.findIndex((p) => p.id === item.id),
                  ),
                  { source: { type: 'downloads' } },
                )
              }
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <ScreenState
              kind="empty"
              title="Nothing saved offline"
              message="Songs and episodes you download will play here without a connection."
            />
          }
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={contentStyle}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      )}
    </TabScreen>
  );
}
