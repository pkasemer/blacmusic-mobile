import { useEffect, type ReactNode } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { Stack, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useArtworkPaletteState } from '@/hooks/useArtworkTint';
import { useTheme } from '@/theme';
import { InkContext, type Ink } from '@/theme/ink';
import { TintBlobs } from './PlayerBackdrop';
import { Text } from './Text';

const FADE_HEIGHT = 90;
/**
 * Hero text follows the theme, never the picture: white in dark mode, black in light mode. A veil over the picture's
 * colours (darkening or lightening them) keeps it readable on any cover.
 */
const DARK_INK: Ink = { primary: '#FFFFFF', secondary: 'rgba(255,255,255,0.86)', tertiary: 'rgba(255,255,255,0.66)', accent: '#FFFFFF' };
const DARK_VEIL = 'rgba(0,0,0,0.45)';
const LIGHT_VEIL = 'rgba(255,255,255,0.55)';
/** Height of the navigation bar (back button row) under the status bar. Only used where the system does not add it. */
const NAV_BAR = 56;
/** The space between the back button and the top of the cover. */
const BELOW_BUTTON = 20;
/** How far the colour layer reaches above the page, behind the status bar and the back button. */
const REACH_UP = 400;

/**
 * Tracks how far a detail page is scrolled. Give `onScroll` to an `Animated.ScrollView` (with
 * `scrollEventThrottle={16}`) and `scrollY` to `DetailHero`, so the colour can stretch when the page is pulled down.
 */
export function useHeroScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  return { scrollY, onScroll };
}

/** How wide the cover or picture in a hero is: nearly the full width of the phone, up to a limit. */
export function useHeroCoverSize(max = 320) {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(width - 64, max) * 0.9);
}

/** Puts a soft shadow under the cover (or round artist picture) in a hero so it lifts off the colours behind it. */
export function HeroCover({ size, round, children }: { size: number; round?: boolean; children: ReactNode }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : 12,
        shadowColor: '#000',
        shadowOpacity: 0.38,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 14 },
      }}
    >
      {children}
    </View>
  );
}

/** The big title of a page, centred. */
export function HeroTitle({ children }: { children: ReactNode }) {
  return (
    <Text variant="display" numberOfLines={3} style={{ fontSize: 28, lineHeight: 34, textAlign: 'center', marginTop: 6 }}>
      {children}
    </Text>
  );
}

/** The small line under the title: what it is, the year, how long. */
export function HeroMeta({ children }: { children: ReactNode }) {
  return (
    <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', letterSpacing: 0.2 }}>
      {children}
    </Text>
  );
}

/**
 * The top of an artist, album or track page: the cover's colours drift behind the content, with film grain, and
 * fade into the page below. The colour starts at the very top of the screen, behind the status bar and the
 * (transparent) back button, and the content starts below them. Text inside picks black or white to stay readable.
 * Put it as the first child of a scroll view with `contentInsetAdjustmentBehavior="automatic"` (the system then starts the page below the back button).
 */
export function DetailHero({
  artwork,
  scrollY,
  children,
}: {
  /** What the colours come from: the cover or profile picture. */
  artwork: { id: string; logoUrl: string | null } | null;
  /** From `useHeroScroll`. When the page is pulled down past the top, the colour stretches to stay attached. */
  scrollY: SharedValue<number>;
  children: ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const { palette, ready } = useArtworkPaletteState(artwork);
  const tint = palette[0];
  const accents = palette.slice(1);
  // `null` keeps the theme's own text colours, which is right in light mode.
  const ink = isDark ? DARK_INK : null;
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  // The colour layer has a fixed size from the start (it does not wait to measure the page) and is only drawn once the
  // picture's colours are known, fading in once, so there is no stand-in colour that changes a moment later.
  const { width, height: screenHeight } = useWindowDimensions();
  const below = Math.min(Math.round(screenHeight * 0.72), 620);
  const height = below + REACH_UP;
  const shown = useSharedValue(ready ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(ready ? 1 : 0, { duration: 320 });
  }, [ready, shown]);

  // Pulling the page down moves everything below the top edge. Stretch the colour layer upward by the same amount
  // (scaled from its bottom edge) so it stays glued to the top of the screen instead of leaving a gap.
  const stretch = useAnimatedStyle(() => {
    const pull = Math.max(0, -scrollY.value);
    if (pull === 0) return { opacity: shown.value, transform: [{ translateY: 0 }, { scaleY: 1 }] };
    return { opacity: shown.value, transform: [{ translateY: -pull / 2 }, { scaleY: (height + pull) / height }] };
  });

  return (
    <View>
      {/* The header floats over the colour; its back button takes the readable ink colour. */}
      <Stack.Screen options={{ headerTransparent: true, headerTitle: '', headerShadowVisible: false, headerTintColor: colors.text }} />
      {ready ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -REACH_UP, left: 0, right: 0, height, overflow: 'hidden' }, stretch]}>
          <TintBlobs tint={tint} accents={accents} active={focused} width={width} height={height} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? DARK_VEIL : LIGHT_VEIL }} />
          {/* Fade the colour into the page so the content below sits on a clean background. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_HEIGHT }}>
            <Svg key={colors.bg} width="100%" height={FADE_HEIGHT}>
              <Defs>
                <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
                  <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height={FADE_HEIGHT} fill="url(#fade)" />
            </Svg>
          </View>
        </Animated.View>
      ) : null}
      <InkContext.Provider value={ink}>
        <View style={{ paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? BELOW_BUTTON : insets.top + NAV_BAR + BELOW_BUTTON, paddingBottom: 22, alignItems: 'center', gap: 8 }}>
          {children}
        </View>
      </InkContext.Provider>
    </View>
  );
}
