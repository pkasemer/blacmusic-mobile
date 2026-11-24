import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck } from 'lucide-react-native';
import { ApiError } from '@/api/blac';
import { youtubeApi, type NewTransferItem, type YouTubeVideo } from '@/api/blac/youtube';
import {
  needsConnect,
  setTransferInCache,
  useYouTubeConnection,
  useYouTubeVideos,
  youtubeErrorText,
  youtubeKeys,
} from '@/api/blac/youtubeQueries';
import { queryClient } from '@/api/queryClient';
import { TERMS_VERSION } from '@/api/blac/studio';
import { Artwork } from '@/components/Artwork';
import { Checkbox } from '@/components/Checkbox';
import { Chip } from '@/components/Chip';
import { GenrePicker } from '@/components/GenrePicker';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { formatTime } from '@/audio/music/queue';
import { fontStyle } from '@/theme/fonts';
import { radius, useTheme } from '@/theme';
import { offerPush } from '@/notifications/push';
import { haptics } from '@/utils/haptics';
import { yearOf } from '@/utils/format';

function SongRow({ video, selected, onToggle }: { video: YouTubeVideo; selected: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const imported = video.alreadyImported;
  const extras = video.variants.length;
  return (
    <Pressable
      onPress={onToggle}
      disabled={imported}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: imported }}
      accessibilityLabel={`${video.suggested.title}${imported ? ', already on Blac' : ''}`}
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
      <Checkbox checked={selected} disabled={imported} />
      <View style={{ opacity: imported ? 0.45 : 1 }}>
        <Artwork id={video.videoId} logoUrl={video.thumbnailUrl ?? null} size={52} />
      </View>
      <View style={{ flex: 1, gap: 3, opacity: imported ? 0.6 : 1 }}>
        <Text variant="headline" numberOfLines={1}>
          {video.suggested.title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {[yearOf(video.suggested.releaseDate ?? video.publishedAt), formatTime(video.durationSec), extras > 0 ? `+${extras} ${extras === 1 ? 'version' : 'versions'}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      {imported ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <CircleCheck size={15} color={colors.textTertiary} />
          <Text variant="caption" color="textTertiary">
            On Blac
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Step 2: the songs found on the channel. Choose which to bring in, then a transfer is created. */
export default function YouTubeReviewScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const connection = useYouTubeConnection();
  const connected = connection.data?.connected === true && !connection.data.needsReconnect;
  const videosQuery = useYouTubeVideos(connected);
  const videos = useMemo(() => videosQuery.data?.videos ?? [], [videosQuery.data]);
  const eligible = useMemo(() => videos.filter((v) => !v.alreadyImported), [videos]);

  // Everything new is ticked to begin with; the artist un-ticks what they don't want. Stored as the ones left out,
  // so songs that arrive later (a refresh) start ticked without any effect.
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set());
  const selected = useMemo(() => eligible.filter((v) => !leftOut.has(v.videoId)), [eligible, leftOut]);

  const [asAlbum, setAsAlbum] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [rights, setRights] = useState(false);
  // Only when the server can fetch audio itself. On by default; the artist can choose to add their own files instead.
  const audioImport = connection.data?.audioImport === true;
  const [ownFiles, setOwnFiles] = useState(false);
  const fetchAudio = audioImport && !ownFiles;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    haptics.select();
    setLeftOut((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = eligible.length > 0 && selected.length === eligible.length;
  const toggleAll = () => {
    haptics.select();
    setLeftOut(allSelected ? new Set(eligible.map((v) => v.videoId)) : new Set());
  };

  const canGroup = selected.length >= 2;
  const albumOk = !asAlbum || !canGroup || albumTitle.trim().length > 0;
  const canContinue = selected.length > 0 && rights && albumOk && !busy;

  const start = async () => {
    if (!canContinue) return;
    setBusy(true);
    setError(null);
    try {
      const items: NewTransferItem[] = selected.map((v) => ({
        videoId: v.videoId,
        title: v.suggested.title,
        releaseDate: v.suggested.releaseDate,
        ...(audioImport ? { audio: fetchAudio ? ('youtube' as const) : ('upload' as const) } : {}),
        ...(genre ? { genre } : {}),
        ...(asAlbum && canGroup ? { releaseType: 'album' as const, albumTitle: albumTitle.trim() } : { releaseType: 'single' as const }),
      }));
      // A new key per press; if an earlier press did create a transfer, the server answers "transfer_active" and we open that one.
      const transfer = await youtubeApi.createTransfer(items, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, {
        termsVersion: TERMS_VERSION,
      });
      setTransferInCache(transfer);
      haptics.success();
      router.replace({ pathname: '/youtube/transfer/[id]', params: { id: transfer.id } });
      void offerPush("We'll tell you when your import finishes, even if the app is closed.");
    } catch (e) {
      haptics.error();
      // An open transfer already exists: carry on with that one instead.
      if (e instanceof ApiError && e.code === 'transfer_active') {
        const open = (await youtubeApi.listTransfers().catch(() => [])).find((t) => t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled');
        if (open) {
          router.replace({ pathname: '/youtube/transfer/[id]', params: { id: open.id } });
          return;
        }
      }
      if (e instanceof ApiError && e.code === 'validation_error' && /unknown video/i.test(e.message)) {
        void queryClient.invalidateQueries({ queryKey: youtubeKeys.videos });
        setError('Your channel changed since it was read. The list has been refreshed. Please choose again.');
      } else {
        setError(youtubeErrorText(e));
      }
      setBusy(false);
    }
  };

  // ---- States ----
  if (connection.isPending || (connected && videosQuery.isPending)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
        <Text variant="caption" color="textSecondary">
          {connected ? 'Reading your channel…' : 'Checking your connection…'}
        </Text>
      </View>
    );
  }
  if (!connected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="empty"
          title="Connect YouTube first"
          message={connection.data?.needsReconnect ? 'Google stopped allowing access. Connect again to carry on.' : 'We need your channel to find your songs.'}
          actionLabel="Connect YouTube"
          onAction={() => router.replace('/youtube')}
        />
      </View>
    );
  }
  if (videosQuery.isError) {
    const connectProblem = needsConnect(videosQuery.error);
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title={connectProblem ? 'Connect YouTube again' : "Couldn't read your channel"}
          message={youtubeErrorText(videosQuery.error)}
          actionLabel={connectProblem ? 'Connect YouTube' : 'Try again'}
          onAction={() => (connectProblem ? router.replace('/youtube') : void videosQuery.refetch())}
        />
      </View>
    );
  }
  if (videos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="empty"
          title="No songs found"
          message="We couldn't find any music on this channel. Videos that aren't music, and shorts, are left out."
          actionLabel="Read the channel again"
          onAction={() => void queryClient.fetchQuery({ queryKey: youtubeKeys.videos, queryFn: () => youtubeApi.getVideos({ refresh: true }) }).then(() => videosQuery.refetch())}
        />
      </View>
    );
  }
  if (eligible.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState kind="empty" title="Everything is already on Blac" message="All the songs we found are already in your catalogue." actionLabel="Close" onAction={() => router.dismissAll()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 220, gap: 4 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{videos.length === 1 ? '1 song found' : `${videos.length} songs found`}</Text>
            <Text variant="caption" color="textSecondary">
              Lyric videos and shorts of the same song are counted once.
            </Text>
          </View>
          <Pressable onPress={toggleAll} hitSlop={10} accessibilityRole="button">
            <Text variant="bodyStrong" color="accent">
              {allSelected ? 'Select none' : 'Select all'}
            </Text>
          </Pressable>
        </View>

        {videos.map((video) => (
          <SongRow key={video.videoId} video={video} selected={!video.alreadyImported && !leftOut.has(video.videoId)} onToggle={() => toggle(video.videoId)} />
        ))}

        {/* Options for everything chosen */}
        <View style={{ gap: 18, paddingHorizontal: 20, paddingTop: 20 }}>
          {audioImport ? (
            <View style={{ gap: 10 }}>
              <Text variant="label" color="textTertiary">
                Where the audio comes from
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Get it from YouTube" selected={!ownFiles} onPress={() => setOwnFiles(false)} />
                <Chip label="I'll add my own files" selected={ownFiles} onPress={() => setOwnFiles(true)} />
              </View>
              <Text variant="caption" color="textSecondary">
                {ownFiles
                  ? 'You choose an audio file for each song, so the quality stays yours.'
                  : "We take the sound from your own videos. It's good for listening but not studio quality. You can still add a better file for any song afterwards."}
              </Text>
            </View>
          ) : null}
          <GenrePicker label="Genre for all (optional)" value={genre} onChange={setGenre} />

          {canGroup ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">Release as one album</Text>
                  <Text variant="caption" color="textSecondary">
                    Otherwise each song is its own single.
                  </Text>
                </View>
                <Switch
                  value={asAlbum}
                  onValueChange={(v) => {
                    haptics.select();
                    setAsAlbum(v);
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.accent }}
                  ios_backgroundColor={colors.borderStrong}
                />
              </View>
              {asAlbum ? (
                <TextInput
                  value={albumTitle}
                  onChangeText={setAlbumTitle}
                  placeholder="Album title"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={200}
                  style={{
                    ...fontStyle('rounded', '400'),
                    fontSize: 16,
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    borderRadius: radius.sm,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Stays at the bottom: the rights tick and the button */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => {
            haptics.select();
            setRights((r) => !r);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rights }}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
        >
          <Checkbox checked={rights} />
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
            I own this music, or I have the rights to share it on Blac, and I accept the upload terms. Finished songs are published when the transfer completes.
          </Text>
        </Pressable>
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={start}
          disabled={!canContinue}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignItems: 'center',
            paddingVertical: 15,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            opacity: !canContinue ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text variant="bodyStrong" color="onPrimary">
              {selected.length === 0 ? 'Choose at least one song' : `Continue with ${selected.length} ${selected.length === 1 ? 'song' : 'songs'}`}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
