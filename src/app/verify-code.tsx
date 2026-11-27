import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, type SharedValue, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail } from 'lucide-react-native';
import { ApiError, authApi } from '@/api/blac';
import { AUTH_ACCENT, AUTH_DANGER, BrandButton } from '@/components/AuthField';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { Text } from '@/components/Text';
import { signOut } from '@/auth/session';
import { useAuthStore } from '@/store/authStore';
import { radius } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';

const CODE_LENGTH = 6;

/** A quick side-to-side shake of the code boxes for a wrong code. */
function playShake(offset: SharedValue<number>) {
  offset.value = withSequence(withTiming(-10, { duration: 50 }), withRepeat(withTiming(10, { duration: 90 }), 5, true), withTiming(0, { duration: 50 }));
}

/** A sentence for a failed "send the code" call. */
function sendReason(e: unknown): string {
  if (e instanceof ApiError && e.code === 'email_unavailable') return "We couldn't send the email just now. Try again in a moment.";
  if (e instanceof ApiError) return e.message;
  return "We couldn't send the code. Check your connection and try again.";
}

/**
 * Shown right after sign-up (and after signing in to an account whose email was never confirmed). The app stays closed
 * until the 6 digit code from the email is entered, so every account has an email that really belongs to someone.
 */
export default function VerifyCodeScreen() {
  const insets = useSafeAreaInsets();
  const email = useAuthStore((s) => s.user?.email);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const send = useCallback(async () => {
    try {
      const result = await authApi.sendVerificationCode();
      if (result.alreadyVerified) {
        // Nothing to confirm: re-reading the account opens the app.
        await authApi.refreshMe();
        return;
      }
      setSent(true);
      setWaitSeconds(result.resendAfterSeconds);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_soon') {
        // A code went out a moment ago and is still good.
        setSent(true);
        setWaitSeconds(60);
      } else {
        setError(sendReason(e));
      }
    }
  }, []);

  // Email a code as soon as the screen opens.
  useEffect(() => {
    const timer = setTimeout(() => void send(), 0);
    return () => clearTimeout(timer);
  }, [send]);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  const submit = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.verifyEmail(value);
      haptics.success();
      // The root layout opens the app as soon as the account is marked as confirmed.
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'invalid_code'
          ? 'That code is not right, or it has expired. Check it or ask for a new one.'
          : e instanceof ApiError
            ? e.message
            : 'Something went wrong. Try again.',
      );
      haptics.error();
      setCode('');
      playShake(shake);
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const onChange = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(clean);
    if (error) setError(null);
    if (clean.length === CODE_LENGTH) void submit(clean);
  };

  const resend = () => {
    haptics.select();
    setError(null);
    setCode('');
    void send();
  };

  return (
    <BrandBackdrop tint="#BB88FF" accents={['#6C8BFF', '#FF7AB8']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 56, paddingBottom: Math.max(insets.bottom, 20) + 24, gap: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(380)} style={{ gap: 14 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(187,136,255,0.18)',
              }}
            >
              <Mail size={30} color={AUTH_ACCENT} />
            </View>
            <Text variant="display" style={{ fontSize: 34, lineHeight: 40 }}>
              Check your email
            </Text>
            <Text variant="body" color="textSecondary">
              {sent ? 'We sent a 6 digit code to ' : 'Sending a 6 digit code to '}
              <Text variant="bodyStrong">{email ?? 'your email'}</Text>
              {sent ? '. It works for 30 minutes.' : '…'}
            </Text>
          </Animated.View>

          {/* Six boxes for show; one invisible text box on top takes the typing (and the code iOS suggests from Mail). */}
          <Animated.View entering={FadeInDown.delay(80).duration(380)} style={shakeStyle}>
            <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Enter the 6 digit code" style={{ flexDirection: 'row', gap: 10 }}>
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const active = focused && i === Math.min(code.length, CODE_LENGTH - 1);
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 62,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: error ? AUTH_DANGER : active ? AUTH_ACCENT : 'rgba(255,255,255,0.16)',
                      backgroundColor: code[i] ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
                    }}
                  >
                    {/* The line height must grow with the size, or the digit is cut. Very large text settings stop at what fits the box. */}
                    <Text maxFontSizeMultiplier={1.3} style={{ ...fontStyle('rounded', '600'), fontSize: 28, lineHeight: 36, color: '#FFFFFF' }}>
                      {code[i] ?? ''}
                    </Text>
                  </View>
                );
              })}
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={onChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                caretHidden
                editable={!busy}
                accessibilityLabel="Code"
                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.02 }}
              />
            </Pressable>
          </Animated.View>

          {error ? (
            <Text variant="caption" style={{ color: AUTH_DANGER }}>
              {error}
            </Text>
          ) : null}

          <View style={{ gap: 6 }}>
            <BrandButton label="Confirm" onPress={() => void submit(code)} disabled={code.length !== CODE_LENGTH} busy={busy} />
            <Pressable
              onPress={resend}
              disabled={waitSeconds > 0 || busy}
              accessibilityRole="button"
              style={{ alignItems: 'center', padding: 12, opacity: waitSeconds > 0 ? 0.5 : 1 }}
            >
              <Text variant="body" color="textSecondary">
                {waitSeconds > 0 ? `Send a new code in ${waitSeconds}s` : "Didn't get it? Send a new code"}
              </Text>
            </Pressable>
            <Text variant="caption" color="textTertiary" style={{ textAlign: 'center', paddingHorizontal: 16 }}>
              Check your spam folder too. The email comes from Blac.
            </Text>
          </View>

          <Pressable
            onPress={() => {
              haptics.select();
              void signOut();
            }}
            accessibilityRole="button"
            style={{ alignItems: 'center', padding: 12 }}
          >
            <Text variant="body" color="textSecondary">
              Wrong email? <Text variant="bodyStrong" color="accent">Sign out</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </BrandBackdrop>
  );
}
