import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, useTheme } from '@/theme';

const CLOSE_MS = 200;

/**
 * A panel that slides up from the bottom over a dimmed screen. `children` is a function that receives `dismiss`:
 * call it to slide the sheet away (then `onClose` runs, and an optional `after` for things that open another
 * screen or sheet). Tapping the dimmed area or pressing back dismisses it too. Nothing is rendered while closed,
 * so a form inside starts fresh every time.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: (dismiss: (after?: () => void) => void) => ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [closing, setClosing] = useState(false);

  const dismiss = (after?: () => void) => {
    if (closing) return; // already sliding away
    setClosing(true);
    setTimeout(() => {
      onClose();
      setClosing(false);
      after?.();
    }, CLOSE_MS);
  };

  if (!visible) return <Modal visible={false} transparent />;

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => dismiss()} statusBarTranslucent>
      {!closing ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View
            entering={FadeIn.duration(CLOSE_MS)}
            exiting={FadeOut.duration(CLOSE_MS)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => dismiss()} accessibilityLabel="Close" accessibilityRole="button" />
          </Animated.View>

          <Animated.View
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(CLOSE_MS)}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: colors.border,
              paddingTop: 10,
              paddingBottom: insets.bottom + 12,
              maxHeight: '86%',
            }}
          >
            <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 14 }} />
            {children(dismiss)}
          </Animated.View>
        </KeyboardAvoidingView>
      ) : null}
    </Modal>
  );
}
