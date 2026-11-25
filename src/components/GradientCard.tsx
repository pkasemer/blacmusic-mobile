import { useId, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/**
 * A tappable surface with a soft grey gradient: pale grey with dark ink in light mode, dark grey with light ink in
 * dark mode (black and white only). The one picked has a ring in the text colour; the others are a little dimmer.
 * Whatever is passed as `children` is drawn on top.
 */
export function GradientSurface({
  selected,
  onPress,
  label,
  style,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { colors, isDark } = useTheme();
  const [from, to] = isDark ? ['#3A3A3C', '#1C1C1E'] : ['#F2F2F7', '#D8D8DD'];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          borderRadius: 18,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: selected ? colors.text : 'transparent',
          opacity: pressed ? 0.85 : selected ? 1 : 0.72,
        },
        style,
      ]}
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
      {children}
    </Pressable>
  );
}

/** A small gradient tile with an icon, a title and a count. Used for Playlists and Downloads in the Library. */
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
  const { colors } = useTheme();
  return (
    <GradientSurface selected={selected} onPress={onPress} label={`${title}, ${subtitle}`} style={{ flex: 1, height: 104, padding: 14, justifyContent: 'space-between' }}>
      <Icon size={26} color={colors.text} strokeWidth={1.9} />
      <View style={{ gap: 1 }}>
        <Text variant="headline" numberOfLines={1} style={{ fontSize: 17 }}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </GradientSurface>
  );
}
