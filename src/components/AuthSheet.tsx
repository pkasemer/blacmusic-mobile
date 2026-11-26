import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Mail } from 'lucide-react-native';
import { ApiError, authApi } from '@/api/blac';
import { GOOGLE_REDIRECT } from '@/api/blac/auth';
import { darkColors, radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';
import { openLegal } from '@/utils/legal';
import { BottomSheet } from './BottomSheet';
import { GoogleLogo } from './GoogleLogo';
import { Text } from './Text';

export type AuthMode = 'signin' | 'signup';

/** A sentence for a Google sign-in redirect that came back with an error. */
function googleReason(reason: string): string {
  switch (reason) {
    case 'access_denied':
      return "You didn't allow access, so nothing was done. You can try again whenever you like.";
    case 'no_email':
      return "Google didn't share an email address, which Blac needs to make your account.";
    case 'state_expired':
      return 'That took too long and the sign-in expired. Please try again.';
    case 'unavailable':
      return "Google sign-in isn't available yet.";
    default:
      return "Google couldn't finish signing you in. Please try again.";
  }
}

/** A sentence for a failed provider sign-in call. */
function providerError(e: unknown, provider: 'Google' | 'Apple'): string {
  if (e instanceof ApiError) {
    if (e.code === 'provider_unavailable' || e.status === 404 || e.status === 503) return `Sign in with ${provider} isn't available yet. Use your email for now.`;
    if (e.code === 'email_conflict') return 'An account with that email already exists. Sign in with your email and password instead.';
    if (e.code === 'invalid_token') return `${provider} couldn't confirm who you are. Please try again.`;
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

function OptionButton({
  label,
  icon,
  onPress,
  busy,
  disabled,
  tone = 'outline',
  onBrand,
}: {
  onBrand?: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: 'outline' | 'light';
}) {
  const { colors: theme } = useTheme();
  const colors = onBrand ? darkColors : theme;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        height: 54,
        borderRadius: radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: tone === 'light' ? '#DADCE0' : colors.borderStrong,
        backgroundColor: tone === 'light' ? '#FFFFFF' : 'transparent',
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={tone === 'light' ? '#3C4043' : colors.text} /> : icon}
      <Text variant="bodyStrong" style={{ ...fontStyle('rounded', '600'), fontSize: 16, color: tone === 'light' ? '#3C4043' : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The Apple, Google and email buttons. `onBrand`: drawn straight onto the black first screens, without a heading. */
export function AuthOptions({
  mode,
  dismiss,
  onEmail,
  onSwitchMode,
  onBrand,
}: {
  onBrand?: boolean;
  mode: AuthMode;
  dismiss: (after?: () => void) => void;
  onEmail: () => void;
  onSwitchMode: () => void;
}) {
  const theme = useTheme();
  const colors = onBrand ? darkColors : theme.colors;
  const isDark = onBrand || theme.isDark;
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleReady, setAppleReady] = useState(false);
  const signup = mode === 'signup';

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setAppleReady(ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const apple = async () => {
    haptics.select();
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) throw new Error('Apple did not return a sign-in token.');
      setBusy('apple');
      await authApi.signInWithApple({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        fullName: credential.fullName,
        email: credential.email,
      });
      haptics.success();
      // The root layout swaps to the app as soon as the tokens are saved.
    } catch (e) {
      // Closing Apple's sheet is not an error.
      if (typeof e === 'object' && e && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED') {
        setBusy(null);
        return;
      }
      haptics.error();
      setError(providerError(e, 'Apple'));
      setBusy(null);
    }
  };

  const google = async () => {
    haptics.select();
    setError(null);
    setBusy('google');
    try {
      const { authUrl } = await authApi.startGoogle();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, GOOGLE_REDIRECT);
      if (result.type !== 'success') {
        setBusy(null);
        return; // closed the Google page
      }
      const query = Linking.parse(result.url).queryParams;
      if (query?.status !== 'ok' || typeof query.code !== 'string') {
        setError(googleReason(String(query?.reason ?? '')));
        haptics.error();
        setBusy(null);
        return;
      }
      await authApi.signInWithGoogle(query.code);
      haptics.success();
    } catch (e) {
      haptics.error();
      setError(providerError(e, 'Google'));
      setBusy(null);
    }
  };

  return (
    <View style={{ paddingHorizontal: 20, gap: 12 }}>
      {onBrand ? null : (
        <View style={{ gap: 4, paddingBottom: 6 }}>
          <Text variant="title">{signup ? 'Create your account' : 'Sign in to Blac'}</Text>
          <Text variant="body" color="textSecondary">
            {signup ? 'It takes a few seconds. Choose how you want to sign up.' : 'Choose how you want to sign in.'}
          </Text>
        </View>
      )}

      {/* Apple's own button, as their design rules ask. Only on iPhone, and only where Apple sign-in works. */}
      {appleReady ? (
        <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy === 'apple' ? 0.6 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={signup ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={27}
            style={{ height: 54, width: '100%' }}
            onPress={() => void apple()}
          />
        </View>
      ) : null}

      <OptionButton
        onBrand={onBrand}
        tone="light"
        label={signup ? 'Sign up with Google' : 'Continue with Google'}
        icon={<GoogleLogo size={20} />}
        busy={busy === 'google'}
        disabled={busy === 'apple'}
        onPress={() => void google()}
      />

      <OptionButton
        onBrand={onBrand}
        label={signup ? 'Sign up with email' : 'Continue with email'}
        icon={<Mail size={20} color={colors.text} />}
        disabled={busy !== null}
        onPress={() => {
          haptics.select();
          dismiss(onEmail);
        }}
      />

      {error ? (
        <Text variant="caption" color="danger" style={{ textAlign: 'center' }}>
          {error}
        </Text>
      ) : null}

      <Pressable onPress={onSwitchMode} disabled={busy !== null} accessibilityRole="button" style={{ alignItems: 'center', padding: 10 }}>
        <Text variant="body" color="textSecondary">
          {signup ? 'Already have an account? ' : 'New to Blac? '}
          <Text variant="bodyStrong" color="accent">
            {signup ? 'Sign in' : 'Create an account'}
          </Text>
        </Text>
      </Pressable>

      <Text variant="caption" color="textTertiary" style={{ textAlign: 'center', paddingHorizontal: 12 }}>
        By continuing you agree to Blac&apos;s{' '}
        <Text variant="caption" color="textSecondary" style={{ textDecorationLine: 'underline' }} onPress={() => openLegal('terms')} accessibilityRole="link">
          Terms
        </Text>{' '}
        and{' '}
        <Text variant="caption" color="textSecondary" style={{ textDecorationLine: 'underline' }} onPress={() => openLegal('privacy')} accessibilityRole="link">
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

/**
 * The bottom sheet for signing in or signing up with Apple, Google or an email address. Apple and Google finish the
 * sign-in right here; "email" closes the sheet and calls `onEmail` so the screen can open its email form.
 */
export function AuthSheet({
  visible,
  mode,
  onClose,
  onEmail,
  onSwitchMode,
}: {
  visible: boolean;
  mode: AuthMode;
  onClose: () => void;
  onEmail: (mode: AuthMode) => void;
  onSwitchMode: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {(dismiss) => <AuthOptions mode={mode} dismiss={dismiss} onEmail={() => onEmail(mode)} onSwitchMode={onSwitchMode} />}
    </BottomSheet>
  );
}
