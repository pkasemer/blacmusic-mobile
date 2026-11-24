import { useRef, useState, type ComponentRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { ApiError, authApi } from '@/api/blac';
import { REQUIRE_EMAIL_CODE } from '@/api/blac/config';
import { AUTH_ACCENT, AUTH_DANGER, AuthField, BrandButton } from '@/components/AuthField';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { Text } from '@/components/Text';
import { haptics } from '@/utils/haptics';
import { openLegal } from '@/utils/legal';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD = 8;

/** A sentence for a failed sign-in or sign-up call. */
function reason(e: unknown, registering: boolean): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'That email and password do not match.';
    if (e.status === 409) return 'There is already an account with that email. Sign in instead, or use Apple or Google if that is how you joined.';
    if (e.status === 429) return 'Too many tries. Wait a minute and try again.';
    if (e.status === 422) return registering ? 'Check your details. The password needs at least 8 characters.' : e.message;
    return e.message;
  }
  return 'Something went wrong. Check your connection and try again.';
}

/**
 * Create an account or sign in with an email and a password. Opened from the sheet on the welcome screen (`mode` says
 * which). A new account is signed in straight away but must confirm its email with a 6 digit code before the app opens
 * (the root layout shows the code screen until it does).
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'login' | 'register'>(params.mode === 'signup' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const registering = mode === 'register';
  const emailOk = EMAIL_PATTERN.test(email.trim());
  const passwordOk = password.length >= (registering ? MIN_PASSWORD : 1);
  const valid = emailOk && passwordOk && (!registering || name.trim().length > 0);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (registering) await authApi.register({ email, password, displayName: name });
      else await authApi.login({ email, password });
      haptics.success();
      // The root layout takes over once the tokens are saved: the code screen for an unconfirmed email, else the app.
    } catch (e) {
      setError(reason(e, registering));
      haptics.error();
      setBusy(false);
    }
  };

  const switchMode = () => {
    haptics.select();
    setMode(registering ? 'login' : 'register');
    setError(null);
  };

  const eye = (
    <Pressable
      onPress={() => setShowPassword((v) => !v)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
      style={{ paddingHorizontal: 14, paddingVertical: 12 }}
    >
      {showPassword ? <EyeOff size={20} color="rgba(255,255,255,0.6)" /> : <Eye size={20} color="rgba(255,255,255,0.6)" />}
    </Pressable>
  );

  return (
    <BrandBackdrop tint="#BB88FF" accents={['#6C8BFF', '#FF7AB8']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 20) + 24, gap: 22 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </Pressable>

          <Animated.View entering={FadeInDown.duration(380)} style={{ gap: 8, paddingTop: 8 }}>
            <Text variant="display" style={{ fontSize: 34, lineHeight: 40 }}>
              {registering ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text variant="body" color="textSecondary">
              {registering
                ? REQUIRE_EMAIL_CODE
                  ? 'It takes a minute. We will email you a 6 digit code to confirm it is you.'
                  : 'It takes a minute. Listen to music and, if you like, share your own.'
                : 'Sign in to pick up where you left off.'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(380)} style={{ gap: 18 }}>
            {registering ? (
              <AuthField
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="What should we call you?"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                maxLength={50}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            ) : null}
            <AuthField
              inputRef={emailRef}
              label="Email"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmailTouched(true)}
              error={emailTouched && email.length > 0 && !emailOk ? 'That does not look like an email address.' : null}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <View style={{ gap: 10 }}>
              <AuthField
                inputRef={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder={registering ? 'At least 8 characters' : 'Your password'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType={registering ? 'newPassword' : 'password'}
                autoComplete={registering ? 'new-password' : 'current-password'}
                returnKeyType="go"
                onSubmitEditing={submit}
                right={eye}
              />
              {registering ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: password.length >= MIN_PASSWORD ? AUTH_ACCENT : 'rgba(255,255,255,0.12)',
                    }}
                  >
                    {password.length >= MIN_PASSWORD ? <Check size={12} color="#121212" strokeWidth={3} /> : null}
                  </View>
                  <Text variant="caption" color={password.length >= MIN_PASSWORD ? 'textSecondary' : 'textTertiary'}>
                    At least {MIN_PASSWORD} characters
                  </Text>
                </View>
              ) : null}
            </View>
          </Animated.View>

          {error ? (
            <Text variant="caption" style={{ color: AUTH_DANGER }}>
              {error}
            </Text>
          ) : null}

          <View style={{ gap: 8 }}>
            <BrandButton label={registering ? 'Create account' : 'Sign in'} onPress={submit} disabled={!valid} busy={busy} />
            <Pressable onPress={switchMode} disabled={busy} accessibilityRole="button" style={{ alignItems: 'center', padding: 12 }}>
              <Text variant="body" color="textSecondary">
                {registering ? 'Already have an account? ' : 'New to Blac? '}
                <Text variant="bodyStrong" color="accent">
                  {registering ? 'Sign in' : 'Create an account'}
                </Text>
              </Text>
            </Pressable>
          </View>

          {registering ? (
            <Text variant="caption" color="textTertiary" style={{ textAlign: 'center', paddingHorizontal: 12 }}>
              By creating an account you agree to Blac&apos;s{' '}
              <Text variant="caption" color="textSecondary" style={{ textDecorationLine: 'underline' }} onPress={() => openLegal('terms')} accessibilityRole="link">
                Terms
              </Text>{' '}
              and{' '}
              <Text variant="caption" color="textSecondary" style={{ textDecorationLine: 'underline' }} onPress={() => openLegal('privacy')} accessibilityRole="link">
                Privacy Policy
              </Text>
              .
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </BrandBackdrop>
  );
}
