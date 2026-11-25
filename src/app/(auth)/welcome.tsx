import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthSheet, type AuthMode } from '@/components/AuthSheet';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { Text } from '@/components/Text';
import { radius } from '@/theme';
import { haptics } from '@/utils/haptics';

/** The first thing a signed-out person sees: the logo, the name, one line about the app, and two ways forward. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sheet, setSheet] = useState<AuthMode | null>(null);
  const [lastMode, setLastMode] = useState<AuthMode>('signin');
  const open = (mode: AuthMode) => {
    setLastMode(mode);
    setSheet(mode);
  };

  return (
    <>
      <BrandBackdrop>
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) + 8, paddingHorizontal: 28 }}>
          {/* The name and the promise, in the middle */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
            <Animated.View entering={FadeIn.duration(500)}>
              <Image source={require('../../../assets/splash-icon.png')} style={{ width: 96, height: 96 }} resizeMode="contain" />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(120).duration(500)} style={{ alignItems: 'center', gap: 12 }}>
              <Text variant="display" style={{ fontSize: 44, lineHeight: 50, textAlign: 'center' }}>
                Blac Music
              </Text>
              <Text variant="body" color="textSecondary" style={{ fontSize: 19, lineHeight: 26, textAlign: 'center', maxWidth: 300 }}>
                All your music and podcasts, in one place.
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.delay(260).duration(500)} style={{ gap: 6 }}>
            <Pressable
              onPress={() => {
                haptics.medium();
                router.push('/onboarding');
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                height: 56,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#BB88FF',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text variant="bodyStrong" style={{ color: '#121212', fontSize: 17 }}>
                Get started
              </Text>
            </Pressable>
            <Pressable onPress={() => open('signin')} accessibilityRole="button" accessibilityLabel="Sign in" style={{ alignItems: 'center', padding: 14 }}>
              <Text variant="body" color="textSecondary">
                Already have an account?{' '}
                <Text variant="bodyStrong" color="accent">
                  Sign in
                </Text>
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </BrandBackdrop>

      {/* Outside the backdrop, so the sheet follows the phone's light or dark theme, not the brand's black. */}
      <AuthSheet
        visible={sheet !== null}
        mode={sheet ?? lastMode}
        onClose={() => setSheet(null)}
        onEmail={(mode) => router.push({ pathname: '/sign-in', params: { mode } })}
        onSwitchMode={() => setSheet((m) => (m === 'signin' ? 'signup' : 'signin'))}
      />
    </>
  );
}
