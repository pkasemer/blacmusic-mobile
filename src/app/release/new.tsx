import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ImagePlus, Music } from 'lucide-react-native';
import { ApiError, USES_BACKEND } from '@/api/blac';
import { studioApi } from '@/api/blac/studio';
import { queryClient } from '@/api/queryClient';
import { GoLiveChoice } from '@/components/DateTimeField';
import { GenrePicker } from '@/components/GenrePicker';
import { FormField, PrimaryButton } from '@/components/FormField';
import { Chip } from '@/components/Chip';
import { Text } from '@/components/Text';
import { useScheduleStore } from '@/store/scheduleStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { PickedTrackCard } from '@/components/PickedTrackCard';
import { pickAudioFiles, type PickedTrack } from '@/uploads/pickAudio';
import { chooseCover } from '@/uploads/pickCover';
import { uploadTracks } from '@/uploads/uploadManager';
import { withStudioGuard } from '@/components/SuspendedStudio';

/** Create a release (single or album): cover, details and audio files. Files upload in the background. */
function NewReleaseScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [type, setType] = useState<'single' | 'album'>('single');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  /** When it should go live (epoch ms). `null` = the artist publishes by hand, which is the default. */
  const [goLiveAt, setGoLiveAt] = useState<number | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [tracks, setTracks] = useState<PickedTrack[]>([]);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = USES_BACKEND && title.trim().length > 0 && tracks.length > 0 && rights && !busy;

  const pickAudio = async () => {
    const next = await pickAudioFiles(type === 'album');
    if (next.length === 0) return;
    setTracks((current) => (type === 'single' ? next.slice(0, 1) : [...current, ...next]));
    if (!title.trim() && next[0]) setTitle(next[0].title);
  };

  const pickCover = async () => {
    const file = await chooseCover();
    if (file) setCover(file);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const coverImageId = cover ? await studioApi.uploadCover(cover) : undefined;
      const releaseId = await studioApi.createRelease({ type, title, description, genre, coverImageId });
      // A release can only be scheduled once its files are processed, so the chosen time waits on the release screen.
      if (goLiveAt !== null) useScheduleStore.getState().set(releaseId, goLiveAt);
      uploadTracks(
        releaseId,
        tracks.map((t, i) => ({
          file: t.file,
          title: t.title,
          explicit: t.explicit,
          trackNumber: type === 'album' ? i + 1 : undefined,
        })),
        genre,
      );
      void queryClient.invalidateQueries({ queryKey: ['studio'] });
      haptics.success();
      router.replace({ pathname: '/release/[id]', params: { id: releaseId } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Try again.');
      haptics.error();
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, 16) + 12, paddingBottom: insets.bottom + 32, gap: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text variant="display">New release</Text>
          <Text variant="body" color="textSecondary">
            It stays private as a draft until it goes live. You can edit it and listen to it first.
          </Text>
        </View>

        {!USES_BACKEND ? (
          <Text variant="caption" color="danger">
            Uploads need the Blac backend. This build is using sample data.
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Single" selected={type === 'single'} onPress={() => { setType('single'); setTracks((t) => t.slice(0, 1)); }} />
          <Chip label="Album or EP" selected={type === 'album'} onPress={() => setType('album')} />
        </View>

        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Pressable
            onPress={pickCover}
            accessibilityRole="button"
            accessibilityLabel="Choose cover art"
            style={{
              width: 96,
              height: 96,
              borderRadius: radius.card,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {cover ? (
              <Image source={{ uri: cover.uri }} style={{ width: 96, height: 96 }} />
            ) : (
              <ImagePlus size={28} color={colors.textTertiary} />
            )}
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="bodyStrong">Cover art</Text>
            <Text variant="caption" color="textSecondary">
              A square picture, at least 200 px wide. Optional.
            </Text>
          </View>
        </View>

        <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Name of the release" maxLength={200} />
        <GenrePicker label="Genre (optional)" value={genre} onChange={setGenre} />
        <FormField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Tell listeners about this release"
          multiline
          maxLength={2000}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />

        <View style={{ gap: 10 }}>
          <Text variant="label" color="textTertiary">
            {type === 'single' ? 'Audio file' : 'Tracks'}
          </Text>
          {tracks.map((t, i) => (
            <PickedTrackCard
              key={t.key}
              track={t}
              number={type === 'album' ? i + 1 : undefined}
              onChange={(patch) => setTracks((all) => all.map((x) => (x.key === t.key ? { ...x, ...patch } : x)))}
              onRemove={() => setTracks((all) => all.filter((x) => x.key !== t.key))}
            />
          ))}
          {type === 'album' || tracks.length === 0 ? (
            <Pressable
              onPress={pickAudio}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                borderRadius: radius.pill,
                backgroundColor: colors.primarySoft,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Music size={18} color={colors.accent} />
              <Text variant="bodyStrong" color="accent">
                {tracks.length === 0 ? (type === 'single' ? 'Choose audio file' : 'Choose audio files') : 'Add more files'}
              </Text>
            </Pressable>
          ) : null}
          <Text variant="caption" color="textTertiary">
            MP3, M4A, FLAC, WAV, OGG or AIFF, up to 2 GB each. We make low, standard and high quality copies for listeners.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Text variant="label" color="textTertiary">
            Go live
          </Text>
          <GoLiveChoice scheduledFor={goLiveAt} onChange={setGoLiveAt} />
        </View>

        <Pressable
          onPress={() => {
            haptics.select();
            setRights((r) => !r);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rights }}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: rights ? colors.primary : colors.borderStrong,
              backgroundColor: rights ? colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {rights ? <Check size={16} color={colors.onPrimary} /> : null}
          </View>
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
            I own this music, or I have the rights to share it on Blac, and I accept the upload terms.
          </Text>
        </Pressable>

        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}

        <PrimaryButton label={busy ? 'Creating…' : 'Create and upload'} onPress={submit} disabled={!canSubmit} />
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
          <Text variant="body" color="textSecondary">
            Cancel
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default withStudioGuard(NewReleaseScreen, { modal: true });
