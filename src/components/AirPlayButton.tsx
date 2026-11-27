import type { ComponentType } from 'react';
import { Platform, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { VideoAirPlayButtonProps } from 'expo-video';

/**
 * Apple's own AirPlay button (`AVRoutePickerView`, from expo-video): tapping it shows the iPhone's list of speakers and
 * TVs. A build made before expo-video was added does not have it, and asking for the package there would crash, so it
 * is only loaded when the app has it.
 */
const NativeButton: ComponentType<VideoAirPlayButtonProps> | null =
  Platform.OS === 'ios' && requireOptionalNativeModule('ExpoVideo')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the build has it
      (require('expo-video') as typeof import('expo-video')).VideoAirPlayButton
    : null;

export function AirPlayButton({ tint, activeTint }: { tint: string; activeTint: string }) {
  if (!NativeButton) return null;
  return (
    // The same room as the other buttons on the player's bottom bar.
    <View style={{ width: 52, height: 44, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      {/* Speakers and TVs alike: this is music, so screens are not listed first. */}
      <NativeButton tint={tint} activeTint={activeTint} prioritizeVideoDevices={false} style={{ width: 44, height: 44 }} />
    </View>
  );
}
