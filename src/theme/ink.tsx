import { createContext, useContext } from 'react';
import { useTheme } from '@/theme';

/** Text colours to use on top of a coloured, blurred backdrop. */
export interface Ink {
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
}

/**
 * When set, `Text` swaps its theme text colours (text, textSecondary, textTertiary, accent) for
 * these. Wrap only the content that sits on the backdrop, never anything with its own background.
 */
export const InkContext = createContext<Ink | null>(null);

/** The text colours to use right now: the backdrop's ink when inside one, else the theme's own. */
export function useInk(): Ink {
  const ink = useContext(InkContext);
  const { colors } = useTheme();
  return ink ?? { primary: colors.text, secondary: colors.textSecondary, tertiary: colors.textTertiary, accent: colors.accent };
}
