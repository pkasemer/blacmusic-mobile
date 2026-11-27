import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * The colour of the iPhone status bar. An app built for iOS 27 can only set it through the screen on show
 * (`UIViewControllerBasedStatusBarAppearance` is on in app.json); the app-wide way that `<StatusBar>` uses does nothing
 * there. `<StatusBar>` stays for Android.
 *
 * A build made before that setting reports an error if a screen asks, so only newer ones do. expo-video came into the
 * app just before the setting, so a build that has it has both.
 */
const SCREENS_CHOOSE = Platform.OS === 'ios' && requireOptionalNativeModule('ExpoVideo') !== null;

/** Screen options that give the status bar white text (`light`) or black text. */
export function statusBarOptions(light: boolean): { statusBarStyle?: 'light' | 'dark'; statusBarAnimation?: 'fade' } {
  return SCREENS_CHOOSE ? { statusBarStyle: light ? 'light' : 'dark', statusBarAnimation: 'fade' } : {};
}
