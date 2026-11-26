import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthSheet, type AuthMode } from '@/components/AuthSheet';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { Text } from '@/components/Text';
import { useOnboardingStore } from '@/store/onboardingStore';
import { radius } from '@/theme';
import { haptics } from '@/utils/haptics';

/** Onboarding step 1, the first thing a signed-out person sees: the brand, what it is about, and two ways forward. */
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
              <Text variant="label" color="textSecondary">
                Blac Music
              </Text>
              <Text variant="display" accessibilityRole="header" style={{ fontSize: 36, lineHeight: 43, textAlign: 'center' }}>
                Your music. Your culture. Your Uganda.
              </Text>
              <Text variant="body" color="textSecondary" style={{ fontSize: 18, lineHeight: 25, textAlign: 'center', maxWidth: 320 }}>
                Discover the sounds, artists and stories that bring Uganda together.
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.delay(260).duration(500)} style={{ gap: 6 }}>
            <Pressable
              onPress={() => {
                haptics.medium();
                useOnboardingStore.getState().begin();
                router.push('/get-started');
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
                Get Started
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                // Someone with an account goes straight to signing in, without onboarding.
                useOnboardingStore.getState().abandon();
                open('signin');
              }}
              accessibilityRole="button"
              style={{ alignItems: 'center', padding: 14 }}
            >
              <Text variant="bodyStrong" color="accent">
                I Already Have an Account
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
