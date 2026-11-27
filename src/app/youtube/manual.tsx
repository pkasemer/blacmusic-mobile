import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X } from 'lucide-react-native';
import { ApiError } from '@/api/blac';
import { youtubeApi, type NewTransferItem } from '@/api/blac/youtube';
import { setTransferInCache, youtubeErrorText } from '@/api/blac/youtubeQueries';
import { TERMS_VERSION } from '@/api/blac/studio';
import { Checkbox } from '@/components/Checkbox';
import { GenrePicker } from '@/components/GenrePicker';
import { Text } from '@/components/Text';
import { useArtistStore } from '@/store/artistStore';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { offerPush } from '@/notifications/push';
import { haptics } from '@/utils/haptics';
import { ScreenState } from '@/components/ScreenState';

const MAX_SONGS = 20;

interface Draft {
  id: string;
  title: string;
}

const newDraft = (): Draft => ({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, title: '' });

/** Upload songs from your phone: name them, then choose the audio file for each on the next screen. */
export default function ManualSongsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useArtistStore((s) => s.profile);
  const [songs, setSongs] = useState<Draft[]>(() => [newDraft()]);
  const [genre, setGenre] = useState('');
  const [asAlbum, setAsAlbum] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const named = songs.filter((s) => s.title.trim().length > 0);
  const canGroup = named.length >= 2;
  const albumOk = !asAlbum || !canGroup || albumTitle.trim().length > 0;
  const canContinue = named.length > 0 && rights && albumOk && !busy;

  const setTitle = (id: string, title: string) => setSongs((list) => list.map((s) => (s.id === id ? { ...s, title } : s)));
  const addSong = () => {
    haptics.select();
    setSongs((list) => (list.length >= MAX_SONGS ? list : [...list, newDraft()]));
  };
  const removeSong = (id: string) => {
    haptics.select();
    setSongs((list) => (list.length > 1 ? list.filter((s) => s.id !== id) : list));
  };

  const start = async () => {
    if (!canContinue) return;
    setBusy(true);
    setError(null);
    try {
      const items: NewTransferItem[] = named.map((s) => ({
        title: s.title.trim(),
        ...(genre ? { genre } : {}),
        ...(asAlbum && canGroup ? { releaseType: 'album' as const, albumTitle: albumTitle.trim() } : { releaseType: 'single' as const }),
      }));
      const transfer = await youtubeApi.createTransfer(items, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, {
        termsVersion: TERMS_VERSION,
      });
      setTransferInCache(transfer);
      haptics.success();
      router.replace({ pathname: '/youtube/transfer/[id]', params: { id: transfer.id } });
      void offerPush(
        profile?.reviewRequired ? "We'll tell you when your songs are verified, even if the app is closed." : "We'll tell you when your songs are published, even if the app is closed.",
      );
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
      setError(youtubeErrorText(e));
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="empty"
          title="Create your artist profile first"
          message="Songs are added to your artist profile."
          actionLabel="Become an artist"
          onAction={() => router.replace('/become-artist')}
        />
      </View>
    );
  }

  const input = {
    ...fontStyle('rounded', '400'),
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 230, gap: 22 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6 }}>
          <Text variant="title">Upload from your phone</Text>
          <Text variant="body" color="textSecondary">
            Name your songs, then choose the audio file for each one on the next screen.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text variant="label" color="textTertiary">
            Songs · {named.length}
          </Text>
          {songs.map((song, index) => (
            <View key={song.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput
                value={song.title}
                onChangeText={(t) => setTitle(song.id, t)}
                placeholder={index === 0 ? 'Song title' : `Song ${index + 1}`}
                placeholderTextColor={colors.textTertiary}
                maxLength={200}
                accessibilityLabel={`Song ${index + 1} title`}
                style={{ ...input, flex: 1 }}
              />
              {songs.length > 1 ? (
                <Pressable onPress={() => removeSong(song.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove song ${index + 1}`}>
                  <X size={20} color={colors.textTertiary} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {songs.length < MAX_SONGS ? (
            <Pressable onPress={addSong} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
              <Plus size={18} color={colors.accent} />
              <Text variant="bodyStrong" color="accent">
                Add another song
              </Text>
            </Pressable>
          ) : null}
        </View>

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
              <TextInput value={albumTitle} onChangeText={setAlbumTitle} placeholder="Album title" placeholderTextColor={colors.textTertiary} maxLength={200} style={input} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

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
            I own this music, or I have the rights to share it on Blac, and I accept the upload terms.
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
              {named.length === 0 ? 'Name at least one song' : `Continue with ${named.length} ${named.length === 1 ? 'song' : 'songs'}`}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
