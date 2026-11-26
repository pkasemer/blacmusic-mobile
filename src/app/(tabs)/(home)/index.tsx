import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, History } from 'lucide-react-native';
import { playQueue } from '@/audio/music/musicEngine';
import { useAlbums, useFeaturedArtists, useFollowedReleases, useMyPlaylists, usePlayables, usePlaylistGroups, usePlaylists, usePodcasts } from '@/api/blac/queries';
import { Artwork } from '@/components/Artwork';
import { HomeHero, TILE_SIZE, type HomeFeatured, type HomeTile } from '@/components/HomeHero';
import { AlbumShelf, ArtistShelf, PlaylistShelf, PodcastShelf } from '@/components/MusicShelf';
import { PlaylistCover } from '@/components/PlaylistCover';
import { ScreenState } from '@/components/ScreenState';
import { HomeSkeleton } from '@/components/Skeleton';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import type { Playable, Track } from '@/domain/types';
import { useHistoryStore } from '@/store/historyStore';
import { useLibraryStore, type LibrarySection } from '@/store/libraryStore';
import { useMusicStore } from '@/store/musicStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useResumeStore } from '@/store/resumeStore';
import { formatTime } from '@/audio/music/queue';
import { useTheme } from '@/theme';
import { topInset } from '@/utils/platform';
import { refreshMusic, usePullToRefresh } from '@/hooks/usePullToRefresh';

/** Songs in the order of `ids`. Ids that did not come back (removed, or not music) are dropped. */
function tracksInOrder(ids: string[], items: Playable[] | undefined): Track[] {
  const byId = new Map((items ?? []).map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item && item.kind === 'track' ? [item] : [];
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const refreshControl = usePullToRefresh(refreshMusic);
  const playlists = usePlaylists();
  const groups = usePlaylistGroups();
  const myPlaylists = useMyPlaylists();
  // New releases come only from artists the listener follows.
  const newReleases = useFollowedReleases();
  const podcasts = usePodcasts();
  const artists = useFeaturedArtists();
  const albums = useAlbums();
  const router = useRouter();
  const { colors } = useTheme();

  // Recently played is saved as ids; look them up to get the songs back.
  const historyKey = useHistoryStore((s) => s.entries.map((e) => e.itemId).join(','));
  const recentIds = useMemo(() => (historyKey ? historyKey.split(',') : []), [historyKey]);
  const recent = usePlayables(recentIds);

  const recentTracks = useMemo(() => tracksInOrder(recentIds, recent.data), [recentIds, recent.data]);

  // The song that was playing when the app was last used, and the second it stopped at.
  const resumeId = useResumeStore((s) => s.itemId);
  const resumePosition = useResumeStore((s) => s.positionSec);
  const resumeDuration = useResumeStore((s) => s.durationSec);
  const resumeItems = usePlayables(resumeId ? [resumeId] : []);
  const resumeTrack = useMemo(() => tracksInOrder(resumeId ? [resumeId] : [], resumeItems.data)[0], [resumeId, resumeItems.data]);
  // Something is already loaded in the player (playing or paused): the mini player is the way back to it.
  const playerLoaded = useMusicStore((s) => s.active && s.queue.length > 0);

  // "Your" playlists come first in full; the recommended Playlists row leaves yours out so nothing shows twice.
  const yourPlaylists = useMemo(() => myPlaylists.data ?? [], [myPlaylists.data]);
  const recommendedPlaylists = useMemo(() => {
    const mineIds = new Set(yourPlaylists.map((p) => p.id));
    return (playlists.data ?? []).filter((p) => !mineIds.has(p.id));
  }, [playlists.data, yourPlaylists]);

  // Songs from the onboarding picks, for a newcomer's first listen.
  const starter = useOnboardingStore((s) => s.starter);

  // The big card: carry on with the last song, or (for a newcomer) their first mix or the newest release.
  const featured = useMemo<HomeFeatured | undefined>(() => {
    if (playerLoaded) return undefined;
    const last = resumeTrack ?? recentTracks[0];
    if (last) {
      const position = resumeTrack && resumeTrack.id === last.id ? resumePosition : 0;
      const duration = last.durationSec || resumeDuration;
      const queue = [last, ...recentTracks.filter((t) => t.id !== last.id)];
      return {
        label: 'Continue listening',
        title: last.title,
        subtitle: position > 5 && duration > 0 ? `${last.artistName} · ${formatTime(Math.max(0, duration - position))} left` : last.artistName,
        art: <Artwork id={last.id} logoUrl={last.artworkUrl} size={112} />,
        tint: { id: last.id, logoUrl: last.artworkUrl },
        progress: duration > 0 ? position / duration : 0,
        playLabel: position > 5 ? 'Resume' : 'Play',
        onPress: () => router.push({ pathname: '/track/[id]', params: { id: last.id } }),
        onPlay: () => playQueue(queue, 0, { source: { type: 'recent' }, positionSec: position }),
      };
    }
    const first = starter[0];
    if (first) {
      const play = () => playQueue(starter, 0, { shuffle: false });
      return {
        label: 'From your picks',
        title: 'Your first listen',
        subtitle: `${starter.length} ${starter.length === 1 ? 'song' : 'songs'} from the artists and genres you chose`,
        art: <Artwork id={first.id} logoUrl={first.artworkUrl} size={112} />,
        tint: { id: first.id, logoUrl: first.artworkUrl },
        onPress: play,
        onPlay: play,
      };
    }
    const fresh = newReleases.data?.[0];
    if (fresh) {
      return {
        label: 'New release',
        title: fresh.title,
        subtitle: fresh.artistName,
        art: <Artwork id={fresh.id} logoUrl={fresh.artworkUrl} size={112} />,
        tint: { id: fresh.id, logoUrl: fresh.artworkUrl },
        onPress: () => router.push({ pathname: '/album/[id]', params: { id: fresh.id } }),
      };
    }
    return undefined;
  }, [playerLoaded, resumeTrack, resumePosition, resumeDuration, recentTracks, starter, newReleases.data, router]);

  // Quick-access tiles: likes and recently played (both open in the Library), then your playlists, then what you
  // played last. A newcomer with none of that gets the featured playlists and albums too, so the top of Home is full.
  const tiles = useMemo<HomeTile[]>(() => {
    const libraryTile = (section: LibrarySection, title: string, icon: React.ReactNode): HomeTile => ({
      key: section,
      title,
      art: <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>{icon}</View>,
      onPress: () => {
        useLibraryStore.getState().show(section);
        router.navigate('/library');
      },
    });
    const list: HomeTile[] = [
      libraryTile('favourites', 'Likes', <Heart size={22} color={colors.onPrimary} fill={colors.onPrimary} />),
      libraryTile('recent', 'Recently played', <History size={22} color={colors.onPrimary} strokeWidth={2.4} />),
    ];
    for (const p of yourPlaylists.slice(0, 3)) {
      list.push({
        key: `pl-${p.id}`,
        title: p.name,
        art: <PlaylistCover playlist={p} size={TILE_SIZE} />,
        onPress: () => router.push({ pathname: '/playlist/[id]', params: { id: p.id } }),
      });
    }
    recentTracks.forEach((t, i) => {
      if (list.length >= 6) return;
      list.push({
        key: `tr-${t.id}`,
        title: t.title,
        art: <Artwork id={t.id} logoUrl={t.artworkUrl} size={TILE_SIZE} />,
        onPress: () => playQueue(recentTracks, i, { source: { type: 'recent' } }),
      });
    });
    for (const p of recommendedPlaylists) {
      if (list.length >= 6) break;
      list.push({
        key: `rp-${p.id}`,
        title: p.name,
        art: <PlaylistCover playlist={p} size={TILE_SIZE} />,
        onPress: () => router.push({ pathname: '/playlist/[id]', params: { id: p.id } }),
      });
    }
    for (const a of albums.data ?? []) {
      if (list.length >= 6) break;
      list.push({
        key: `al-${a.id}`,
        title: a.title,
        art: <Artwork id={a.id} logoUrl={a.artworkUrl} size={TILE_SIZE} />,
        onPress: () => router.push({ pathname: '/album/[id]', params: { id: a.id } }),
      });
    }
    return list;
  }, [colors.primary, colors.onPrimary, router, yourPlaylists, recentTracks, recommendedPlaylists, albums.data]);

  // Editorial groups, without the playlists the user made themselves (those are under "Your playlists").
  const groupShelves = useMemo(() => {
    const mineIds = new Set(yourPlaylists.map((p) => p.id));
    return (groups.data ?? [])
      .map((g) => ({ ...g, playlists: g.playlists.filter((p) => !mineIds.has(p.id)) }))
      .filter((g) => g.playlists.length > 0);
  }, [groups.data, yourPlaylists]);

  const hasYours = yourPlaylists.length > 0;

  const loading = playlists.isPending && podcasts.isPending && artists.isPending && albums.isPending;
  const failed = playlists.isError && podcasts.isError && artists.isError && albums.isError;
  const empty =
    !loading &&
    !failed &&
    !playlists.data?.length &&
    !podcasts.data?.length &&
    !artists.data?.length &&
    !albums.data?.length &&
    yourPlaylists.length === 0;

  const retry = () => {
    void playlists.refetch();
    void groups.refetch();
    void myPlaylists.refetch();
    void newReleases.refetch();
    void podcasts.refetch();
    void artists.refetch();
    void albums.refetch();
  };

  return (
    <TabScreen>
      <ScrollView
        // iOS adds the status-bar and tab-bar insets itself; Android needs the top inset by hand.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: topInset(insets.top) + 12, paddingBottom: 28, gap: 28 }}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <HomeHero tiles={tiles} featured={featured} />

        {loading ? (
          <HomeSkeleton />
        ) : failed ? (
          <ScreenState
            kind="error"
            title="Can't load music"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={retry}
          />
        ) : empty ? (
          <ScreenState kind="empty" title="Nothing here yet" message="New songs and podcasts will show up here." />
        ) : (
          <>
            {/* Yours first (likes and recently played are in the Library) */}
            <PlaylistShelf title="Your playlists" playlists={yourPlaylists} more={{ list: 'your-playlists' }} />

            {/* Then what we recommend */}
            {hasYours ? (
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                <Text variant="label" color="textTertiary">
                  Recommended for you
                </Text>
                <View style={{ height: 1, backgroundColor: colors.border }} />
              </View>
            ) : null}
            <AlbumShelf title="New releases" albums={newReleases.data} more={{ list: 'new-releases' }} />
            <ArtistShelf title="Featured artists" artists={artists.data} more={{ list: 'featured-artists' }} />
            <AlbumShelf title="Featured releases" albums={albums.data} more={{ list: 'featured-albums' }} />
            {/* Then the themed playlists: one shelf per editorial group ("Workout", "Throwback"…), named and ordered by the backend. */}
            {groupShelves.length > 0 ? (
              groupShelves.map((g) => (
                <PlaylistShelf
                  key={g.id}
                  title={g.title}
                  playlists={g.playlists}
                  more={{ list: 'group', ref: g.id }}
                />
              ))
            ) : (
              <PlaylistShelf title="Playlists" playlists={recommendedPlaylists} more={{ list: 'playlists' }} />
            )}
            <PodcastShelf podcasts={podcasts.data} more={{ list: 'podcasts' }} />
          </>
        )}

        <Text variant="label" color="textTertiary" style={{ textAlign: 'center', marginTop: 4 }}>
          Blac
        </Text>
      </ScrollView>
    </TabScreen>
  );
}
