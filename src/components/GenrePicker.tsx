import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import { useGenres } from '@/api/blac/queries';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

/**
 * A field that shows the chosen genre and opens a searchable list of the standard genres. Choosing the
 * selected genre again, or "No genre", clears it. A genre saved earlier that is not in the list is kept
 * and shown at the top, so editing an old release never loses it.
 */
export function GenrePicker({
  label = 'Genre',
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (genre: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const genres = useGenres();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const names = useMemo(() => {
    const list = (genres.data ?? []).map((g) => g.name);
    // A saved genre that is not in the list (free text from before) stays available.
    const all = value && !list.some((n) => n.toLowerCase() === value.toLowerCase()) ? [value, ...list] : list;
    const q = query.trim().toLowerCase();
    return q ? all.filter((n) => n.toLowerCase().includes(q)) : all;
  }, [genres.data, value, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const choose = (name: string) => {
    haptics.select();
    onChange(name.toLowerCase() === value.toLowerCase() ? '' : name);
    close();
  };

  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" color="textTertiary">
        {label}
      </Text>
      <Pressable
        onPress={() => {
          haptics.select();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'none chosen'}. Change`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text variant="body" color={value ? 'text' : 'textTertiary'} style={{ fontSize: 16 }}>
          {value || 'Choose a genre'}
        </Text>
        <ChevronDown size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
            <Text variant="title">{label}</Text>
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginHorizontal: 20,
              marginTop: 16,
              marginBottom: 6,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Search size={16} color={colors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search genres"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={{ flex: 1, ...fontStyle('rounded', '400'), fontSize: 16, color: colors.text, paddingVertical: 12 }}
            />
          </View>

          <FlatList
            data={names}
            keyExtractor={(n) => n}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={
              value ? (
                <Pressable
                  onPress={() => {
                    haptics.select();
                    onChange('');
                    close();
                  }}
                  accessibilityRole="button"
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text variant="body" color="textSecondary">
                    No genre
                  </Text>
                </Pressable>
              ) : undefined
            }
            ListEmptyComponent={
              <Text variant="body" color="textSecondary" style={{ paddingVertical: 24, textAlign: 'center' }}>
                No genre matches “{query.trim()}”.
              </Text>
            }
            renderItem={({ item }) => {
              const selected = item.toLowerCase() === value.toLowerCase();
              return (
                <Pressable
                  onPress={() => choose(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text variant="body" color={selected ? 'accent' : 'text'}>
                    {item}
                  </Text>
                  {selected ? <Check size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
