import type { TextStyle } from 'react-native';

/**
 * Typography roles, loaded from the `.otf` files in `assets/fonts`:
 * - `display`: SF Pro Display — large titles.
 * - `rounded`: SF Pro Rounded — everything else.
 *
 * A missing file just falls back to the platform system font (SF Pro on iOS), so removing a
 * file never breaks the bundle.
 */
export type FontRole = 'display' | 'rounded';
export type FontWeight = '400' | '500' | '600' | '700';

const FAMILY: Record<FontRole, string> = { display: 'SFProDisplay', rounded: 'SFProRounded' };
const WEIGHT_NAME: Record<FontWeight, string> = {
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semibold',
  '700': 'Bold',
};

// An empty match is fine, so a missing font never fails the build.
const context = require.context(
  '../../assets/fonts',
  false,
  /SF-Pro-(Rounded|Display)-(Regular|Medium|Semibold|Bold)\.(otf|ttf)$/,
);

/** `{ 'SFProRounded-Bold': <asset>, … }` for every font file found; feed this to `useFonts`. */
export const fontSources: Record<string, number> = {};
context.keys().forEach((key) => {
  const match = key.match(/SF-Pro-(Rounded|Display)-(\w+)\.(?:otf|ttf)$/);
  if (match) fontSources[`SFPro${match[1]}-${match[2]}`] = context(key);
});

/** Style for a role + weight. Falls back to the system font at that weight. */
export function fontStyle(role: FontRole, weight: FontWeight): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  const family = `${FAMILY[role]}-${WEIGHT_NAME[weight]}`;
  if (fontSources[family]) return { fontFamily: family };
  return { fontWeight: weight };
}
