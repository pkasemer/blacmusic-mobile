import { useContext, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Check, ChevronLeft, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { InkContext } from '@/theme/ink';
import { haptics } from '@/utils/haptics';

/** The colours of onboarding: it is drawn on the brand's flat black in light and dark mode alike. */
export const ON_BRAND = {
  accent: '#BB88FF',
  onAccent: '#121212',
  text: '#FFFFFF',
  quiet: 'rgba(255,255,255,0.6)',
  card: 'rgba(255,255,255,0.07)',
  line: 'rgba(255,255,255,0.18)',
  chosen: 'rgba(187,136,255,0.18)',
} as const;

/**
 * The colours of the choice controls: onboarding's own on its black backdrop (which sets the ink), and the app theme's
 * everywhere else (Music preferences in Settings). `fill` and `onFill` are for solid buttons and ticks.
 */
export function useChoiceColors() {
  const onBrand = useContext(InkContext) !== null;
  const { colors, isDark } = useTheme();
  if (onBrand) return { ...ON_BRAND, fill: ON_BRAND.accent, onFill: ON_BRAND.onAccent, keyboard: 'dark' as const };
  return {
    accent: colors.accent,
    text: colors.text,
    quiet: colors.textTertiary,
    card: colors.surface,
    line: colors.borderStrong,
    chosen: colors.primarySoft,
    fill: colors.primary,
    onFill: colors.onPrimary,
    keyboard: isDark ? ('dark' as const) : ('light' as const),
  };
}

/** The big button at the bottom of a screen. */
export function PrimaryAction({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const c = useChoiceColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy, disabled: !!busy || !!disabled }}
      style={({ pressed }) => ({ height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fill, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 })}
    >
      {busy ? (
        <ActivityIndicator color={c.onFill} />
      ) : (
        <Text variant="bodyStrong" style={{ color: c.onFill, fontSize: 17 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * The frame of a setup step: Back and the progress bar on top; the headline and the choices, scrolling; Continue at the
 * bottom. There is no Skip: Continue waits until the step has an answer, and says what is missing.
 */
export function SetupFrame({
  step,
  total,
  title,
  description,
  onBack,
  corner,
  onContinue,
  missing,
  busy,
  children,
}: {
  step: number;
  total: number;
  title: string;
  description: string;
  onBack?: () => void;
  /** A quiet link at the top right (signing out, on the first step). */
  corner?: { label: string; onPress: () => void };
  onContinue: () => void;
  /** Why the step cannot be left yet. */
  missing?: string | null;
  busy?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44 }}>
        <View style={{ width: 52 }}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ padding: 8 }}>
              <ChevronLeft size={26} color={ON_BRAND.text} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }} accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? ON_BRAND.accent : ON_BRAND.line }} />
          ))}
        </View>
        <View style={{ minWidth: 52, alignItems: 'flex-end' }}>
          {corner ? (
            <Pressable onPress={corner.onPress} hitSlop={10} accessibilityRole="button" style={{ padding: 8 }}>
              <Text variant="caption" color="textSecondary">
                {corner.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 18, width: '100%', maxWidth: 560, alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 8 }}>
          <Text variant="display" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36 }}>
            {title}
          </Text>
          <Text variant="body" color="textSecondary" style={{ fontSize: 16, lineHeight: 22 }}>
            {description}
          </Text>
        </View>
        {children}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 4, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        {missing ? (
          <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', paddingBottom: 8 }} accessibilityLiveRegion="polite">
            {missing}
          </Text>
        ) : null}
        <PrimaryAction
          label="Continue"
          busy={busy}
          disabled={!!missing}
          onPress={() => {
            haptics.select();
            onContinue();
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/** A rounded pill that is on or off, with a tick when on. */
export function TogglePill({ label, on, onPress, hint, role = 'checkbox' }: { label: string; on: boolean; onPress: () => void; hint?: string; role?: 'checkbox' | 'button' }) {
  const c = useChoiceColors();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole={role}
      accessibilityState={{ checked: on }}
      accessibilityLabel={hint ?? label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: on ? c.accent : c.line,
        backgroundColor: on ? c.chosen : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {on ? <Check size={14} color={c.accent} strokeWidth={3} /> : null}
      <Text variant="bodyStrong" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A selectable card: a title, a line under it, and a mark on the right (a tick, or a dot for one-of-many). */
export function ChoiceCard({ title, detail, on, onPress, one }: { title: string; detail: string; on: boolean; onPress: () => void; one?: boolean }) {
  const c = useChoiceColors();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole={one ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${title}. ${detail}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: on ? c.accent : c.line,
        backgroundColor: on ? c.chosen : c.card,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {detail}
        </Text>
      </View>
      <View style={{ width: 24, height: 24, borderRadius: one ? 12 : 7, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.fill : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Check size={15} color={c.onFill} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (text: string) => void; placeholder: string }) {
  const c = useChoiceColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
      <Search size={18} color={c.quiet} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.quiet}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        returnKeyType="search"
        keyboardAppearance={c.keyboard}
        style={{ flex: 1, ...fontStyle('rounded', '400'), fontSize: 16, color: c.text, paddingVertical: 0 }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <X size={18} color={c.quiet} />
        </Pressable>
      ) : null}
    </View>
  );
}
