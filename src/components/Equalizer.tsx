import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Each bar has its own speed, so the three never move in step. */
const BARS = [
  { duration: 520, low: 0.3 },
  { duration: 380, low: 0.45 },
  { duration: 640, low: 0.25 },
];

function Bar({ active, color, max, duration, low }: { active: boolean; color: string; max: number; duration: number; low: number }) {
  const level = useSharedValue(low);

  useEffect(() => {
    if (active) {
      level.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      cancelAnimation(level);
      level.value = withTiming(low, { duration: 150 });
    }
    return () => cancelAnimation(level);
  }, [active, duration, low, level]);

  const style = useAnimatedStyle(() => ({ height: max * level.value }));
  return <Animated.View style={[{ width: 3, borderRadius: 2, backgroundColor: color }, style]} />;
}

/** Three small bars that bounce while something is playing: a flat "now playing" indicator. */
export function Equalizer({ active, color, size = 16 }: { active: boolean; color: string; size?: number }) {
  return (
    <View style={{ height: size, flexDirection: 'row', alignItems: 'flex-end', gap: 2.5 }}>
      {BARS.map((bar) => (
        <Bar key={bar.duration} active={active} color={color} max={size} duration={bar.duration} low={bar.low} />
      ))}
    </View>
  );
}
