import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { fontStyle } from '@/theme/fonts';

/** Must match `imageWidth` of the expo-splash-screen plugin in app.json, so the hand-off from the native splash is seamless. */
const LOGO_SIZE = 120;
const BG = '#000000';
const MUTED = '#9A9A9A';
/** Shortest time the animation stays up, so the wordmark is always seen, even when the app is ready instantly. */
const MIN_VISIBLE_MS = 1700;
const TEXT_DELAY_MS = 250;
const TEXT_IN_MS = 900;
const FADE_OUT_MS = 380;

/**
 * The native splash can't animate, so it shows the static logo on black and this overlay takes over
 * from the very same spot: the logo stays put while "Blac Music" eases in underneath (fading up and
 * settling its letter-spacing), then the whole thing fades away once the app is ready.
 *
 * `ready` = fonts and persisted stores are loaded. `onShown` is called once the overlay has been laid out
 * (time to hide the native splash). The component removes itself when it has faded out.
 */
export function AnimatedSplash({
  ready,
  fontsLoaded,
  onShown,
}: {
  ready: boolean;
  fontsLoaded: boolean;
  onShown: () => void;
}) {
  const [gone, setGone] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const textProgress = useSharedValue(0);
  const dotProgress = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Start the wordmark only once the font is loaded, so it never swaps fonts mid-animation.
  useEffect(() => {
    if (!fontsLoaded) return;
    textProgress.value = withDelay(
      TEXT_DELAY_MS,
      withTiming(1, { duration: TEXT_IN_MS, easing: Easing.out(Easing.cubic) }),
    );
    dotProgress.value = withDelay(
      TEXT_DELAY_MS + 500,
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
    );
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, textProgress, dotProgress]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    opacity.value = withTiming(0, { duration: FADE_OUT_MS, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(setGone)(true);
    });
  }, [ready, minElapsed, opacity]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const rowStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateY: (1 - textProgress.value) * 8 }],
  }));
  const spacingStyle = useAnimatedStyle(() => ({ letterSpacing: 7 - textProgress.value * 5 }));
  const musicStyle = useAnimatedStyle(() => ({ opacity: dotProgress.value }));

  if (gone) return null;

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto" onLayout={onShown}>
      <View style={styles.center}>
        <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
        <Animated.View style={[styles.row, rowStyle]}>
          <Animated.Text style={[styles.word, spacingStyle]}>Blac</Animated.Text>
          <Animated.Text style={[styles.word, styles.music, spacingStyle, musicStyle]}> Music</Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BG,
    zIndex: 1000,
    elevation: 1000,
  },
  // The logo sits exactly at screen centre (like the native splash); the wordmark hangs below it.
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  row: {
    position: 'absolute',
    top: '50%',
    marginTop: LOGO_SIZE / 2 + 26,
    flexDirection: 'row',
  },
  word: { ...fontStyle('display', '600'), fontSize: 22, color: '#FFFFFF' },
  music: { color: MUTED },
});
