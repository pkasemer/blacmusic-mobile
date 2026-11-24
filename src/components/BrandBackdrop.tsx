import { memo, useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BRAND_ACCENTS, BRAND_TINT, useBrandStore } from '@/store/brandStore';
import { InkContext, type Ink } from '@/theme/ink';
import { Grain, TintBlobs } from './PlayerBackdrop';

/** The brand moment is always dark, whatever the phone's theme: white text on black with drifting purple light. */
const BRAND_INK: Ink = {
  primary: '#FFFFFF',
  secondary: 'rgba(255,255,255,0.78)',
  tertiary: 'rgba(255,255,255,0.56)',
  accent: '#BB88FF',
};

/**
 * The black canvas with slowly drifting colour and film grain behind the welcome, tour, sign-in and email-code
 * screens. The root layout draws it once, from the first frame, for as long as nobody is signed in, and the screens
 * on top of it are transparent. That way moving between those screens never rebuilds the picture.
 */
export const BrandBackground = memo(function BrandBackground() {
  const tint = useBrandStore((s) => s.tint);
  const accents = useBrandStore((s) => s.accents);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]}>
      <TintBlobs tint={tint} accents={accents} active />
      <Grain />
    </View>
  );
});

/**
 * Wraps one of those screens: light text on the dark canvas, a light status bar, and (optionally) the colour this
 * screen wants the light to be. It draws no background of its own.
 */
export function BrandBackdrop({
  tint = BRAND_TINT,
  accents = BRAND_ACCENTS,
  children,
}: {
  tint?: string;
  accents?: string[];
  children: ReactNode;
}) {
  const setPalette = useBrandStore((s) => s.setPalette);
  const accentKey = accents.join(',');
  useEffect(() => {
    setPalette(tint, accentKey ? accentKey.split(',') : []);
  }, [tint, accentKey, setPalette]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <InkContext.Provider value={BRAND_INK}>{children}</InkContext.Provider>
    </View>
  );
}
