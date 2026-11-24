import { Pressable, View } from 'react-native';
import { Music, WifiOff } from 'lucide-react-native';
import { radius, useTheme } from '@/theme';
import { NativeIcon } from './NativeIcon';
import { Text } from './Text';

interface Props {
  kind: 'empty' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centered empty / error placeholder with an optional action. */
export function ScreenState({ kind, title, message, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 32 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primarySoft,
          marginBottom: 6,
        }}
      >
        <NativeIcon
          symbol={kind === 'error' ? 'wifi.slash' : 'music.note'}
          Fallback={kind === 'error' ? WifiOff : Music}
          size={26}
          color={colors.accent}
        />
      </View>
      <Text variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 10,
            paddingHorizontal: 22,
            paddingVertical: 11,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text variant="bodyStrong" color="onPrimary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
