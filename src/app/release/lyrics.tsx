import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/blac';
import { fetchLyricsForEdit, removeLyrics, saveLyrics } from '@/api/blac/lyrics';
import { LyricsFormatHelp, LyricsProblems } from '@/components/LyricsFormatHelp';
import { checkLyrics } from '@/domain/lyricsFormat';
import { PrimaryButton } from '@/components/FormField';
import { Text } from '@/components/Text';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';
import { withStudioGuard } from '@/components/SuspendedStudio';

/**
 * Add, change or remove the lyrics of one of your tracks. Plain text shows as scrolling lyrics; text with time stamps
 * like [01:23.45] (the common LRC format) makes timed lyrics that follow the song and light up line by line, and each
 * of those lines may have its English translation on the line below.
 */
function LyricsEditorScreen() {
  const { id, title, duration } = useLocalSearchParams<{ id: string; title?: string; duration?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [original, setOriginal] = useState('');
  const [wasTimed, setWasTimed] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLyricsForEdit(id)
      .then((current) => {
        if (cancelled) return;
        setOriginal(current?.text ?? '');
        setText(current?.text ?? '');
        setWasTimed(current?.synced === true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const changed = text.trim() !== original.trim();
  const checked = checkLyrics(text, Number(duration) || undefined);
  const { timed, errors } = checked;
  const untranslated = checked.lines.filter((l) => l.text && !l.translation).length;
  const translated = checked.lines.filter((l) => l.translation).length;
  // Plain text typed over timed lyrics loses the timing: say so.
  const losesTiming = wasTimed && changed && !timed;

  const save = async () => {
    if (!changed || busy || errors.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      let lost = false;
      if (text.trim() === '') await removeLyrics(id);
      else lost = (await saveLyrics(id, text)).translationsLost;
      haptics.success();
      if (lost) Alert.alert('Saved without translations', "The lyrics and their times are saved. Blac can't keep translations yet, so add them again later.");
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
      haptics.error();
      setBusy(false);
    }
  };

  const remove = () => {
    haptics.warning();
    Alert.alert('Remove the lyrics?', 'Listeners will no longer see lyrics for this song.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeLyrics(id);
            router.back();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, 16) + 12, paddingBottom: insets.bottom + 32, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text variant="display">Lyrics</Text>
          <Text variant="body" color="textSecondary" numberOfLines={2}>
            {title ? `For “${title}”. ` : ''}Paste or type the lyrics. Add time stamps to make them follow the song.
          </Text>
        </View>
        <LyricsFormatHelp />

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
        ) : (
          <>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={'[00:12.50]First line\nIts English translation (optional)\n[00:17.20]Second line'}
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="sentences"
              autoCorrect={false}
              maxLength={20000}
              accessibilityLabel="Lyrics"
              style={{
                minHeight: 320,
                textAlignVertical: 'top',
                ...fontStyle('rounded', '400'),
                fontSize: 16,
                lineHeight: 23,
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                padding: 14,
              }}
            />
            <Text variant="caption" color="textTertiary">
              {timed
                ? errors.length > 0
                  ? 'Fix the lines below to save.'
                  : `${checked.lines.length} timed ${checked.lines.length === 1 ? 'line' : 'lines'} · ${translated} with a translation${translated > 0 && untranslated > 0 ? ` · ${untranslated} without` : ''}`
                : 'Plain lyrics scroll while the song plays. Translations need time stamps.'}
            </Text>
            <LyricsProblems errors={errors} />
            {losesTiming ? (
              <Text variant="caption" color="danger">
                Saving plain text removes the timing of the current lyrics.
              </Text>
            ) : null}
            {error ? (
              <Text variant="caption" color="danger">
                {error}
              </Text>
            ) : null}
            <PrimaryButton label={busy ? 'Saving…' : text.trim() === '' && original ? 'Remove lyrics' : 'Save lyrics'} onPress={save} disabled={!changed || busy || errors.length > 0} />
            {original ? (
              <Pressable onPress={remove} disabled={busy} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
                <Text variant="body" color="danger">
                  Remove lyrics
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
          <Text variant="body" color="textSecondary">
            Cancel
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default withStudioGuard(LyricsEditorScreen, { modal: true });
