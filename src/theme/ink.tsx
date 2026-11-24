import { createContext, useMemo } from 'react';
import { useTheme } from '@/theme';
import { luminance, mixHex } from '@/utils/color';

/** Text colours chosen to read on top of a coloured, blurred backdrop. */
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

const ON_LIGHT: Ink = {
  primary: '#141413',
  secondary: 'rgba(20,20,19,0.76)',
  tertiary: 'rgba(20,20,19,0.58)',
  accent: '#141413',
};

/**
 * Picks dark or light text for a backdrop tinted with \`tint\`. It estimates the colour you actually
 * see behind the text (the tint blended over the page) and chooses whichever of black or white has
 * the better contrast, so yellow and light backdrops get dark text and red or blue ones get white.
 */
export function useBackdropInk(tint: string): Ink {
  const { colors, isDark } = useTheme();
  return useMemo(() => {
    const seen = mixHex(colors.bg, tint, isDark ? 0.62 : 0.38);
    const L = luminance(seen);
    // White wins on contrast when the colour is darker than about L = 0.18, black when it is lighter.
    if (L > 0.18) return ON_LIGHT;
    return {
      primary: '#FFFFFF',
      secondary: 'rgba(255,255,255,0.82)',
      tertiary: 'rgba(255,255,255,0.62)',
      accent: colors.accent,
    };
  }, [tint, colors.bg, colors.accent, isDark]);
}
