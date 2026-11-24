import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useArtworkPalette } from '@/hooks/useArtworkTint';
import { useTheme } from '@/theme';
import { InkContext, useBackdropInk } from '@/theme/ink';
import { Grain, TintBlobs } from './PlayerBackdrop';

const FADE_HEIGHT = 90;
/** Height of the navigation bar (back button row) under the status bar. */
const NAV_BAR = Platform.OS === 'ios' ? 44 : 56;

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

/**
 * The top of an artist, album or track page: the cover's colours drift behind the content, with film grain, and
 * fade into the page below. The colour starts at the very top of the screen, behind the status bar and the
 * (transparent) back button, and the content starts below them. Text inside picks black or white to stay readable.
 * Put it as the first child of a scroll view with `contentInsetAdjustmentBehavior="never"`.
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
  const { colors } = useTheme();
  const palette = useArtworkPalette(artwork);
  const tint = palette[0];
  const accents = palette.slice(1);
  const ink = useBackdropInk(tint);
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Pulling the page down moves everything below the top edge. Stretch the colour layer upward by the same amount
  // (scaled from its bottom edge) so it stays glued to the top of the screen instead of leaving a gap.
  const height = size.height;
  const stretch = useAnimatedStyle(() => {
    const pull = Math.max(0, -scrollY.value);
    if (pull === 0 || height === 0) return { transform: [{ translateY: 0 }, { scaleY: 1 }] };
    return { transform: [{ translateY: -pull / 2 }, { scaleY: (height + pull) / height }] };
  });

  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
      }}
    >
      {/* The header floats over the colour; its back button takes the readable ink colour. */}
      <Stack.Screen options={{ headerTransparent: true, headerTitle: '', headerShadowVisible: false, headerTintColor: ink.primary }} />
      {size.width > 0 ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, stretch]}>
          <TintBlobs tint={tint} accents={accents} active={focused} width={size.width} height={size.height} />
          <Grain width={size.width} height={size.height} />
          {/* Fade the colour into the page so the content below sits on a clean background. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_HEIGHT }}>
            <Svg width="100%" height={FADE_HEIGHT}>
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
        <View style={{ paddingHorizontal: 20, paddingTop: insets.top + NAV_BAR + 12, paddingBottom: 28, alignItems: 'center', gap: 12 }}>
          {children}
        </View>
      </InkContext.Provider>
    </View>
  );
}
