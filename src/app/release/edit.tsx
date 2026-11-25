import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'lucide-react-native';
import { ApiError } from '@/api/blac';
import { useRelease } from '@/api/blac/queries';
import type { ReleaseDetail } from '@/api/blac/studio';
import { studioApi } from '@/api/blac/studio';
import { queryClient } from '@/api/queryClient';
import { Artwork } from '@/components/Artwork';
import { Card } from '@/components/Card';
import { FormField, PrimaryButton } from '@/components/FormField';
import { GenrePicker } from '@/components/GenrePicker';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { chooseCover } from '@/uploads/pickCover';

/** Edit a draft: cover art, title, genre, description and the title of each track. */
export default function EditReleaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const release = useRelease(id);

  if (release.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!release.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title="Couldn't open this release"
          message="It may have been deleted, or you may be offline."
          actionLabel="Close"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  return <EditForm id={id} data={release.data} />;
}

function EditForm({ id, data }: { id: string; data: ReleaseDetail }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // The form starts from the release as it is now; later refreshes of the release do not overwrite typing.
  const [title, setTitle] = useState(data.title);
  const [genre, setGenre] = useState(data.genre ?? '');
  const [description, setDescription] = useState(data.description ?? '');
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.tracks.map((t) => [t.id, t.title])),
  );
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changedTracks = data.tracks.filter((t) => (trackTitles[t.id] ?? t.title).trim() !== t.title);
  const releaseChanged =
    title.trim() !== data.title || genre.trim() !== (data.genre ?? '') || description.trim() !== (data.description ?? '');
  const hasChanges = releaseChanged || cover !== null || changedTracks.length > 0;
  const titleOk = title.trim().length > 0 && changedTracks.every((t) => (trackTitles[t.id] ?? '').trim().length > 0);
  const canSave = hasChanges && titleOk && !busy;

  const pickCover = async () => {
    const file = await chooseCover();
    if (file) setCover(file);
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const coverImageId = cover ? await studioApi.uploadCover(cover) : undefined;
      if (releaseChanged || coverImageId) {
        await studioApi.updateRelease(id, {
          ...(title.trim() !== data.title ? { title } : {}),
          ...(genre.trim() !== (data.genre ?? '') ? { genre } : {}),
          ...(description.trim() !== (data.description ?? '') ? { description } : {}),
          coverImageId,
        });
      }
      for (const t of changedTracks) {
        try {
          await studioApi.updateTrack(t.id, { title: trackTitles[t.id] });
        } catch (e) {
          // Say which song, since the ones before it were saved.
          void queryClient.invalidateQueries({ queryKey: ['studio'] });
          throw new Error(`Couldn't rename “${t.title}”: ${e instanceof Error ? e.message : 'try again.'}`);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['studio'] });
      haptics.success();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Try again.');
      haptics.error();
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: insets.bottom + 40,
          gap: 28,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text variant="display">Edit release</Text>
          <Text variant="body" color="textSecondary">
            Changes apply while it is a draft. Nothing is public yet.
          </Text>
        </View>

        {/* ---- Cover ---- */}
        <View style={{ gap: 12 }}>
          <Text variant="label" color="textTertiary" style={{ paddingHorizontal: 4 }}>
            Cover art
          </Text>
          <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable onPress={pickCover} accessibilityRole="button" accessibilityLabel="Change cover art">
              {cover ? (
                <Image
                  source={{ uri: cover.uri }}
                  style={{ width: 104, height: 104, borderRadius: radius.card, backgroundColor: colors.surfaceAlt }}
                />
              ) : (
                <Artwork id={data.id} logoUrl={data.artworkUrl} size={104} />
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 10 }}>
              <Text variant="caption" color="textSecondary">
                A square picture, at least 200 px wide.
              </Text>
              <Pressable
                onPress={pickCover}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: radius.pill,
                  backgroundColor: colors.primarySoft,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Camera size={16} color={colors.accent} />
                <Text variant="bodyStrong" color="accent">
                  {cover ? 'Choose another' : 'Change cover'}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>

        {/* ---- Details ---- */}
        <View style={{ gap: 12 }}>
          <Text variant="label" color="textTertiary" style={{ paddingHorizontal: 4 }}>
            Details
          </Text>
          <Card style={{ padding: 16, gap: 18 }}>
            <FormField label="Title" value={title} onChangeText={setTitle} maxLength={200} />
            <GenrePicker value={genre} onChange={setGenre} />
            <FormField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Tell listeners about this release"
              multiline
              maxLength={2000}
              style={{ minHeight: 110, textAlignVertical: 'top' }}
            />
          </Card>
        </View>

        {/* ---- Tracks ---- */}
        {data.tracks.length > 0 ? (
          <View style={{ gap: 12 }}>
            <Text variant="label" color="textTertiary" style={{ paddingHorizontal: 4 }}>
              Track titles  ·  {data.tracks.length}
            </Text>
            <Card style={{ padding: 16, gap: 18 }}>
              {data.tracks.map((t, i) => (
                <FormField
                  key={t.id}
                  label={data.type === 'album' ? `Track ${t.trackNumber ?? i + 1}` : 'Track'}
                  value={trackTitles[t.id] ?? t.title}
                  onChangeText={(text) => setTrackTitles((all) => ({ ...all, [t.id]: text }))}
                  maxLength={200}
                />
              ))}
            </Card>
          </View>
        ) : null}

        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}

        <View style={{ gap: 6 }}>
          <PrimaryButton label={busy ? 'Saving…' : 'Save changes'} onPress={save} disabled={!canSave} />
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignItems: 'center', padding: 12 }}>
            <Text variant="body" color="textSecondary">
              Cancel
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
