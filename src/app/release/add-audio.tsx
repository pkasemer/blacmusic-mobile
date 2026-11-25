import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Music } from 'lucide-react-native';
import { useRelease } from '@/api/blac/queries';
import { queryClient } from '@/api/queryClient';
import { Checkbox } from '@/components/Checkbox';
import { PrimaryButton } from '@/components/FormField';
import { PickedTrackCard } from '@/components/PickedTrackCard';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { useUploadStore } from '@/store/uploadStore';
import { radius, useTheme } from '@/theme';
import { pickAudioFiles, type PickedTrack } from '@/uploads/pickAudio';
import { uploadTracks } from '@/uploads/uploadManager';
import { haptics } from '@/utils/haptics';

/**
 * Add audio to a draft that already exists: one file for a single that has none, any number of files for an album.
 * Each file gets a title (editable, starting from the file name) before it goes up.
 */
export default function AddAudioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const release = useRelease(id);
  const data = release.data;
  const allJobs = useUploadStore((s) => s.jobs);
  const [tracks, setTracks] = useState<PickedTrack[]>([]);
  const [rights, setRights] = useState(false);

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
        <ScreenState kind="error" title="Couldn't open this release" message="It may have been deleted, or you may be offline." actionLabel="Close" onAction={() => router.back()} />
      </View>
    );
  }

  const album = data.type === 'album';
  const draft = data.visibility !== 'public' && data.visibility !== 'scheduled';
  // Files already on the way count toward the track numbers and toward a single's one slot.
  // (Finished uploads are already tracks; failed ones are not coming.)
  const serverPending = (data.uploads ?? []).filter((u) => u.status === 'pending' || u.status === 'queued' || u.status === 'processing').length;
  const notYetCreated = Object.values(allJobs).filter((j) => j.releaseId === id && j.state !== 'failed' && !j.uploadId).length;
  const existing = data.tracks.length + serverPending + notYetCreated;
  const singleFull = !album && existing > 0;

  const pick = async () => {
    const next = await pickAudioFiles(album);
    if (next.length === 0) return;
    setTracks((current) => (album ? [...current, ...next] : next.slice(0, 1)));
  };

  const canUpload = draft && !singleFull && tracks.length > 0 && tracks.every((t) => t.title.trim().length > 0) && rights;

  const upload = () => {
    if (!canUpload) return;
    uploadTracks(
      id,
      tracks.map((t, i) => ({
        file: t.file,
        title: t.title.trim(),
        explicit: t.explicit,
        trackNumber: album ? existing + i + 1 : undefined,
      })),
      data.genre,
    );
    void queryClient.invalidateQueries({ queryKey: ['studio'] });
    haptics.success();
    router.back();
  };

  const blocked = !draft
    ? 'This release is live or scheduled. Take it back to draft on the release screen to add audio.'
    : singleFull
      ? 'A single has one track. To change its audio, use the replace button next to the track on the release screen.'
      : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, 16) + 12, paddingBottom: insets.bottom + 32, gap: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text variant="display">{album ? 'Add tracks' : 'Add audio'}</Text>
          <Text variant="body" color="textSecondary">
            {album ? `To “${data.title}”. Choose one or more files, and check each title before they upload.` : `To “${data.title}”. Check the title before it uploads.`}
          </Text>
        </View>

        {blocked ? (
          <Text variant="body" color="textSecondary">
            {blocked}
          </Text>
        ) : (
          <>
            <View style={{ gap: 10 }}>
              {tracks.map((t, i) => (
                <PickedTrackCard
                  key={t.key}
                  track={t}
                  number={album ? existing + i + 1 : undefined}
                  onChange={(patch) => setTracks((all) => all.map((x) => (x.key === t.key ? { ...x, ...patch } : x)))}
                  onRemove={() => setTracks((all) => all.filter((x) => x.key !== t.key))}
                />
              ))}
              {album || tracks.length === 0 ? (
                <Pressable
                  onPress={pick}
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
                    {tracks.length === 0 ? (album ? 'Choose audio files' : 'Choose audio file') : 'Add more files'}
                  </Text>
                </Pressable>
              ) : null}
              <Text variant="caption" color="textTertiary">
                MP3, M4A, FLAC, WAV, OGG or AIFF, up to 2 GB each. We make low, standard and high quality copies for listeners.
              </Text>
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
              <Checkbox checked={rights} />
              <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
                I own this music, or I have the rights to share it on Blac, and I accept the upload terms.
              </Text>
            </Pressable>

            <PrimaryButton label={tracks.length > 1 ? `Upload ${tracks.length} tracks` : 'Upload'} onPress={upload} disabled={!canUpload} />
          </>
        )}

        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
          <Text variant="body" color="textSecondary">
            {blocked ? 'Close' : 'Cancel'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
