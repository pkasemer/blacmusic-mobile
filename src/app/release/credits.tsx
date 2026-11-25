import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Plus } from 'lucide-react-native';
import { ApiError } from '@/api/blac';
import { fetchReleaseCredits, saveReleaseCredits } from '@/api/blac/credits';
import { useRelease } from '@/api/blac/queries';
import { PrimaryButton } from '@/components/FormField';
import { Text } from '@/components/Text';
import { chooseOne } from '@/components/SettingsList';
import { CREDIT_ROLES, roleName, type Credit, type CreditRole } from '@/domain/credits';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';

interface Draft extends Credit {
  key: string;
}

const newKey = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * Add the people who worked on a release or on one of its songs: a name, what they did, and whether it is for the
 * whole release or a single song. Saving replaces the list. Credits show on the release and song pages.
 */
export default function CreditsEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const release = useRelease(id);
  const tracks = release.data?.tracks ?? [];
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);
  const [rows, setRows] = useState<Draft[]>([]);
  const [original, setOriginal] = useState('[]');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReleaseCredits(id)
      .then((list) => {
        if (cancelled) return;
        if (list === null) setUnsupported(true);
        const drafts = (list ?? []).map((c) => ({ ...c, key: newKey() }));
        setRows(drafts);
        setOriginal(JSON.stringify(drafts.map(({ key: _key, ...c }) => c)));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const update = (key: string, patch: Partial<Credit>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => {
    haptics.select();
    setRows((all) => [...all, { key: newKey(), name: '', role: 'producer', trackId: null }]);
  };

  const filled = rows.filter((r) => r.name.trim().length > 0);
  const current = JSON.stringify(filled.map(({ key: _key, ...c }) => c));
  const changed = current !== original;
  const canSave = changed && !busy;

  const pickRole = (row: Draft) =>
    chooseOne<CreditRole>({
      title: 'What did they do?',
      options: CREDIT_ROLES.map((r) => ({ value: r.value, label: r.label })),
      current: row.role,
      isDark,
      onSelect: (role) => update(row.key, { role, roleLabel: role === 'other' ? row.roleLabel : null }),
    });

  const pickScope = (row: Draft) =>
    chooseOne<string>({
      title: 'This credit is for',
      options: [{ value: '', label: 'The whole release' }, ...tracks.map((t) => ({ value: t.id, label: t.title }))],
      current: row.trackId ?? '',
      isDark,
      onSelect: (trackId) => update(row.key, { trackId: trackId || null }),
    });

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await saveReleaseCredits(id, filled);
      haptics.success();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
      haptics.error();
      setBusy(false);
    }
  };

  const input = {
    ...fontStyle('rounded', '400'),
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  } as const;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, 16) + 12, paddingBottom: insets.bottom + 32, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text variant="display">Credits</Text>
          <Text variant="body" color="textSecondary">
            Add the producers, writers, engineers and labels behind this release. Credit the whole release or a single song.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ paddingVertical: 30 }} />
        ) : unsupported ? (
          <Text variant="body" color="textSecondary">
            Credits aren&apos;t available yet. They&apos;re coming soon.
          </Text>
        ) : (
          <>
            {rows.map((row) => (
              <View key={row.key} style={{ gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <TextInput
                  value={row.name}
                  onChangeText={(name) => update(row.key, { name })}
                  placeholder="Name or company"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={100}
                  autoCapitalize="words"
                  accessibilityLabel="Name"
                  style={input}
                />
                <Pressable onPress={() => pickRole(row)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text variant="caption" color="textSecondary">
                    Role
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text variant="bodyStrong">{roleName(row)}</Text>
                    <ChevronRight size={16} color={colors.textTertiary} />
                  </View>
                </Pressable>
                {row.role === 'other' ? (
                  <TextInput
                    value={row.roleLabel ?? ''}
                    onChangeText={(roleLabel) => update(row.key, { roleLabel })}
                    placeholder="What did they do?"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={40}
                    accessibilityLabel="Role"
                    style={input}
                  />
                ) : null}
                <Pressable onPress={() => pickScope(row)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text variant="caption" color="textSecondary">
                    For
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {row.trackId ? (tracks.find((t) => t.id === row.trackId)?.title ?? 'A song') : 'The whole release'}
                    </Text>
                    <ChevronRight size={16} color={colors.textTertiary} />
                  </View>
                </Pressable>
                <Pressable onPress={() => setRows((all) => all.filter((r) => r.key !== row.key))} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
                  <Text variant="caption" color="danger">
                    Remove
                  </Text>
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={add}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.pill, backgroundColor: colors.primarySoft, opacity: pressed ? 0.8 : 1 })}
            >
              <Plus size={18} color={colors.accent} />
              <Text variant="bodyStrong" color="accent">
                {rows.length === 0 ? 'Add the first credit' : 'Add another credit'}
              </Text>
            </Pressable>

            {error ? (
              <Text variant="caption" color="danger">
                {error}
              </Text>
            ) : null}
            <PrimaryButton label={busy ? 'Saving…' : 'Save credits'} onPress={save} disabled={!canSave} />
          </>
        )}
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
          <Text variant="body" color="textSecondary">
            Cancel
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
