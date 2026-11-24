import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import { AlertCircle, CheckCircle2, Circle, Pause, Pencil, Play, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react-native';
import { useRelease } from '@/api/blac/queries';
import { studioApi, type PendingUpload } from '@/api/blac/studio';
import { queryClient } from '@/api/queryClient';
import { Artwork } from '@/components/Artwork';
import { playQueue, toggleMusicPlayback } from '@/audio/music/musicEngine';
import { Card } from '@/components/Card';
import { GoLiveChoice, formatGoLive } from '@/components/DateTimeField';
import { PrimaryButton } from '@/components/FormField';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import type { Track } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useUploadStore } from '@/store/uploadStore';
import { readable } from '@/uploads/fileSize';
import { dismissUpload, retryUpload, uploadTracks } from '@/uploads/uploadManager';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const SERVER_STATUS: Record<PendingUpload['status'], string> = {
  pending: 'Waiting for the file…',
  queued: 'Queued…',
  processing: 'Processing…',
  ready: 'Ready',
  failed: 'Failed',
};

function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height: 6, backgroundColor: colors.primary }} />
    </View>
  );
}

/** "3:07" for a length in seconds. */
function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** A titled block of the screen: a small caption (with a count) above its cards. */
function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Text variant="label" color="textTertiary" style={{ paddingHorizontal: 4 }}>
        {title}
        {count !== undefined ? `  ·  ${count}` : ''}
      </Text>
      {children}
    </View>
  );
}

/** Small rounded tag with a coloured dot, for Draft / Scheduled / Live. */
function StatusPill({ label, color }: { label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" color="text">
        {label}
      </Text>
    </View>
  );
}

/** One line of the "ready to publish" checklist. */
function CheckRow({ done, label }: { done: boolean; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {done ? <CheckCircle2 size={18} color={colors.success} /> : <Circle size={18} color={colors.textTertiary} />}
      <Text variant="body" color={done ? 'text' : 'textSecondary'}>
        {label}
      </Text>
    </View>
  );
}

/** Outlined pill button for the quieter action next to a primary one. */
function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="bodyStrong">{label}</Text>
    </Pressable>
  );
}

/** A small icon-only button with a comfortable touch area. */
function IconAction({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
    >
      {children}
    </Pressable>
  );
}

/** One release: its tracks, the files still going up or being processed, and publish / delete. */
export default function ReleaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const allJobs = useUploadStore((s) => s.jobs);
  const jobs = useMemo(() => Object.values(allJobs).filter((j) => j.releaseId === id), [allJobs, id]);
  const activeJobs = jobs.filter((j) => j.state === 'waiting' || j.state === 'uploading');
  const release = useRelease(id);
  const data = release.data;

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
          uploadTracks(
            id,
            [{ file, title: track.title, explicit: track.explicit, trackNumber: track.trackNumber ?? undefined, replaceTrackId: track.id }],
            data?.genre,
          );
        },
      },
    ]);
  };

  if (release.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title="Couldn't open this release"
          message="It may have been deleted, or you may be offline."
          actionLabel="Try again"
          onAction={() => void release.refetch()}
        />
      </View>
    );
  }

  const trackCount = data.tracks.length;
  const totalSec = data.tracks.reduce((sum, t) => sum + t.durationSec, 0);
  const scheduled = data.visibility === 'scheduled';
  const statusLabel = live ? 'Live' : scheduled ? 'Scheduled' : 'Draft';
  const statusColor = live ? colors.success : scheduled ? colors.accent : colors.textTertiary;
  const pendingJobs = jobs.filter((j) => j.state !== 'ready');

  return (
    <>
      <Stack.Screen options={{ title: data.title }} />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        // The native header sits on top of the scroll view: let iOS start the content below it.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 28 }}
      >
        {/* ---- Header: cover, title, what it is ---- */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Artwork id={data.id} logoUrl={data.artworkUrl} size={112} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="title" numberOfLines={2}>
              {data.title}
            </Text>
            <Text variant="caption" color="textSecondary">
              {data.type === 'album' ? 'Album or EP' : 'Single'} · {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
              {trackCount > 0 ? ` · ${formatDuration(totalSec)}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StatusPill label={statusLabel} color={statusColor} />
              {!live && !scheduled ? (
                <Pressable
                  onPress={() => {
                    haptics.select();
                    router.push({ pathname: '/release/edit', params: { id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit this release"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: colors.primarySoft,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Pencil size={13} color={colors.accent} />
                  <Text variant="caption" color="accent">
                    Edit
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* ---- About ---- */}
        {data.description || data.genre ? (
          <Section title="About">
            <Card style={{ padding: 16, gap: 8 }}>
              {data.genre ? (
                <Text variant="caption" color="accent">
                  {data.genre}
                </Text>
              ) : null}
              {data.description ? <Text variant="body">{data.description}</Text> : null}
            </Card>
          </Section>
        ) : null}

        {/* ---- Publish ---- */}
        <Section title="Publish">
          <Card style={{ padding: 16, gap: 16 }}>
            {live || scheduled ? (
              <>
                <View style={{ gap: 4 }}>
                  <Text variant="headline">{live ? 'This release is live' : 'This release is scheduled'}</Text>
                  <Text variant="caption" color="textSecondary">
                    {live
                      ? 'Everyone can find and play it.'
                      : data.publishAt
                        ? `It goes live on ${new Date(data.publishAt).toLocaleString()}.`
                        : 'It will go live at the time you set.'}
                  </Text>
                </View>
                <SecondaryButton
                  label="Take back to draft"
                  onPress={() => run(() => studioApi.unpublish(id), "Couldn't unpublish")}
                />
              </>
            ) : (
              <>
                <View style={{ gap: 4 }}>
                  <Text variant="headline">{canPublish ? 'Ready to publish' : 'Not ready yet'}</Text>
                  <Text variant="caption" color="textSecondary">
                    Only you can see a draft. Play your tracks below to check them first.
                  </Text>
                </View>
                <View style={{ gap: 10 }}>
                  <CheckRow done={trackCount > 0} label="At least one finished track" />
                  <CheckRow done={!serverBusy && activeJobs.length === 0} label="Every file has finished uploading" />
                </View>
                <View style={{ gap: 10 }}>
                  <Text variant="label" color="textTertiary">
                    Go live
                  </Text>
                  <GoLiveChoice scheduledFor={goLiveAt} onChange={(at) => setGoLiveAt(id, at)} />
                </View>
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
              </>
            )}
          </Card>
        </Section>

        {/* ---- Files going up from this phone ---- */}
        {pendingJobs.length > 0 ? (
          <Section title="Uploading" count={pendingJobs.length}>
            {pendingJobs.map((j) => (
              <Card key={j.key} style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="headline" numberOfLines={1}>
                      {j.title}
                    </Text>
                    <Text variant="caption" color={j.state === 'failed' ? 'danger' : 'textSecondary'}>
                      {j.state === 'waiting'
                        ? 'Waiting…'
                        : j.state === 'uploading'
                          ? `Uploading ${Math.round(j.progress * 100)}%`
                          : j.state === 'processing'
                            ? 'Processing…'
                            : (j.error ?? 'Failed')}
                    </Text>
                  </View>
                  {j.state === 'failed' ? (
                    <IconAction label="Try again" onPress={() => retryUpload(j.key)}>
                      <RotateCcw size={18} color={colors.accent} />
                    </IconAction>
                  ) : null}
                  {j.state === 'failed' || j.state === 'waiting' || j.state === 'uploading' ? (
                    <IconAction
                      label="Cancel upload"
                      onPress={() => {
                        dismissUpload(j.key);
                        refresh();
                      }}
                    >
                      <X size={18} color={colors.textSecondary} />
                    </IconAction>
                  ) : null}
                </View>
                {j.state === 'uploading' || j.state === 'waiting' ? <ProgressBar value={j.progress} /> : null}
              </Card>
            ))}
          </Section>
        ) : null}

        {serverUploads.length > 0 ? (
          <Section title="Being processed" count={serverUploads.length}>
            {serverUploads.map((u) => (
              <Card key={u.id} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {u.status === 'failed' ? <AlertCircle size={18} color={colors.danger} /> : <ActivityIndicator size="small" color={colors.accent} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="headline" numberOfLines={1}>
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
              </Card>
            ))}
          </Section>
        ) : null}

        {/* ---- Tracks ---- */}
        <Section title="Tracks" count={trackCount}>
          {trackCount === 0 ? (
            <Card style={{ padding: 16 }}>
              <Text variant="body" color="textSecondary">
                No finished tracks yet. They appear here once processing is done.
              </Text>
            </Card>
          ) : (
            <Card style={{ paddingHorizontal: 16 }}>
              {data.tracks.map((t, i) => {
                const playingThis = playingId === t.id && isPlaying;
                return (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Pressable
                      onPress={() => previewTrack(i)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={playingThis ? `Pause ${t.title}` : `Play ${t.title}`}
                      style={({ pressed }) => ({
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      {playingThis ? (
                        <Pause size={16} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
                      ) : (
                        <Play size={16} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} style={{ marginLeft: 2 }} />
                      )}
                    </Pressable>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="headline" numberOfLines={1} color={playingId === t.id ? 'accent' : 'text'}>
                        {data.type === 'album' ? `${t.trackNumber ?? i + 1}. ` : ''}
                        {t.title}
                      </Text>
                      <Text variant="caption" color="textSecondary">
                        {formatDuration(t.durationSec)}
                        {t.explicit ? ' · Explicit' : ''}
                      </Text>
                    </View>
                    {!live ? (
                      <IconAction label={`Replace the audio of ${t.title}`} onPress={() => replaceAudio(t)}>
                        <RefreshCw size={18} color={colors.textTertiary} />
                      </IconAction>
                    ) : null}
                    <IconAction label={`Delete ${t.title}`} onPress={() => confirmDeleteTrack(t.id, t.title)}>
                      <Trash2 size={18} color={colors.textTertiary} />
                    </IconAction>
                  </View>
                );
              })}
            </Card>
          )}
        </Section>

        {/* ---- Danger zone ---- */}
        <Section title="Delete">
          <Card style={{ padding: 16, gap: 14 }}>
            <Text variant="caption" color="textSecondary">
              Removes this release, its tracks and files for good, and gives the storage back. This cannot be undone.
            </Text>
            <Pressable
              onPress={confirmDelete}
              accessibilityRole="button"
              style={({ pressed }) => ({
                alignItems: 'center',
                paddingVertical: 13,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.danger,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="bodyStrong" color="danger">
                Delete release
              </Text>
            </Pressable>
          </Card>
        </Section>
      </ScrollView>
    </>
  );
}
