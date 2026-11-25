import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { InkContext, type Ink } from '@/theme/ink';

/** The first screens are always dark, whatever the phone's theme: white text on one flat black. */
export const BRAND_BACKGROUND = '#000000';

const BRAND_INK: Ink = {
  primary: '#FFFFFF',
  secondary: 'rgba(255,255,255,0.72)',
  tertiary: 'rgba(255,255,255,0.5)',
  accent: '#BB88FF',
};

/**
 * The flat black behind the welcome, tour, sign-in and email-code screens. The root layout draws it once for as long
 * as nobody is signed in, and the screens on top of it are transparent.
 */
export const BrandBackground = memo(function BrandBackground() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: BRAND_BACKGROUND }]} />;
});

/** Wraps one of those screens: light text on the dark background and a light status bar. It draws no background. */
export function BrandBackdrop({ children }: { tint?: string; accents?: string[]; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <InkContext.Provider value={BRAND_INK}>{children}</InkContext.Provider>
    </View>
  );
}
