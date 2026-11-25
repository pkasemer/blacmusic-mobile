import { useId } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/**
 * A tile with a soft grey gradient, a black (light mode) or white (dark mode) icon, a title and a count. The one
 * picked has a ring in the text colour; the others are a little dimmer. Used for Likes, Playlists and Downloads in
 * the Library.
 */
export function GradientCard({
  Icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { colors, isDark } = useTheme();
  // Black and white only: pale grey with dark ink in light mode, dark grey with light ink in dark mode.
  const [from, to] = isDark ? ['#3A3A3C', '#1C1C1E'] : ['#F2F2F7', '#D8D8DD'];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => ({
        flex: 1,
        height: 118,
        borderRadius: 16,
        borderCurve: 'continuous',
        overflow: 'hidden',
        padding: 12,
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: selected ? colors.text : 'transparent',
        opacity: pressed ? 0.85 : selected ? 1 : 0.72,
      })}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </View>
      <Icon size={26} color={colors.text} strokeWidth={1.9} />
      <View style={{ gap: 1 }}>
        <Text variant="headline" numberOfLines={1} style={{ fontSize: 16 }}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
