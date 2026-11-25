import type { ComponentProps, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { VerifiedBadge } from './VerifiedBadge';

type TextProps = ComponentProps<typeof Text>;

/**
 * An artist's name with the blue verified badge after it when the artist is verified. Use it wherever an artist name
 * is shown. `prefix` is text in front on the same line, such as "Single · ". The name shortens first when space runs
 * out, so the badge is never cut off.
 */
export function ArtistName({
  name,
  verified,
  prefix,
  variant = 'caption',
  color = 'textSecondary',
  numberOfLines = 1,
  badgeSize,
  style,
  textStyle,
  trailing,
}: {
  name: string;
  verified?: boolean;
  prefix?: string;
  variant?: TextProps['variant'];
  color?: TextProps['color'];
  numberOfLines?: number;
  /** Defaults to a size that suits the text variant. */
  badgeSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextProps['style'];
  /** Something after the badge on the same line. */
  trailing?: ReactNode;
}) {
  const size = badgeSize ?? (variant === 'caption' ? 13 : variant === 'title' || variant === 'display' ? 20 : 16);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }, style]}>
      {prefix ? (
        <Text variant={variant} color={color} style={textStyle}>
          {prefix}
        </Text>
      ) : null}
      <Text variant={variant} color={color} numberOfLines={numberOfLines} style={[{ flexShrink: 1 }, textStyle]}>
        {name}
      </Text>
      {verified ? <VerifiedBadge size={size} /> : null}
      {trailing}
    </View>
  );
}
