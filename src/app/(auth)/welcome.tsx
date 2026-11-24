import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Artwork } from '@/components/Artwork';
import { AuthSheet, type AuthMode } from '@/components/AuthSheet';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { Text } from '@/components/Text';
import { useShowcase } from '@/store/showcaseStore';
import { radius } from '@/theme';
import { haptics } from '@/utils/haptics';

/** One cover that drifts gently up and down, so the picture never sits still. */
function FloatingCover({ id, imageUrl, size, rotate, x, y, delay, period }: { id: string; imageUrl?: string | null; size: number; rotate: number; x: number; y: number; delay: number; period: number }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [lift, delay, period]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x }, { translateY: y + (lift.value - 0.5) * 16 }, { rotate: `${rotate}deg` }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: 14,
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
        },
        style,
      ]}
    >
      <Artwork id={id} logoUrl={imageUrl ?? null} size={size} />
    </Animated.View>
  );
}

/** The first thing a signed-out person sees: the brand, a promise, a Get started button and a Sign in link. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showcase = useShowcase();
  const picks = showcase.slice(0, 3);
  const [sheet, setSheet] = useState<AuthMode | null>(null);
  const [lastMode, setLastMode] = useState<AuthMode>('signin');
  const open = (mode: AuthMode) => {
    setLastMode(mode);
    setSheet(mode);
  };

  return (
    <>
    <BrandBackdrop tint="#BB88FF" accents={['#6C8BFF', '#FF7AB8']}>
      <View style={{ flex: 1, paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 20) + 8, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={require('../../../assets/splash-icon.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
          <Text variant="title" style={{ fontSize: 22 }}>
            Blac Music
          </Text>
        </View>

        {/* A fan of covers floating in the middle */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center' }}>
            <FloatingCover id="welcome-a" imageUrl={picks[1]?.imageUrl} size={150} rotate={-14} x={-62} y={18} delay={0} period={3800} />
            <FloatingCover id="welcome-c" imageUrl={picks[2]?.imageUrl} size={150} rotate={12} x={64} y={-8} delay={600} period={4400} />
            <FloatingCover id="welcome-b" imageUrl={picks[0]?.imageUrl} size={170} rotate={-2} x={0} y={-28} delay={300} period={4100} />
          </View>
          {picks.length > 0 ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 18, textAlign: 'center' }}>
              Featuring {picks.map((p) => p.name).join(', ')} and more
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
            All your music and podcasts, in one place.
          </Text>
          <Text variant="body" color="textSecondary">
            Stream what you love, find what&apos;s next, and share your own sound.
          </Text>
        </View>

        <View style={{ gap: 6, paddingTop: 26 }}>
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
        </View>
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
