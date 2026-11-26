import { AppState, Appearance } from 'react-native';
import { create } from 'zustand';
import type { ThemeMode } from '@/store/settingsStore';

/**
 * Whether the app is drawn light or dark, with every screen told the moment it changes.
 *
 * React Native alone is not enough: when the app itself sets the scheme, `Appearance` saves the new value without
 * telling anyone and waits for a notice from the phone. Until that arrives (if it does), only screens that happen to
 * redraw for some other reason pick up the new colours, leaving the rest in the old ones. So the app keeps its own
 * copy here, which `useTheme` reads.
 */

export type Scheme = 'light' | 'dark';

const asScheme = (value: string | null | undefined): Scheme => (value === 'dark' ? 'dark' : 'light');
const current = () => asScheme(Appearance.getColorScheme());

export const useSchemeStore = create<{ scheme: Scheme }>()(() => ({ scheme: current() }));

function show(scheme: Scheme) {
  if (useSchemeStore.getState().scheme !== scheme) useSchemeStore.setState({ scheme });
}

let chosen: ThemeMode = 'system';

/** Reads the phone's own setting again. Only meaningful while the app follows the phone. */
function followPhone() {
  if (chosen !== 'system') return;
  // Setting "auto" again also makes React Native read the phone's value afresh instead of the one it saved.
  Appearance.setColorScheme('auto');
  show(current());
}

/** When the phone has had time to drop the app's own choice and report its setting. */
const SETTLE_MS = [50, 300, 1000];

/** Applies the choice made in Settings: always light, always dark, or whatever the phone is set to. */
export function applyScheme(mode: ThemeMode) {
  chosen = mode;
  if (mode !== 'system') {
    Appearance.setColorScheme(mode);
    show(mode);
    return;
  }
  followPhone();
  // The phone's setting is only known once it has let go of the app's choice, a moment later.
  SETTLE_MS.forEach((ms) => setTimeout(followPhone, ms));
}

// The phone changing its own setting (at sunset, or from Control Centre) arrives here.
Appearance.addChangeListener(({ colorScheme }) => {
  if (chosen === 'system') show(asScheme(colorScheme));
});
// A change made while the app was in the background may not have been announced.
AppState.addEventListener('change', (state) => {
  if (state === 'active') followPhone();
});
