import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Play, Shuffle } from 'lucide-react-native';
import { playQueue } from '@/audio/music/musicEngine';
import type { PlaybackSource } from '@/audio/music/source';
import type { Playable } from '@/domain/types';
import { radius, useTheme } from '@/theme';
import { Text } from './Text';

/** A round-cornered outlined button for the bar, such as Share or Download. */
export function BarButton({
  label,
  onPress,
  active,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({
        width: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.borderStrong,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/**
 * "Play" and "Shuffle" buttons for a list of songs or episodes, with room for more round buttons (`extra`)
 * after them. Renders nothing for an empty list.
 */
export function PlayAllBar({
  items,
  label = 'Play',
  extra,
  source,
}: {
  items: Playable[];
  label?: string;
  extra?: ReactNode;
  /** Where these songs come from, shown in the player as "Playing from…". */
  source?: PlaybackSource;
}) {
  const { colors } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 6 }}>
      <Pressable
        onPress={() => playQueue(items, 0, { shuffle: false, source })}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 13,
          borderRadius: radius.pill,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Play size={16} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
        <Text variant="bodyStrong" color="onPrimary">
          {label}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => playQueue(items, Math.floor(Math.random() * items.length), { shuffle: true, source })}
        accessibilityRole="button"
        accessibilityLabel="Shuffle"
        style={({ pressed }) => ({
          width: 52,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Shuffle size={18} color={colors.text} />
      </Pressable>
      {extra}
    </View>
  );
}
