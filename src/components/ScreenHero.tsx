import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** How far the colour wash reaches below the top of the hero, and above it (behind the status bar). */
const WASH_BELOW = 360;
const WASH_ABOVE = 400;

/**
 * A soft wash of the brand purple that fades into the page. Put it as the first child of a hero block; it reaches
 * up behind the status bar and ignores touches.
 */
export function HeroWash() {
  const { colors } = useTheme();
  const height = WASH_ABOVE + WASH_BELOW;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -WASH_ABOVE, height }}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="heroWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.34} />
            <Stop offset="0.55" stopColor={colors.primary} stopOpacity={0.16} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} fill="url(#heroWash)" />
      </Svg>
    </View>
  );
}

/**
 * The top of a main screen (Library, Studio, Settings): the purple wash, then a row with an optional picture on the
 * left, a small label over a large title, and optional controls on the right. `subtitle` goes under the title and
 * `children` under that.
 */
export function ScreenHero({
  label,
  title,
  subtitle,
  leading,
  trailing,
  children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={{ gap: 18, paddingBottom: 6 }}>
      <HeroWash />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 }}>
        {leading}
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="label" color="accent">
            {label}
          </Text>
          <Text variant="display" numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing}
      </View>
      {children}
    </View>
  );
}
