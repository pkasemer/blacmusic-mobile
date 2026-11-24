import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, blacApi, USES_BACKEND } from '@/api/blac';
import { syncAccount } from '@/auth/session';
import { Text } from '@/components/Text';
import { useArtistStore } from '@/store/artistStore';
import { useAuthStore } from '@/store/authStore';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';

/** Create an artist profile. Anyone can; a verified badge is a separate request, reviewed by the Blac team. */
export default function BecomeArtistScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setProfile = useArtistStore((s) => s.setProfile);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = name.trim().length >= 2 && !busy;

  // Artists need a confirmed email: send people to confirm it first.
  const needsEmailCheck = useAuthStore((s) => USES_BACKEND && s.user !== null && !s.user.emailVerified);
  useEffect(() => {
    if (needsEmailCheck) router.replace('/verify-email');
  }, [needsEmailCheck, router]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const artist = await blacApi.createArtistProfile({ name, bio });
      setProfile(artist);
      haptics.success();
      router.replace('/(tabs)/studio');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'email_not_verified') {
        router.replace('/verify-email');
        return;
      }
      if (e instanceof ApiError && e.code === 'artist_exists') {
        await syncAccount(); // they already have a profile: load it
        router.replace('/(tabs)/studio');
        return;
      }
      setError(
        e instanceof ApiError && e.status !== 0
          ? e.message
          : "We couldn't create your profile. Check your connection and try again.",
      );
      haptics.error();
    } finally {
      setBusy(false);
    }
  };

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, 16) + 12, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text variant="display">Become an artist</Text>
          <Text variant="body" color="textSecondary">
            Share your music and podcasts on Blac. You get 10 GB of free storage. A verified badge needs approval, and you
            can ask for it after you sign up.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" color="textTertiary">
            Artist name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="The name listeners will see"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="words"
            maxLength={60}
            style={input}
            accessibilityLabel="Artist name"
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" color="textTertiary">
            Bio (optional)
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell listeners about you"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={400}
            style={[input, { minHeight: 100, textAlignVertical: 'top' }]}
            accessibilityLabel="Bio"
          />
        </View>

        <Text variant="caption" color="textTertiary">
          By continuing you confirm that you own, or have the rights to, anything you upload.
        </Text>

        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          style={({ pressed }) => ({
            alignItems: 'center',
            paddingVertical: 15,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            opacity: !canSubmit ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          <Text variant="bodyStrong" color="onPrimary">
            {busy ? 'Creating…' : 'Create artist profile'}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
          <Text variant="body" color="textSecondary">
            Not now
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
