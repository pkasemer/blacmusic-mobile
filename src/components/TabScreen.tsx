import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { hasBottomAccessory } from '@/utils/platform';
import { MiniPlayer } from './MiniPlayer';

/** Height of the classic (pre-iOS 26) UITabBar, excluding the home-indicator inset. */
const CLASSIC_IOS_TAB_BAR = 49;

/**
 * Wraps every tab screen.
 *
 * On iOS 26 the mini player lives in the native tab bar accessory, so this renders NOTHING extra:
 * the native header (large title, scroll-edge blur, search bar) only follows a scroll view that is
 * a direct child of the screen, and a wrapper View would break that.
 *
 * On older iOS and Android the mini player docks at the bottom of the screen, just above the
 * native tab bar, and the content resizes above it.
 */
export function TabScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (hasBottomAccessory) return <>{children}</>;

  // Pre-iOS 26 the screen extends under the translucent tab bar, so lift the mini player over it.
  const lift = Platform.OS === 'ios' ? CLASSIC_IOS_TAB_BAR + insets.bottom : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>{children}</View>
      <View style={{ marginBottom: lift }}>
        <MiniPlayer />
      </View>
    </View>
  );
}
