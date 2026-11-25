import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

export interface Option<T extends string> {
  value: T;
  label: string;
  /** A small grey line under the label. */
  detail?: string;
}

/**
 * Pick one thing from a list that may be long (credit roles, songs of a release), in a bottom sheet that slides up.
 * The list scrolls inside the sheet and the chosen one has a tick.
 */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  current?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {(dismiss) => (
        <View style={{ gap: 6 }}>
          <Text variant="title" style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
            {title}
          </Text>
          <ScrollView style={{ maxHeight: height * 0.55 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {options.map((o, i) => {
              const selected = o.value === current;
              return (
                <Pressable
                  key={o.value || `option-${i}`}
                  onPress={() => {
                    haptics.select();
                    dismiss(() => onSelect(o.value));
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={o.label}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 52,
                    paddingVertical: 8,
                    paddingHorizontal: 20,
                    backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                  })}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="body" numberOfLines={1} style={{ fontWeight: selected ? '700' : '400' }}>
                      {o.label}
                    </Text>
                    {o.detail ? (
                      <Text variant="caption" color="textSecondary" numberOfLines={1}>
                        {o.detail}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <Check size={20} color={colors.accent} strokeWidth={2.6} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </BottomSheet>
  );
}
