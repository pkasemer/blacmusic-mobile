import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import { AlertCircle, CalendarClock, ChartNoAxesColumn, CheckCircle2, Circle, Globe, Lock, MessageSquareQuote, Pause, PencilLine, Play, Plus, RefreshCw, RotateCcw, Trash2, Users, X, type LucideIcon } from 'lucide-react-native';
import { useRelease } from '@/api/blac/queries';
import { studioApi, type PendingUpload } from '@/api/blac/studio';
import { ReleaseStatsSheet } from '@/components/ReleaseStatsSheet';
import { useReleaseCredits } from '@/api/blac/credits';
import { queryClient } from '@/api/queryClient';
import { Artwork } from '@/components/Artwork';
import { playQueue, toggleMusicPlayback } from '@/audio/music/musicEngine';
import { GoLiveChoice, formatGoLive } from '@/components/DateTimeField';
import { PrimaryButton } from '@/components/FormField';
import { ScreenState } from '@/components/ScreenState';
import { SettingsGroup, SettingsRow, useGroupedColors } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import type { Track } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useUploadStore, type UploadJob } from '@/store/uploadStore';
import { readable } from '@/uploads/fileSize';
import { dismissUpload, retryUpload, uploadTracks } from '@/uploads/uploadManager';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { withStudioGuard } from '@/components/SuspendedStudio';

const SERVER_STATUS: Record<PendingUpload['status'], string> = {
  pending: 'Waiting for the file…',
  queued: 'Queued…',
  processing: 'Processing…',
  ready: 'Ready',
  failed: 'Failed',
};

/** "3:07" for a length in seconds. */
function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height: 5, backgroundColor: colors.primary }} />
    </View>
  );
}

/** A small icon-only button with a comfortable touch area. */
function IconAction({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
      {children}
    </Pressable>
  );
}

/** A small tool under a track: an icon and a word in a soft pill. */
function TrackAction({ label, Icon, onPress, destructive }: { label: string; Icon: LucideIcon; onPress: () => void; destructive?: boolean }) {
  const { colors } = useTheme();
  const tint = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon size={14} color={tint} />
      <Text variant="caption" style={{ color: tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One line of the "ready to publish" checklist. */
function CheckRow({ done, label }: { done: boolean; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 16 }}>
      {done ? <CheckCircle2 size={20} color={colors.success} /> : <Circle size={20} color={colors.textTertiary} />}
      <Text variant="body" color={done ? 'text' : 'textSecondary'}>
        {label}
      </Text>
    </View>
  );
}

/** A file going up from this phone: its name, how far it is, and retry or cancel. */
function UploadRow({ job, onRetry, onCancel }: { job: UploadJob; onRetry: () => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const busy = job.state === 'uploading' || job.state === 'waiting';
  return (
    <View style={{ gap: 9, paddingVertical: 12, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" numberOfLines={1}>
            {job.title}
          </Text>
          <Text variant="caption" color={job.state === 'failed' ? 'danger' : 'textSecondary'} numberOfLines={2}>
            {job.state === 'waiting' ? 'Waiting…' : job.state === 'uploading' ? `Uploading ${Math.round(job.progress * 100)}%` : job.state === 'processing' ? 'Processing…' : (job.error ?? 'Failed')}
          </Text>
        </View>
        {job.state === 'failed' ? (
          <IconAction label="Try again" onPress={onRetry}>
            <RotateCcw size={18} color={colors.accent} />
          </IconAction>
        ) : null}
        {job.state === 'failed' || busy ? (
          <IconAction label="Cancel upload" onPress={onCancel}>
            <X size={18} color={colors.textSecondary} />
          </IconAction>
        ) : null}
      </View>
      {busy ? <ProgressBar value={job.progress} /> : null}
    </View>
  );
}

/** One release: its tracks, the files still going up or being processed, and publish / delete. */
function ReleaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const g = useGroupedColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const allJobs = useUploadStore((s) => s.jobs);
  const jobs = useMemo(() => Object.values(allJobs).filter((j) => j.releaseId === id), [allJobs, id]);
  const activeJobs = jobs.filter((j) => j.state === 'waiting' || j.state === 'uploading');
  const release = useRelease(id);
  const data = release.data;
  const [statsOpen, setStatsOpen] = useState(false);
  const credits = useReleaseCredits(id);

  // Files the server knows about that this phone is not currently tracking (for example added earlier).
  const trackedIds = new Set(jobs.map((j) => j.uploadId).filter(Boolean));
  const serverUploads = (data?.uploads ?? []).filter((u) => !trackedIds.has(u.id));
  const serverBusy = (data?.uploads ?? []).some((u) => u.status !== 'ready' && u.status !== 'failed');

  // The artist can play their own tracks before publishing them, to check how they sound.
  const playingId = useMusicStore((m) => (m.active ? (m.queue[m.index]?.id ?? null) : null));
  const isPlaying = useMusicStore((m) => m.active && m.playing);
  const previewTracks = useMemo<Track[]>(
    () =>
      (data?.tracks ?? []).map((t) => ({
        kind: 'track',
        id: t.id,
        title: t.title,
        artistId: data?.artistId ?? '',
        artistName: data?.artistName ?? '',
        releaseId: data?.id ?? null,
        albumTitle: data?.type === 'album' ? data.title : null,
        artworkUrl: data?.artworkUrl ?? null,
        durationSec: t.durationSec,
        streamUrl: null,
        explicit: t.explicit,
        genre: data?.genre,
        downloadable: false,
        preview: true,
      })),
    [data],
  );
  const previewTrack = (index: number) => {
    const track = previewTracks[index];
    if (!track) return;
    if (playingId === track.id) toggleMusicPlayback();
    else playQueue(previewTracks, index, { source: { type: 'release', id, name: data?.title ?? 'Release' } });
  };

  const canPublish = !!data && data.tracks.length > 0 && !serverBusy && activeJobs.length === 0;
  const live = data?.visibility === 'public';
  // The go-live time chosen for this draft (epoch ms), or null to publish by hand.
  const goLiveAt = useScheduleStore((s) => s.byRelease[id] ?? null);
  const setGoLiveAt = useScheduleStore((s) => s.set);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['studio'] });
  };

  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
      haptics.success();
      refresh();
    } catch (e) {
      haptics.error();
      Alert.alert(failure, e instanceof Error ? e.message : 'Try again.');
    }
  };

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert('Delete this release?', 'Its tracks and files are removed for good, and the storage is given back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            jobs.forEach((j) => dismissUpload(j.key));
            await studioApi.deleteRelease(id);
            router.back();
          }, "Couldn't delete"),
      },
    ]);
  };

  const confirmDeleteTrack = (trackId: string, title: string) => {
    haptics.warning();
    Alert.alert(`Delete “${title}”?`, 'The track is removed from everyone’s playlists and library.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(() => studioApi.deleteTrack(trackId), "Couldn't delete") },
    ]);
  };

  /** Picks a new audio file for a track of this draft; the track keeps its title, genre, number and explicit flag. */
  const replaceAudio = (track: { id: string; title: string; trackNumber?: number | null; explicit: boolean }) => {
    haptics.select();
    Alert.alert(`Replace the audio of “${track.title}”?`, 'Choose a new file. The old file is removed once the new one is accepted. Its title and details stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Choose file',
        onPress: async () => {
          // Audio, or the video file from YouTube Studio's Download button: the server takes the sound out of it.
          const picked = await File.pickFileAsync({ mimeTypes: ['audio/*', 'video/*'] });
          if (picked.canceled) return;
          const file = await readable(picked.result);
          if (!file) {
            Alert.alert("Can't read that file", 'Download it to your phone first (for example from iCloud), then choose it again.');
            return;
          }
          uploadTracks(id, [{ file, title: track.title, explicit: track.explicit, trackNumber: track.trackNumber ?? undefined, replaceTrackId: track.id }], data?.genre);
        },
      },
    ]);
  };

  if (release.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: g.page }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState kind="error" title="Couldn't open this release" message="It may have been deleted, or you may be offline." actionLabel="Try again" onAction={() => void release.refetch()} />
      </View>
    );
  }

  const trackCount = data.tracks.length;
  const totalSec = data.tracks.reduce((sum, t) => sum + t.durationSec, 0);
  const scheduled = data.visibility === 'scheduled';
  const draft = !live && !scheduled;
  const pendingJobs = jobs.filter((j) => j.state !== 'ready');
  // A draft takes more audio: any number of tracks for an album, one file for a single that has none yet.
  const nothingComing = (data.uploads ?? []).every((u) => u.status === 'failed' || u.status === 'ready') && activeJobs.length === 0;
  const canAddAudio = draft && (data.type === 'album' || (trackCount === 0 && nothingComing));
  const statusColor = live ? colors.success : scheduled ? colors.accent : colors.textTertiary;
  const statusLabel = live ? 'Live' : scheduled ? 'Scheduled' : 'Draft';

  return (
    <ScrollView
      style={{ backgroundColor: g.page }}
      // The native header sits on top of the scroll view: let iOS start the content below it.
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 40, gap: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- Header: cover, title, what it is, where it stands ---- */}
      <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 24 }}>
        <View style={{ shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
          <Artwork id={data.id} logoUrl={data.artworkUrl} size={190} />
        </View>
        <Text variant="title" numberOfLines={2} style={{ textAlign: 'center', paddingTop: 6 }}>
          {data.title}
        </Text>
        <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
          {data.type === 'album' ? 'Album or EP' : 'Single'} · {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
          {trackCount > 0 ? ` · ${formatDuration(totalSec)}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: statusColor }} />
          <Text variant="bodyStrong">{statusLabel}</Text>
        </View>
      </View>

      {/* ---- Publish ---- */}
      <View style={{ gap: 12 }}>
        <SettingsGroup title="Publish">
          <SettingsRow
            icon={{ Icon: live ? Globe : scheduled ? CalendarClock : Lock }}
            title={live ? 'This release is live' : scheduled ? 'This release is scheduled' : canPublish ? 'Ready to publish' : 'Not ready yet'}
            subtitle={
              live
                ? 'Everyone can find and play it.'
                : scheduled
                  ? data.publishAt
                    ? `It goes live on ${new Date(data.publishAt).toLocaleString()}.`
                    : 'It will go live at the time you set.'
                  : 'Only you can see a draft. Play the tracks below to check them first.'
            }
          />
          {draft ? <CheckRow key="c1" done={trackCount > 0} label="At least one finished track" /> : null}
          {draft ? <CheckRow key="c2" done={!serverBusy && activeJobs.length === 0} label="Every file has finished uploading" /> : null}
          {draft ? (
            <View key="golive" style={{ gap: 10, padding: 16 }}>
              <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
                Go live
              </Text>
              <GoLiveChoice scheduledFor={goLiveAt} onChange={(at) => setGoLiveAt(id, at)} />
            </View>
          ) : null}
          {!draft ? (
            <SettingsRow key="back" title="Take back to draft" onPress={() => run(() => studioApi.unpublish(id), "Couldn't unpublish")} />
          ) : null}
        </SettingsGroup>
        {draft ? (
          <View style={{ marginHorizontal: 16 }}>
            <PrimaryButton
              label={goLiveAt !== null ? `Schedule for ${formatGoLive(new Date(goLiveAt))}` : 'Publish now'}
              disabled={!canPublish}
              onPress={() =>
                run(async () => {
                  await studioApi.publish(id, goLiveAt ?? undefined);
                  setGoLiveAt(id, null);
                }, goLiveAt !== null ? "Couldn't schedule" : "Couldn't publish")
              }
            />
          </View>
        ) : null}
      </View>

      {/* ---- How it is doing (live releases): the numbers open in a sheet ---- */}
      {live ? (
        <SettingsGroup>
          <SettingsRow
            icon={{ Icon: ChartNoAxesColumn }}
            title="Performance"
            subtitle="Plays, listeners and more for this release"
            chevron
            onPress={() => {
              haptics.select();
              setStatsOpen(true);
            }}
          />
        </SettingsGroup>
      ) : null}

      {/* ---- Details ---- */}
      {true ? (
        <SettingsGroup title="Details">
          {draft ? (
            <SettingsRow
              key="edit"
              icon={{ Icon: PencilLine }}
              title="Edit title, cover and details"
              chevron
              onPress={() => {
                haptics.select();
                router.push({ pathname: '/release/edit', params: { id } });
              }}
            />
          ) : null}
          {credits.data !== null ? (
            <SettingsRow
              key="credits"
              icon={{ Icon: Users }}
              title="Credits"
              subtitle="Producers, writers, engineers and labels"
              value={credits.data && credits.data.length > 0 ? String(credits.data.length) : 'Add'}
              chevron
              onPress={() => {
                haptics.select();
                router.push({ pathname: '/release/credits', params: { id } });
              }}
            />
          ) : null}
          {data.genre ? <SettingsRow key="genre" title="Genre" value={data.genre} /> : null}
          {data.description ? <SettingsRow key="desc" title="Description" subtitle={data.description} /> : null}
        </SettingsGroup>
      ) : null}

      {/* ---- Files going up from this phone ---- */}
      {pendingJobs.length > 0 ? (
        <SettingsGroup title={`Uploading · ${pendingJobs.length}`}>
          {pendingJobs.map((j) => (
            <UploadRow
              key={j.key}
              job={j}
              onRetry={() => retryUpload(j.key)}
              onCancel={() => {
                dismissUpload(j.key);
                refresh();
              }}
            />
          ))}
        </SettingsGroup>
      ) : null}

      {serverUploads.length > 0 ? (
        <SettingsGroup title={`Being processed · ${serverUploads.length}`}>
          {serverUploads.map((u) => (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 9, paddingHorizontal: 16 }}>
              {u.status === 'failed' ? <AlertCircle size={20} color={colors.danger} /> : <ActivityIndicator size="small" color={colors.accent} />}
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" numberOfLines={1}>
                  {u.title}
                </Text>
                <Text variant="caption" color={u.status === 'failed' ? 'danger' : 'textSecondary'}>
                  {u.status === 'failed' ? (u.error ?? 'Failed') : SERVER_STATUS[u.status]}
                </Text>
              </View>
              {u.status === 'failed' || u.status === 'pending' ? (
                <IconAction label="Remove" onPress={() => run(() => studioApi.cancelUpload(u.id), "Couldn't remove")}>
                  <X size={18} color={colors.textSecondary} />
                </IconAction>
              ) : null}
            </View>
          ))}
        </SettingsGroup>
      ) : null}

      {/* ---- Tracks ---- */}
      {trackCount === 0 && !canAddAudio ? (
        <View style={{ gap: 7, paddingHorizontal: 32 }}>
          <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Tracks
          </Text>
          <Text variant="body" color="textSecondary">
            No finished tracks yet. They appear here once processing is done.
          </Text>
        </View>
      ) : (
      <SettingsGroup
        title={`Tracks · ${trackCount}`}
        footer={trackCount === 0 ? 'No finished tracks yet. They appear here once processing is done.' : undefined}
      >
        {data.tracks.map((t, i) => {
          const playingThis = playingId === t.id && isPlaying;
          return (
            <View key={t.id} style={{ paddingVertical: 10, paddingHorizontal: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Pressable
                  onPress={() => previewTrack(i)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={playingThis ? `Pause ${t.title}` : `Play ${t.title}`}
                  style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 })}
                >
                  {playingThis ? (
                    <Pause size={16} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
                  ) : (
                    <Play size={16} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} style={{ marginLeft: 2 }} />
                  )}
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" numberOfLines={1} color={playingId === t.id ? 'accent' : 'text'}>
                    {data.type === 'album' ? `${t.trackNumber ?? i + 1}. ` : ''}
                    {t.title}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {formatDuration(t.durationSec)}
                    {t.explicit ? ' · Explicit' : ''}
                  </Text>
                </View>
              </View>
              {/* The track's tools, right under it */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingLeft: 54 }}>
                <TrackAction label="Lyrics" Icon={MessageSquareQuote} onPress={() => router.push({ pathname: '/release/lyrics', params: { id: t.id, title: t.title, duration: String(Math.round(t.durationSec ?? 0)) } })} />
                {draft ? <TrackAction label="Replace audio" Icon={RefreshCw} onPress={() => replaceAudio(t)} /> : null}
                <TrackAction label="Delete" Icon={Trash2} destructive onPress={() => confirmDeleteTrack(t.id, t.title)} />
              </View>
            </View>
          );
        })}
        {canAddAudio ? (
          <SettingsRow
            key="add"
            icon={{ Icon: Plus }}
            title={data.type === 'album' ? 'Add tracks' : 'Add audio file'}
            chevron
            onPress={() => {
              haptics.select();
              router.push({ pathname: '/release/add-audio', params: { id } });
            }}
          />
        ) : null}
      </SettingsGroup>
      )}

      {/* ---- Delete ---- */}
      <SettingsGroup footer="Removes this release, its tracks and files for good, and gives the storage back. This cannot be undone.">
        <SettingsRow title="Delete release" destructive center onPress={confirmDelete} />
      </SettingsGroup>
      <ReleaseStatsSheet release={statsOpen ? { id: data.id, title: data.title, artworkUrl: data.artworkUrl } : null} onClose={() => setStatsOpen(false)} />
    </ScrollView>
  );
}

export default withStudioGuard(ReleaseScreen);
