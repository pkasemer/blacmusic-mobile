import { useEffect, type ReactNode } from 'react';
import { Image, ScrollView, useWindowDimensions, View } from 'react-native';
import { AudioLines, Music2 } from 'lucide-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/Text';
import { useOnboardingConfig } from '@/onboarding/useConfig';
import { useOnboardingStore } from '@/store/onboardingStore';
import { radius } from '@/theme';
import { haptics } from '@/utils/haptics';
import { ON_BRAND, PrimaryAction } from './parts';

const RIPPLE_MS = 3200;
const RIPPLES = [0, 1, 2];
const ORBIT_MS = 48_000;
const ORBITERS = 6;
const SATELLITE = 52;
/** How tall each bar of the wave can grow (tallest in the middle) and how fast it moves. */
const BARS = Array.from({ length: 27 }, (_, i) => ({
  peak: 0.3 + 0.7 * Math.sin((Math.PI * (i + 1)) / 28) * (i % 3 === 1 ? 0.72 : 1),
  duration: 420 + ((i * 137) % 380),
}));

/** A ring that grows out from the middle and fades, again and again. */
function Ripple({ size, order, still }: { size: number; order: number; still: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!still) t.value = withDelay((order * RIPPLE_MS) / RIPPLES.length, withRepeat(withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [still, order, t]);

  const style = useAnimatedStyle(() => ({
    opacity: still ? 0.12 : t.value === 0 ? 0 : 0.55 * (1 - t.value),
    transform: [{ scale: still ? 0.55 + order * 0.2 : 0.38 + 0.62 * t.value }],
  }));

  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: ON_BRAND.accent }, style]} />;
}

/** One place on the circle. It turns back as the circle turns, so what it holds stays upright. */
function Satellite({ index, count, radius: distance, turn, children }: { index: number; count: number; radius: number; turn: SharedValue<number>; children: ReactNode }) {
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-turn.value}deg` }] }));
  const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
  return (
    <View style={{ position: 'absolute', transform: [{ translateX: Math.cos(angle) * distance }, { translateY: Math.sin(angle) * distance }] }}>
      <Animated.View style={upright}>
        <Animated.View entering={ZoomIn.delay(350 + index * 110).springify().damping(13)}>{children}</Animated.View>
      </Animated.View>
    </View>
  );
}

/** The picked artists circling the Blac mark, with rings of sound spreading out from it. */
function Stage({ size, still }: { size: number; still: boolean }) {
  const artists = useOnboardingStore((s) => s.artists).slice(0, ORBITERS);
  const turn = useSharedValue(0);
  const breath = useSharedValue(0);
  const count = artists.length > 0 ? artists.length : ORBITERS;
  const distance = (size - SATELLITE) / 2;
  const core = size * 0.38;

  useEffect(() => {
    if (!still) {
      turn.value = withRepeat(withTiming(360, { duration: ORBIT_MS, easing: Easing.linear }), -1, false);
      breath.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
    return () => {
      cancelAnimation(turn);
      cancelAnimation(breath);
    };
  }, [still, turn, breath]);

  const turning = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const breathing = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.05 * breath.value }] }));
  const glowing = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * breath.value, transform: [{ scale: 1 + 0.12 * breath.value }] }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {RIPPLES.map((order) => (
        <Ripple key={order} size={size} order={order} still={still} />
      ))}
      <View style={{ position: 'absolute', width: distance * 2, height: distance * 2, borderRadius: distance, borderWidth: 1, borderColor: ON_BRAND.line, borderStyle: 'dashed' }} />

      <Animated.View entering={ZoomIn.delay(80).springify().damping(11)}>
        <Animated.View style={[{ position: 'absolute', width: core, height: core, borderRadius: core / 2, backgroundColor: ON_BRAND.chosen, boxShadow: `0 0 ${Math.round(core * 0.55)}px rgba(187,136,255,0.55)` }, glowing]} />
        <Animated.View style={[{ width: core, height: core, borderRadius: core / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#160F22', borderWidth: 1.5, borderColor: ON_BRAND.accent }, breathing]}>
          <Image source={require('../../../assets/splash-icon.png')} style={{ width: core * 0.64, height: core * 0.64 }} resizeMode="contain" />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }, turning]}>
        {Array.from({ length: count }, (_, i) => (
          <Satellite key={artists[i]?.id ?? i} index={i} count={count} radius={distance} turn={turn}>
            <View style={{ borderRadius: SATELLITE / 2, backgroundColor: '#000000', borderWidth: 2, borderColor: i % 2 === 0 ? ON_BRAND.accent : ON_BRAND.line, padding: 2 }}>
              {artists[i] ? (
                <Avatar url={artists[i].avatarUrl} name={artists[i].name} size={SATELLITE - 8} />
              ) : (
                <View style={{ width: SATELLITE - 8, height: SATELLITE - 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Music2 size={20} color={ON_BRAND.accent} />
                </View>
              )}
            </View>
          </Satellite>
        ))}
      </Animated.View>
    </View>
  );
}

function WaveBar({ peak, duration, still, quick }: { peak: number; duration: number; still: boolean; quick: boolean }) {
  const level = useSharedValue(0.18);

  useEffect(() => {
    if (still) {
      level.value = peak * 0.6;
      return;
    }
    // Quicker while the playlist is being put together.
    level.value = withRepeat(withTiming(peak, { duration: quick ? duration * 0.55 : duration, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(level);
  }, [peak, duration, still, quick, level]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: level.value }] }));
  return <Animated.View style={[{ width: 4, height: 40, borderRadius: 2, backgroundColor: ON_BRAND.accent }, style]} />;
}

/** The end of onboarding: "We've got your sound.", brought to life with the listener's own picks. */
export function Finale({ busy, onStart, onBack }: { busy: boolean; onStart: () => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const still = useReducedMotion();
  const config = useOnboardingConfig();
  const genres = useOnboardingStore((s) => s.genres);
  const artistCount = useOnboardingStore((s) => s.artists.length);
  const languageCount = useOnboardingStore((s) => new Set([...s.preferred, ...s.understood]).size);
  const size = Math.round(Math.max(210, Math.min(width - 56, height * 0.38, 340)));

  const named = genres.flatMap((id) => config.genres.find((g) => g.id === id)?.label ?? []);
  const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
  const picks = [
    ...named.slice(0, 3),
    ...(named.length > 3 ? [`+${named.length - 3} more`] : []),
    ...(artistCount > 0 ? [count(artistCount, 'artist')] : []),
    ...(languageCount > 0 ? [count(languageCount, 'language')] : []),
  ];

  useEffect(() => haptics.success(), []);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) + 8 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 28, paddingVertical: 16 }} showsVerticalScrollIndicator={false} bounces={false}>
        <Stage size={size} still={still} />

        <Animated.View entering={FadeIn.delay(500).duration(500)} style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityElementsHidden>
          {BARS.map((bar, i) => (
            <WaveBar key={i} peak={bar.peak} duration={bar.duration} still={still} quick={busy} />
          ))}
        </Animated.View>

        <View style={{ alignItems: 'center', gap: 10 }}>
          <Animated.View entering={FadeInDown.delay(650).duration(520)}>
            <Text variant="display" accessibilityRole="header" style={{ textAlign: 'center', fontSize: 36, lineHeight: 42 }}>
              {"We've got\nyour sound."}
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(820).duration(520)}>
            <Text variant="body" color="textSecondary" style={{ textAlign: 'center', fontSize: 16, lineHeight: 23, maxWidth: 330 }}>
              Your music journey starts here. Discover familiar favourites, new artists and the sounds of Uganda.
            </Text>
          </Animated.View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 400 }}>
          {picks.map((label, i) => (
            <Animated.View
              key={label}
              entering={ZoomIn.delay(1050 + i * 90).duration(280)}
              style={{ height: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: ON_BRAND.card, borderWidth: 1, borderColor: ON_BRAND.line }}
            >
              <Text variant="caption" style={{ color: ON_BRAND.text }}>
                {label}
              </Text>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <Animated.View entering={FadeInUp.delay(1200).duration(450)} style={{ gap: 6, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 8 }}>
        <View style={{ height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }} accessibilityLiveRegion="polite">
          <AudioLines size={14} color={ON_BRAND.accent} />
          <Text variant="caption" color="textSecondary">
            {busy ? 'Putting your playlist together…' : 'Next: Your sound, a playlist made for you'}
          </Text>
        </View>
        <PrimaryAction label="Start Listening" busy={busy} onPress={onStart} />
        <Text onPress={busy ? undefined : onBack} accessibilityRole="button" variant="body" color="textSecondary" style={{ textAlign: 'center', padding: 12, opacity: busy ? 0.4 : 1 }}>
          Back
        </Text>
      </Animated.View>
    </View>
  );
}
