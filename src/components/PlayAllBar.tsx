import { Pressable, View } from 'react-native';
import { Play, Shuffle } from 'lucide-react-native';
import { playQueue } from '@/audio/music/musicEngine';
import type { PlaybackSource } from '@/audio/music/source';
import type { Playable } from '@/domain/types';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Wide "Play" and "Shuffle" buttons for a list in the Library. Renders nothing for an empty list. */
export function PlayAllBar({
  items,
  label = 'Play',
  source,
}: {
  items: Playable[];
  label?: string;
  /** Where these songs come from, shown in the player as "Playing from…". */
  source?: PlaybackSource;
}) {
  const { colors } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 6 }}>
      <Pressable
        onPress={() => playQueue(items, 0, { shuffle: false, source })}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flex: 1,
          height: 50,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 14,
          borderCurve: 'continuous',
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
          flex: 1,
          height: 50,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 14,
          borderCurve: 'continuous',
          backgroundColor: colors.surfaceAlt,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Shuffle size={17} color={colors.text} />
        <Text variant="bodyStrong">Shuffle</Text>
      </Pressable>
    </View>
  );
}
