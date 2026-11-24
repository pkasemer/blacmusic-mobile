import { Pressable, View } from 'react-native';
import { glassSurface, radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  /** Translucent look for use on top of the blurred player backdrop. */
  glass?: boolean;
  onPress?: () => void;
}

/** Genre / language pill. Static when `onPress` is omitted. */
export function Chip({ label, selected = false, glass = false, onPress }: Props) {
  const { colors, isDark } = useTheme();
  const surface = glass ? glassSurface(isDark) : null;
  const body = (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderWidth: 1,
        backgroundColor: selected ? colors.primary : (surface?.backgroundColor ?? colors.surface),
        borderColor: selected ? colors.primary : (surface?.borderColor ?? colors.border),
      }}
    >
      <Text variant="caption" color={selected ? 'onPrimary' : glass ? 'text' : 'textSecondary'}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {body}
    </Pressable>
  );
}
