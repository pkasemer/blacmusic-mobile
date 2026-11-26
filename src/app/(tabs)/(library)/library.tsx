import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownToLine, Globe, Heart, History, ListMusic, Lock, Play, Plus, Trash2, X, type LucideIcon } from 'lucide-react-native';
import { useMyPlaylists, usePlayables } from '@/api/blac/queries';
import { playQueue } from '@/audio/music/musicEngine';
import { formatBytes } from '@/cache/imageCache';
import { Artwork } from '@/components/Artwork';
import { GradientCard, GradientSurface } from '@/components/GradientCard';
import { PlayAllBar } from '@/components/PlayAllBar';
import { PlaylistCover } from '@/components/PlaylistCover';
import { PlaylistFormSheet } from '@/components/PlaylistSheets';
import { ScreenState } from '@/components/ScreenState';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { TrackRow } from '@/components/TrackRow';
import { useTrackMenu } from '@/components/TrackActionSheet';
import type { DownloadItem, Playable, Playlist } from '@/domain/types';
import { cancelDownload, removeAllDownloads, retryDownload } from '@/offline/downloads';
import { useDownloadStore } from '@/store/downloadStore';
import { useFavouritesStore } from '@/store/favouritesStore';
import { useHistoryStore } from '@/store/historyStore';
import { useLibraryStore, type LibrarySection } from '@/store/libraryStore';
import { refreshMusic, usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { topInset } from '@/utils/platform';

/** A wide card for a list of songs (likes, recently played): its first covers stacked, how many, and a Play button. */
function SongsCard({
  title,
  Icon,
  items,
  detail,
  playLabel,
  selected,
  onPress,
  onPlay,
}: {
  title: string;
  /** Shown while there are no covers. */
  Icon: LucideIcon;
  items: Playable[];
  detail: string;
  playLabel: string;
  selected: boolean;
  onPress: () => void;
  onPlay: () => void;
}) {
  const { colors } = useTheme();
  const covers = items.slice(0, 3);
  return (
    <GradientSurface selected={selected} onPress={onPress} label={`${title}, ${detail}`} style={{ height: 88, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16 }}>
      <View style={{ width: covers.length > 0 ? 62 + (covers.length - 1) * 26 : 62, height: 72, justifyContent: 'center' }}>
        {covers.length > 0 ? (
          covers.map((t, i) => (
            <View
              key={t.id}
              style={{
                position: 'absolute',
                left: i * 26,
                top: 5 + i * 0,
                zIndex: 3 - i,
                borderRadius: 9,
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                opacity: 1 - i * 0.12,
              }}
            >
              <Artwork id={t.id} logoUrl={t.artworkUrl} size={62 - i * 6} />
            </View>
          ))
        ) : (
          <Icon size={34} color={colors.text} strokeWidth={1.8} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {items.length > 0 ? (
        <Pressable
          onPress={() => {
            haptics.select();
            onPlay();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={playLabel}
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text, opacity: pressed ? 0.8 : 1 })}
        >
          <Play size={20} color={colors.bg} fill={colors.bg} strokeWidth={0} style={{ marginLeft: 2 }} />
        </Pressable>
      ) : null}
    </GradientSurface>
  );
}

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

function DownloadRow({ entry, onPlay, onMore }: { entry: DownloadItem; onPlay: () => void; onMore?: () => void }) {
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
          onMore={onMore}
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
        style={{ alignSelf: 'stretch', justifyContent: 'center', paddingRight: 20 }}
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
  const segment = useLibraryStore((s) => s.section);
  const showSection = useLibraryStore((s) => s.show);
  const favouriteIds = useFavouritesStore((s) => s.ids);
  const favourites = usePlayables(favouriteIds);
  const downloads = useDownloadStore((s) => s.items);
  // Recently played is saved as ids, newest first; look them up to get the songs back.
  const historyKey = useHistoryStore((s) => s.entries.map((e) => e.itemId).join(','));
  const recentIds = useMemo(() => (historyKey ? historyKey.split(',') : []), [historyKey]);
  const recent = usePlayables(recentIds);
  const recentItems = useMemo(() => {
    const byId = new Map((recent.data ?? []).map((p) => [p.id, p]));
    return recentIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [recent.data, recentIds]);
  const menu = useTrackMenu();
  /** The song menu (with "Add to queue") for a row; podcast episodes have none. */
  const trackMenuFor = (item: Playable) => (item.kind === 'track' ? () => menu.open(item) : undefined);

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
  const pick = (next: LibrarySection) => {
    haptics.select();
    showSection(next);
  };
  const countOf = (n: number, items: Playable[]) => {
    const word = items.some((p) => p.kind !== 'track') ? 'item' : 'song';
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  };
  const songList = segment === 'recent' ? recentItems : favouriteItems;

  const header = (
    <View style={{ gap: 16, paddingBottom: 12 }}>
      {/* Title, with a round button to make a new playlist */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <Text variant="display" accessibilityRole="header">
          Library
        </Text>
        <Pressable
          onPress={() => {
            haptics.select();
            setCreating(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="New playlist"
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 })}
        >
          <Plus size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Likes and Recently played get wide cards; Playlists and Downloads share the row under them */}
      <View style={{ gap: 10, paddingHorizontal: 16 }}>
        <SongsCard
          title="Likes"
          Icon={Heart}
          items={favouriteItems}
          detail={countOf(favouriteIds.length, favouriteItems)}
          playLabel="Play your likes"
          selected={segment === 'favourites'}
          onPress={() => pick('favourites')}
          onPlay={() => playQueue(favouriteItems, 0, { source: { type: 'favourites' } })}
        />
        <SongsCard
          title="Recently played"
          Icon={History}
          items={recentItems}
          detail={countOf(recentIds.length, recentItems)}
          playLabel="Play what you played recently"
          selected={segment === 'recent'}
          onPress={() => pick('recent')}
          onPlay={() => playQueue(recentItems, 0, { source: { type: 'recent' } })}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
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
      </View>

      {/* Which list is open */}
      <View style={{ paddingHorizontal: 20 }}>
        <Text variant="title">
          {segment === 'favourites' ? 'Liked songs' : segment === 'recent' ? 'Recently played' : segment === 'playlists' ? 'Your playlists' : 'Downloaded'}
        </Text>
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
      {segment === 'playlists' ? null : (
        <PlayAllBar
          items={segment === 'downloads' ? playableDownloads : songList}
          source={{ type: segment }}
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
      {menu.sheet}
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
      ) : segment === 'favourites' || segment === 'recent' ? (
        <FlatList
          // Each list starts at its own top.
          key={segment}
          data={songList}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TrackRow item={item} onPress={() => playQueue(songList, index, { source: { type: segment } })} onMore={trackMenuFor(item)} />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            segment === 'recent' ? (
              recent.isPending && recentIds.length > 0 ? undefined : (
                <ScreenState kind="empty" title="Nothing played yet" message="Songs and episodes you play will show up here." />
              )
            ) : favourites.isPending && favouriteIds.length > 0 ? undefined : (
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
              onMore={trackMenuFor(item.item)}
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
