import { Platform } from 'react-native';

/**
 * iOS 26 (Liquid Glass) adds a "bottom accessory" slot above the native tab bar — the Apple Music
 * style mini player. Everywhere else the mini player is docked inside the screen instead.
 */
export const hasBottomAccessory = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;

/**
 * Native tabs: on iOS the first scroll view adds the status-bar inset itself
 * (`contentInsetAdjustmentBehavior="automatic"`), so adding it again would double the gap.
 * On Android the inset has to be applied by hand.
 */
export const topInset = (safeAreaTop: number) => (Platform.OS === 'ios' ? 0 : safeAreaTop);
