import { ActivityIndicator, Pressable, View } from 'react-native';
import { Pause, Play } from 'lucide-react-native';
import { useTheme } from '@/theme';

/** What the button shows: a spinner while `loading` or `buffering`, a pause icon while `playing`, otherwise play. */
export type PlaybackPhase = 'loading' | 'buffering' | 'playing' | 'paused';

interface Props {
  phase: PlaybackPhase;
  size?: number;
  onPress: () => void;
  disabled?: boolean;
  /** `solid` = purple disc, `soft` = tinted disc, `plain` = bare icon. */
  tone?: 'solid' | 'soft' | 'plain';
}

export function PlayButton({ phase, size = 44, onPress, disabled, tone = 'solid' }: Props) {
  const { colors } = useTheme();
  const bg = tone === 'solid' ? colors.primary : tone === 'soft' ? colors.primarySoft : 'transparent';
  const fg = tone === 'solid' ? colors.onPrimary : colors.accent;
  const iconSize = Math.round(size * 0.42);
  const busy = phase === 'loading' || phase === 'buffering';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={phase === 'playing' || busy ? 'Pause' : 'Play'}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <ActivityIndicator color={fg} size="small" />
        ) : phase === 'playing' ? (
          <Pause size={iconSize} color={fg} fill={fg} strokeWidth={0} />
        ) : (
          <Play size={iconSize} color={fg} fill={fg} strokeWidth={0} style={{ marginLeft: iconSize * 0.1 }} />
        )}
      </View>
    </Pressable>
  );
}
