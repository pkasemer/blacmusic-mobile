import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, authApi } from '@/api/blac';
import { FormField, PrimaryButton } from '@/components/FormField';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

/** Confirms the account's email with a 6 digit code. Needed before creating an artist profile. */
export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const email = useAuthStore((s) => s.user?.email);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const finish = useCallback(() => router.replace('/become-artist'), [router]);

  const send = useCallback(async () => {
    try {
      const result = await authApi.sendVerificationCode();
      if (result.alreadyVerified) {
        await authApi.refreshMe();
        finish();
        return;
      }
      setSent(true);
      setWaitSeconds(result.resendAfterSeconds);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_soon') {
        setSent(true);
        setWaitSeconds(60);
      } else {
        setError(e instanceof ApiError ? e.message : "We couldn't send the code. Try again.");
      }
    }
  }, [finish]);

  // Send a code as soon as the screen opens.
  useEffect(() => {
    const timer = setTimeout(() => void send(), 0);
    return () => clearTimeout(timer);
  }, [send]);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  const submit = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.verifyEmail(code);
      haptics.success();
      finish();
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'invalid_code'
          ? 'That code is not right, or it has expired. Check it or ask for a new one.'
          : e instanceof ApiError
            ? e.message
            : 'Something went wrong. Try again.',
      );
      haptics.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, 16) + 12, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text variant="display">Confirm your email</Text>
          <Text variant="body" color="textSecondary">
            {sent
              ? `We sent a 6 digit code to ${email ?? 'your email'}. It works for 30 minutes.`
              : 'Artists need a confirmed email. We are sending you a code.'}
          </Text>
        </View>

        <FormField
          label="Code"
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          onSubmitEditing={submit}
          style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
        />

        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}

        <PrimaryButton label={busy ? 'Checking…' : 'Confirm'} onPress={submit} disabled={code.length !== 6 || busy} />

        <Pressable
          onPress={() => {
            haptics.select();
            setError(null);
            void send();
          }}
          disabled={waitSeconds > 0}
          accessibilityRole="button"
          style={{ alignItems: 'center', padding: 8, opacity: waitSeconds > 0 ? 0.5 : 1 }}
        >
          <Text variant="body" color="textSecondary">
            {waitSeconds > 0 ? `Send a new code in ${waitSeconds}s` : 'Send a new code'}
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
