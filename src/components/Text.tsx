import { useContext } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { fontStyle } from '@/theme/fonts';
import { useTheme, type Colors } from '@/theme';
import { InkContext } from '@/theme/ink';

/** Big titles use SF Pro Display; everything else uses SF Pro Rounded. */
const variants = {
  display: { ...fontStyle('display', '700'), fontSize: 32, lineHeight: 40, letterSpacing: 0.3 },
  title: { ...fontStyle('display', '600'), fontSize: 22, lineHeight: 29, letterSpacing: 0.2 },
  headline: { ...fontStyle('rounded', '600'), fontSize: 16, lineHeight: 22 },
  body: { ...fontStyle('rounded', '400'), fontSize: 15, lineHeight: 22 },
  bodyStrong: { ...fontStyle('rounded', '500'), fontSize: 15, lineHeight: 22 },
  caption: { ...fontStyle('rounded', '500'), fontSize: 12.5, lineHeight: 17 },
  label: {
    ...fontStyle('rounded', '700'),
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof variants;

interface Props extends RNTextProps {
  variant?: TextVariant;
  color?: keyof Colors;
}

export function Text({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const { colors } = useTheme();
  const ink = useContext(InkContext);
  // On a coloured backdrop, swap the theme greys for ink that has enough contrast there.
  const resolved =
    ink && color === 'text'
      ? ink.primary
      : ink && color === 'textSecondary'
        ? ink.secondary
        : ink && color === 'textTertiary'
          ? ink.tertiary
          : ink && color === 'accent'
            ? ink.accent
            : colors[color];
  return <RNText {...rest} style={[variants[variant], { color: resolved }, style]} />;
}
