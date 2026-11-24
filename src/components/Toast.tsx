import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/store/toastStore';
import { radius, useTheme } from '@/theme';
import { Text } from './Text';

const SHOW_MS = 2400;
/** Clear of the tab bar and the mini player. */
const ABOVE_BARS = 150;

/** Renders the current toast above everything else. Mount once in the root layout. */
export function Toast() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const message = useToastStore((s) => s.message);
  const id = useToastStore((s) => s.id);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, SHOW_MS);
    return () => clearTimeout(timer);
  }, [message, id, hide]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + ABOVE_BARS, alignItems: 'center', zIndex: 2000 }}>
      {message ? (
        <Animated.View
          key={id}
          entering={FadeInDown.duration(180)}
          exiting={FadeOutDown.duration(160)}
          style={{
            maxWidth: '86%',
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.borderStrong,
          }}
        >
          <Text variant="bodyStrong" numberOfLines={2} style={{ textAlign: 'center' }}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
