import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { USES_BACKEND } from '@/api/blac';
import { ScreenState } from '@/components/ScreenState';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';

/**
 * Shown when the address matches no screen. The usual way to get here is signing out: the screen you were on
 * disappears, so signed-out people are sent to the Get started screen. Anyone else gets a way back home.
 */
export default function NotFoundScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const hasSession = useAuthStore((s) => s.refreshToken !== null);
  const signedIn = !USES_BACKEND || hasSession;

  if (!signedIn) return <Redirect href="/welcome" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenState
        kind="error"
        title="That page isn't here"
        message="It may have moved, or the link is out of date."
        actionLabel="Go to Home"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
