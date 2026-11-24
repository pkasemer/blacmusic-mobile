import { View } from 'react-native';
import { useTheme } from '@/theme';

/** A thin bar showing `value` from 0 to 1. */
export function ProgressBar({ value, height = 6 }: { value: number; height?: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      <View style={{ width: `${clamped * 100}%`, height, borderRadius: height / 2, backgroundColor: colors.primary }} />
    </View>
  );
}
