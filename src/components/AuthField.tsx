import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { radius } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { Text } from './Text';

/** The sign-up, sign-in and email-code screens are always dark (like the welcome screen), so these colours are fixed. */
export const AUTH_ACCENT = '#BB88FF';
export const AUTH_DANGER = '#FF7A7A';

/** A labelled text box for the dark sign-in screens. The border lights up purple while typing and red on an error. */
export function AuthField({
  label,
  error,
  right,
  inputRef,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {
  label: string;
  /** A short sentence under the box; also turns the border red. */
  error?: string | null;
  /** Something at the right end of the box, such as the show/hide password eye. */
  right?: ReactNode;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? AUTH_DANGER : focused ? AUTH_ACCENT : 'rgba(255,255,255,0.16)',
          backgroundColor: focused ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)',
        }}
      >
        <TextInput
          ref={inputRef}
          placeholderTextColor="rgba(255,255,255,0.4)"
          selectionColor={AUTH_ACCENT}
          keyboardAppearance="dark"
          accessibilityLabel={label}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              ...fontStyle('rounded', '400'),
              flex: 1,
              fontSize: 17,
              color: '#FFFFFF',
              paddingHorizontal: 16,
              paddingVertical: 15,
            },
            style,
          ]}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" style={{ color: AUTH_DANGER }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The big purple pill used for the main action on the dark sign-in screens. */
export function BrandButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={({ pressed }) => ({
        height: 56,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: AUTH_ACCENT,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color="#121212" />
      ) : (
        <Text variant="bodyStrong" style={{ color: '#121212', fontSize: 17 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
