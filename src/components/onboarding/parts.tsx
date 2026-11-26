import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Check, ChevronLeft, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { radius } from '@/theme';
import { fontStyle } from '@/theme/fonts';
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

const TOTAL_STEPS = 6;

/** The big button at the bottom of a screen. */
export function PrimaryAction({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      style={({ pressed }) => ({ height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: ON_BRAND.accent, opacity: pressed ? 0.85 : 1 })}
    >
      {busy ? (
        <ActivityIndicator color={ON_BRAND.onAccent} />
      ) : (
        <Text variant="bodyStrong" style={{ color: ON_BRAND.onAccent, fontSize: 17 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * The frame of a preference step: Back, the six-part progress bar and Skip on top; the headline and the choices,
 * scrolling; Continue at the bottom.
 */
export function SetupFrame({
  step,
  title,
  description,
  onBack,
  onSkip,
  onContinue,
  children,
}: {
  /** 2 to 6 (the welcome screen is 1). */
  step: number;
  title: string;
  description: string;
  onBack?: () => void;
  onSkip?: () => void;
  onContinue: () => void;
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
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }} accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? ON_BRAND.accent : ON_BRAND.line }} />
          ))}
        </View>
        <View style={{ width: 52, alignItems: 'flex-end' }}>
          {onSkip ? (
            <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip this step" style={{ padding: 8 }}>
              <Text variant="bodyStrong" color="textSecondary">
                Skip
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
        <PrimaryAction
          label="Continue"
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
        borderColor: on ? ON_BRAND.accent : ON_BRAND.line,
        backgroundColor: on ? ON_BRAND.chosen : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {on ? <Check size={14} color={ON_BRAND.accent} strokeWidth={3} /> : null}
      <Text variant="bodyStrong" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A selectable card: a title, a line under it, and a mark on the right (a tick, or a dot for one-of-many). */
export function ChoiceCard({ title, detail, on, onPress, one }: { title: string; detail: string; on: boolean; onPress: () => void; one?: boolean }) {
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
        borderColor: on ? ON_BRAND.accent : ON_BRAND.line,
        backgroundColor: on ? ON_BRAND.chosen : ON_BRAND.card,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {detail}
        </Text>
      </View>
      <View style={{ width: 24, height: 24, borderRadius: one ? 12 : 7, borderWidth: 1.5, borderColor: on ? ON_BRAND.accent : ON_BRAND.line, backgroundColor: on ? ON_BRAND.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Check size={15} color={ON_BRAND.onAccent} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (text: string) => void; placeholder: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: ON_BRAND.card, borderWidth: 1, borderColor: ON_BRAND.line }}>
      <Search size={18} color={ON_BRAND.quiet} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={ON_BRAND.quiet}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        returnKeyType="search"
        keyboardAppearance="dark"
        style={{ flex: 1, ...fontStyle('rounded', '400'), fontSize: 16, color: ON_BRAND.text, paddingVertical: 0 }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <X size={18} color={ON_BRAND.quiet} />
        </Pressable>
      ) : null}
    </View>
  );
}
