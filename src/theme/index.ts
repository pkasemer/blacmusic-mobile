import { useSchemeStore } from './scheme';

export type Colors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Purple accent used as a FILL: buttons, selected chips, highlights. Pair with `onPrimary` text. */
  primary: string;
  /** Soft tint of the accent for backgrounds. */
  primarySoft: string;
  /** Text/icons on top of `primary`. */
  onPrimary: string;
  /** Accent for small text, icons and indicators sitting on the page itself (readable on bg). */
  accent: string;
  success: string;
  danger: string;
};

/** Linear blend of two #RRGGBB colours: `t` = 0 returns `from`, 1 returns `to`. */
function mix(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => {
    const v = Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t);
    return v.toString(16).padStart(2, '0');
  });
  return `#${out.join('')}`;
}

interface Base {
  /** Screen background. Everything neutral below is derived from it. */
  bg: string;
  /** Colour that reads on the background (text, icons). */
  ink: string;
  /** Purple accent fill for this scheme. */
  primary: string;
  /** Readable-on-background version of the accent, for text and icons. */
  accent: string;
  /** Text on top of the accent fill. */
  onPrimary: string;
  /** How strongly to blend the accent into the background for soft fills. */
  tintStrength: number;
  /** Scales how far surfaces and borders move away from the background (dark needs more). */
  contrast: number;
  success: string;
  danger: string;
}

/** Derives the whole palette from the background so light and dark always stay in step. */
function buildColors({ bg, ink, primary, accent, onPrimary, tintStrength, contrast, success, danger }: Base): Colors {
  return {
    bg,
    surface: bg,
    surfaceAlt: mix(bg, ink, 0.05 * contrast),
    border: mix(bg, ink, 0.1 * contrast),
    borderStrong: mix(bg, ink, 0.18 * contrast),
    text: ink,
    textSecondary: mix(bg, ink, 0.6),
    textTertiary: mix(bg, ink, 0.4),
    primary,
    primarySoft: mix(bg, primary, tintStrength),
    onPrimary,
    accent,
    success,
    danger,
  };
}

/** Light mode: white page, Blac purple fills, and a deeper purple for text and icons so they stay readable. */
export const lightColors: Colors = buildColors({
  bg: '#FFFFFF',
  ink: '#121212',
  primary: '#BB88FF',
  accent: '#7B3FE4',
  onPrimary: '#121212',
  tintStrength: 0.28,
  contrast: 1,
  success: '#1FA971',
  danger: '#D92D45',
});

/**
 * Dark mode in the Spotify style: near-black page (#121212), slightly lighter neutral-grey cards and
 * raised surfaces, white text and neutral greys for secondary text. The Blac purple is the only colour.
 */
const DARK = {
  /** Page. */
  bg: '#121212',
  /** Cards, rows and inputs. */
  card: '#181818',
  /** Raised surfaces: selected pills, chips, skeleton blocks. */
  raised: '#282828',
  /** Hairlines between and around things. */
  border: '#2A2A2A',
  borderStrong: '#3E3E3E',
  /** Text, from strongest to quietest. */
  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textTertiary: '#727272',
  /** Text on the purple accent fill. */
  onAccent: '#121212',
  accent: '#BB88FF',
} as const;

const darkBase = buildColors({
  bg: DARK.bg,
  ink: DARK.text,
  primary: DARK.accent,
  accent: DARK.accent,
  onPrimary: DARK.onAccent,
  tintStrength: 0.18,
  contrast: 1.5,
  success: '#3DD598',
  danger: '#F0716B',
});

export const darkColors: Colors = {
  ...darkBase,
  surface: DARK.card,
  surfaceAlt: DARK.raised,
  border: DARK.border,
  borderStrong: DARK.borderStrong,
  text: DARK.text,
  textSecondary: DARK.textSecondary,
  textTertiary: DARK.textTertiary,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { card: 8, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/**
 * Translucent fill + hairline for pills that sit on top of the blurred player backdrop, so the
 * artwork colours show through instead of a flat opaque block.
 */
export function glassSurface(isDark: boolean) {
  return isDark
    ? { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)' }
    : { backgroundColor: 'rgba(255,255,255,0.45)', borderColor: 'rgba(0,0,0,0.08)' };
}

export function useTheme() {
  const isDark = useSchemeStore((s) => s.scheme === 'dark');
  return { colors: isDark ? darkColors : lightColors, isDark };
}
