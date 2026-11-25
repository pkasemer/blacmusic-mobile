import { Pressable, Switch, View } from 'react-native';
import { X } from 'lucide-react-native';
import { radius, useTheme } from '@/theme';
import { sizeOf } from '@/uploads/fileSize';
import type { PickedTrack } from '@/uploads/pickAudio';
import { FormField } from './FormField';
import { Text } from './Text';

/** One chosen audio file before upload: its title (editable), the file it came from, and the explicit switch. */
export function PickedTrackCard({
  track,
  number,
  onChange,
  onRemove,
}: {
  track: PickedTrack;
  /** The track number to show (albums), or nothing. */
  number?: number;
  onChange: (patch: Partial<Pick<PickedTrack, 'title' | 'explicit'>>) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        gap: 8,
        padding: 12,
        borderRadius: radius.card,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text variant="caption" color="textTertiary" style={{ width: 18 }}>
          {number ?? ''}
        </Text>
        <View style={{ flex: 1 }}>
          <FormField label="Track title" value={track.title} onChangeText={(title) => onChange({ title })} maxLength={200} />
        </View>
        <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${track.title}`}>
          <X size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
          {track.file.name} · {(sizeOf(track.file) / 1024 / 1024).toFixed(1)} MB
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="caption" color="textSecondary">
            Explicit
          </Text>
          <Switch value={track.explicit} onValueChange={(explicit) => onChange({ explicit })} trackColor={{ false: colors.borderStrong, true: colors.accent }} />
        </View>
      </View>
    </View>
  );
}
