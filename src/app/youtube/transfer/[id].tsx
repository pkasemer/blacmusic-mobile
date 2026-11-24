import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, CircleAlert, Hourglass, Music2 } from 'lucide-react-native';
import { ApiError } from '@/api/blac';
import { youtubeApi, type Transfer, type TransferItem } from '@/api/blac/youtube';
import { setTransferInCache, useTransfer, youtubeErrorText } from '@/api/blac/youtubeQueries';
import { queryClient } from '@/api/queryClient';
import { Artwork } from '@/components/Artwork';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/FormField';
import { ProgressBar } from '@/components/ProgressBar';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { useUploadStore, type UploadJob } from '@/store/uploadStore';
import { radius, useTheme } from '@/theme';
import { readable } from '@/uploads/fileSize';
import { dismissUpload, retryUpload, uploadTracks } from '@/uploads/uploadManager';
import { haptics } from '@/utils/haptics';

const COUNTED_OUT: TransferItem['status'][] = ['skipped_duplicate', 'dropped'];
const isCounted = (i: TransferItem) => !COUNTED_OUT.includes(i.status);
/**
 * What to send to the upload API for a song. The server gives the hint while a song waits for a file; a song still being
 * fetched may only carry its release, which is enough to attach a file of the artist's own.
 */
const uploadHint = (item: TransferItem): TransferItem['upload'] =>
  item.upload ?? (item.releaseId ? { releaseId: item.releaseId, title: item.title, explicit: false } : undefined);
const isOpen = (t: Transfer) => ['collecting', 'queued', 'in_progress', 'retrying'].includes(t.status);

/** What to say about one song, and in which colour. */
function describeItem(item: TransferItem, job: UploadJob | undefined, transferStatus: Transfer['status']): { text: string; tone: 'normal' | 'good' | 'bad' | 'busy' } {
  switch (item.status) {
    case 'skipped_duplicate':
      return { text: 'Already on Blac, so it was skipped', tone: 'normal' };
    case 'fetching':
      if (job?.state === 'failed') return { text: job.error ?? 'The upload failed', tone: 'bad' };
      if (job && job.state !== 'ready') return { text: `Uploading ${Math.round(job.progress * 100)}%`, tone: 'busy' };
      // The server's note while it waits to try again is a status, not a failure.
      return { text: item.error ?? 'Getting the audio from YouTube', tone: 'busy' };
    case 'awaiting_audio':
      if (job?.state === 'failed') return { text: job.error ?? 'The upload failed', tone: 'bad' };
      if (job && job.state !== 'ready') return { text: `Uploading ${Math.round(job.progress * 100)}%`, tone: 'busy' };
      // A song the server could not fetch says why ("the video is private. Upload a file instead.").
      return { text: item.error ?? 'Needs its audio file', tone: item.error ? 'bad' : 'normal' };
    case 'uploading':
      if (job?.state === 'failed') return { text: job.error ?? 'The upload failed', tone: 'bad' };
      if (job && job.state !== 'ready') return { text: `Uploading ${Math.round(job.progress * 100)}%`, tone: 'busy' };
      return { text: "The upload didn't finish. Choose the file again.", tone: 'bad' };
    case 'waiting':
      return { text: transferStatus === 'collecting' ? 'Audio added' : 'Waiting for its turn', tone: transferStatus === 'collecting' ? 'good' : 'normal' };
    case 'processing':
      return { text: 'Converting the audio', tone: 'busy' };
    case 'cover':
      return { text: 'Adding the cover art', tone: 'busy' };
    case 'publishing':
      return { text: 'Publishing', tone: 'busy' };
    case 'done':
      return { text: 'Published', tone: 'good' };
    case 'failed':
      return { text: item.error ?? 'Something went wrong with this song', tone: 'bad' };
    default:
      return { text: '', tone: 'normal' };
  }
}

function ItemRow({
  item,
  job,
  transfer,
  onAddAudio,
  onRemoveFile,
  onSkip,
  onRetryUpload,
  last,
}: {
  item: TransferItem;
  job: UploadJob | undefined;
  transfer: Transfer;
  onAddAudio: () => void;
  onRemoveFile: () => void;
  onSkip: () => void;
  onRetryUpload: () => void;
  last: boolean;
}) {
  const { colors } = useTheme();
  const collecting = transfer.status === 'collecting';
  const { text, tone } = describeItem(item, job, transfer.status);
  const color = tone === 'good' ? colors.success : tone === 'bad' ? colors.danger : colors.textSecondary;
  const needsAudio = collecting && (item.status === 'awaiting_audio' || (item.status === 'uploading' && !(job && job.state !== 'failed')) || job?.state === 'failed');
  // A song whose file is in can still change its mind while the transfer waits for the artist.
  const hasFile = collecting && item.status === 'waiting';
  // A song still being fetched can be switched to the artist's own file while the transfer waits for the artist.
  const canUseOwnFile = collecting && item.status === 'fetching' && !!uploadHint(item) && !(job && job.state !== 'failed');
  const uploading = job && (job.state === 'uploading' || job.state === 'waiting');
  const showBar = item.status === 'processing' || item.status === 'cover' || item.status === 'publishing' || uploading;
  const barValue = uploading ? job.progress : item.percent / 100;
  const dimmed = item.status === 'skipped_duplicate';

  return (
    <View
      style={{
        gap: 10,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Artwork id={item.videoId} logoUrl={item.thumbnailUrl ?? null} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={1}>
            {item.title}
          </Text>
          <Text variant="caption" numberOfLines={2} style={{ color }}>
            {text}
          </Text>
        </View>
        {item.status === 'done' ? <CheckCircle2 size={22} color={colors.success} /> : null}
        {item.status === 'failed' ? <CircleAlert size={22} color={colors.danger} /> : null}
        {tone === 'busy' && !showBar ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      </View>
      {showBar ? <ProgressBar value={barValue} /> : null}
      {hasFile ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Pressable onPress={onAddAudio} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Replace the file for ${item.title}`}>
            <Text variant="caption" color="accent">
              Replace file
            </Text>
          </Pressable>
          <Pressable onPress={onRemoveFile} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove the file for ${item.title}`}>
            <Text variant="caption" color="textSecondary">
              Remove file
            </Text>
          </Pressable>
        </View>
      ) : null}
      {canUseOwnFile ? (
        <Pressable onPress={onAddAudio} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
          <Text variant="caption" color="accent">
            Use my own file instead
          </Text>
        </Pressable>
      ) : null}
      {needsAudio ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable
            onPress={job?.state === 'failed' ? onRetryUpload : onAddAudio}
            accessibilityRole="button"
            style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 })}
          >
            <Text variant="bodyStrong" color="accent">
              {job?.state === 'failed' ? 'Try again' : item.status === 'uploading' ? 'Choose the file again' : 'Add audio'}
            </Text>
          </Pressable>
          {job?.state === 'failed' ? (
            <Pressable onPress={onAddAudio} hitSlop={8} accessibilityRole="button">
              <Text variant="caption" color="accent">
                Choose another file
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Skip ${item.title}`}>
            <Text variant="caption" color="textSecondary">
              Skip this song
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Step 3: one screen for the whole life of a transfer. It is read from the server, so it also works after the app restarts. */
export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const query = useTransfer(id);
  const transfer = query.data;
  const jobs = useUploadStore((s) => s.jobs);
  /** Which upload on this phone belongs to which song (the server only knows an upload once it is attached). */
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const status = transfer?.status;
  useEffect(() => {
    if (status === 'completed') {
      haptics.success();
      // The new songs are in the catalogue now: refresh Studio and the music lists.
      void queryClient.invalidateQueries({ queryKey: ['studio'] });
      void queryClient.invalidateQueries({ queryKey: ['music'] });
    }
  }, [status]);

  const counted = useMemo(() => (transfer?.items ?? []).filter(isCounted), [transfer?.items]);
  const jobOf = (item: TransferItem) => (keys[item.id] ? jobs[keys[item.id]] : undefined);

  const run = async (action: () => Promise<Transfer | void>, failure: string) => {
    setBusy(true);
    try {
      const result = await action();
      if (result) setTransferInCache(result);
      else await query.refetch();
    } catch (e) {
      haptics.error();
      Alert.alert(failure, youtubeErrorText(e));
      void query.refetch();
    } finally {
      setBusy(false);
    }
  };

  const pickAudio = async (item: TransferItem) => {
    const upload = uploadHint(item);
    if (!upload) return;
    const picked = await File.pickFileAsync({ mimeTypes: ['audio/*', 'video/*'] });
    if (picked.canceled) return;
    const file = await readable(picked.result);
    if (!file) {
      Alert.alert("Can't read that file", 'Download it to your phone first (for example from iCloud), then choose it again.');
      return;
    }
    const previous = keys[item.id];
    if (previous) dismissUpload(previous);
    haptics.select();
    const [key] = uploadTracks(
      upload.releaseId,
      [
        {
          file,
          title: upload.title,
          explicit: upload.explicit,
          trackNumber: upload.trackNumber,
          handoff: true,
          // Tell the transfer which song this audio is for as soon as the upload exists.
          afterCreate: async (uploadId) => {
            setTransferInCache(await youtubeApi.attachAudio(id, item.id, uploadId));
          },
        },
      ],
      upload.genre,
    );
    setKeys((k) => ({ ...k, [item.id]: key }));
  };

  const removeFile = (item: TransferItem) => {
    Alert.alert(`Remove the file for "${item.title}"?`, 'The file is deleted and its storage is given back. You can add another one.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            const key = keys[item.id];
            if (key) dismissUpload(key);
            return youtubeApi.removeAudio(id, item.id);
          }, "Couldn't remove the file"),
      },
    ]);
  };

  const skip = (item: TransferItem) => {
    Alert.alert(`Skip "${item.title}"?`, "It won't be imported. You can import it another time.", [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Skip',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            const key = keys[item.id];
            if (key) dismissUpload(key);
            await youtubeApi.dropItem(id, item.id);
          }, "Couldn't skip it"),
      },
    ]);
  };

  const confirmCancel = () => {
    haptics.warning();
    Alert.alert('Cancel this transfer?', 'Songs already published stay. The rest are not imported, and you will lose your place in the queue.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Cancel transfer', style: 'destructive', onPress: () => void run(() => youtubeApi.cancel(id), "Couldn't cancel") },
    ]);
  };

  // ---- Loading and errors ----
  if (query.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!transfer) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title={gone ? 'This transfer is gone' : "Can't load your transfer"}
          message={gone ? 'It may have been cancelled or removed.' : youtubeErrorText(query.error)}
          actionLabel={gone ? 'Close' : 'Try again'}
          onAction={() => (gone ? router.dismissAll() : void query.refetch())}
        />
      </View>
    );
  }

  const { progress, queue } = transfer;
  const stillUploading = counted.some((i) => {
    const j = jobOf(i);
    return j && (j.state === 'uploading' || j.state === 'waiting');
  });
  const canStart =
    transfer.status === 'collecting' &&
    counted.length > 0 &&
    !stillUploading &&
    counted.every((i) => i.status !== 'awaiting_audio' && i.status !== 'uploading' && i.status !== 'failed');
  const readyCount = counted.filter((i) => i.status !== 'awaiting_audio' && i.status !== 'uploading' && i.status !== 'failed').length;
  const failedItems = counted.filter((i) => i.status === 'failed').length;

  // ---- Summary at the top, by status ----
  let headline = '';
  let detail = '';
  let icon = <Music2 size={26} color={colors.accent} />;
  if (transfer.status === 'collecting') {
    const needFile = counted.filter((i) => i.status === 'awaiting_audio' || i.status === 'uploading' || i.status === 'failed').length;
    const fetching = counted.filter((i) => i.status === 'fetching').length;
    if (needFile > 0) {
      headline = needFile === 1 ? '1 song needs an audio file' : `${needFile} songs need an audio file`;
      detail = `Choose an audio file (or a video file from YouTube Studio) for ${needFile === 1 ? 'it' : 'each of them'}.${fetching > 0 ? ` ${fetching} more ${fetching === 1 ? 'is' : 'are'} being fetched from YouTube.` : ''} Then start the transfer. ${readyCount} of ${counted.length} ready.`;
    } else if (fetching > 0) {
      headline = 'Getting your audio';
      detail = `${fetching} of ${counted.length} ${fetching === 1 ? 'song is' : 'songs are'} being fetched from YouTube. You can start the transfer now or wait; a song that can't be fetched will ask you for a file.`;
    } else {
      headline = 'Ready to start';
      detail = `Every song has its audio. ${readyCount} of ${counted.length} ready.`;
    }
  } else if (transfer.status === 'queued') {
    headline = queue ? (queue.position <= 1 ? "You're next in line" : `You're number ${queue.position} in line`) : 'Waiting in line';
    detail = queue
      ? `${queue.length} ${queue.length === 1 ? 'transfer is' : 'transfers are'} waiting. You can close the app: your place is kept, and this screen updates when you come back.`
      : 'You can close the app. Your place is kept.';
    icon = <Hourglass size={26} color={colors.accent} />;
  } else if (transfer.status === 'in_progress') {
    headline = 'Importing your music';
    detail = `${progress.itemsDone} of ${counted.length} songs are done. You can keep using the app.`;
  } else if (transfer.status === 'retrying') {
    headline = 'Hit a snag, trying again';
    detail = `${transfer.nextAttemptAt ? `Next attempt about ${new Date(transfer.nextAttemptAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ` : ''}Attempt ${transfer.attempt} of ${transfer.maxAttempts}.${transfer.error ? ` ${transfer.error}` : ''}`;
    icon = <Hourglass size={26} color={colors.accent} />;
  } else if (transfer.status === 'failed') {
    headline = transfer.reason === 'attempts_exhausted' ? "We couldn't finish this transfer" : failedItems === 1 ? '1 song needs attention' : `${failedItems} songs need attention`;
    detail =
      transfer.reason === 'attempts_exhausted'
        ? `We tried ${transfer.maxAttempts} times. ${transfer.error ?? ''}`.trim()
        : 'Songs that worked are published. Retry to fix the rest: those songs need their audio added again.';
    icon = <CircleAlert size={26} color={colors.danger} />;
  } else if (transfer.status === 'cancelled') {
    headline = 'Transfer cancelled';
    detail = 'Nothing more will be imported. Songs that were already published stay on Blac.';
  } else {
    headline = 'All done';
    icon = <CheckCircle2 size={26} color={colors.success} />;
    const published = counted.filter((i) => i.status === 'done').length;
    const skipped = (transfer.items ?? []).filter((i) => i.status === 'skipped_duplicate').length;
    detail = `${published} ${published === 1 ? 'song is' : 'songs are'} now on Blac${skipped > 0 ? `, ${skipped} skipped because they were already there` : ''}.`;
  }

  const showBar = transfer.status === 'in_progress' || transfer.status === 'completed' || transfer.status === 'retrying';
  const visibleItems = (transfer.items ?? []).filter((i) => i.status !== 'dropped');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + (transfer.status === 'collecting' ? 160 : 40), gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>{icon}</View>
            <Text variant="title" style={{ flex: 1 }}>
              {headline}
            </Text>
          </View>
          <Text variant="body" color="textSecondary">
            {detail}
          </Text>
          {showBar ? (
            <View style={{ gap: 6 }}>
              <ProgressBar value={progress.percent / 100} height={8} />
              <Text variant="caption" color="textTertiary" style={{ fontVariant: ['tabular-nums'] }}>
                {progress.percent}%
              </Text>
            </View>
          ) : null}
        </Card>

        <View style={{ gap: 6 }}>
          <Text variant="label" color="textTertiary" style={{ paddingHorizontal: 4 }}>
            Songs · {counted.length}
          </Text>
          <Card style={{ paddingHorizontal: 16 }}>
            {visibleItems.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                job={jobOf(item)}
                transfer={transfer}
                last={index === visibleItems.length - 1}
                onAddAudio={() => void pickAudio(item)}
                onRemoveFile={() => removeFile(item)}
                onSkip={() => skip(item)}
                onRetryUpload={() => {
                  const key = keys[item.id];
                  if (key) retryUpload(key);
                }}
              />
            ))}
          </Card>
        </View>

        {transfer.status === 'completed' ? (
          <View style={{ gap: 10 }}>
            <PrimaryButton
              label="View my catalogue"
              onPress={() => {
                router.dismissAll();
                router.navigate('/studio');
              }}
            />
          </View>
        ) : null}

        {transfer.status === 'failed' ? (
          <PrimaryButton label={busy ? 'Working…' : 'Retry'} disabled={busy} onPress={() => void run(() => youtubeApi.retry(id), "Couldn't retry")} />
        ) : null}

        {transfer.status === 'cancelled' ? <PrimaryButton label="Start a new import" onPress={() => router.replace('/youtube/review')} /> : null}

        {isOpen(transfer) && transfer.status !== 'collecting' ? (
          <Pressable onPress={confirmCancel} disabled={busy} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
            <Text variant="body" color="danger">
              Cancel transfer
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {transfer.status === 'collecting' ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            gap: 8,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <PrimaryButton
            label={busy ? 'Starting…' : canStart ? `Start transfer · ${counted.length} ${counted.length === 1 ? 'song' : 'songs'}` : stillUploading ? 'Waiting for uploads…' : 'Add audio to every song'}
            disabled={!canStart || busy}
            onPress={() => void run(() => youtubeApi.submit(id), "Couldn't start the transfer")}
          />
          <Pressable onPress={confirmCancel} disabled={busy} accessibilityRole="button" style={{ alignItems: 'center', padding: 4 }}>
            <Text variant="caption" color="danger">
              Cancel import
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
