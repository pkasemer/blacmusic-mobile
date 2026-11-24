import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { Text } from './Text';

/** A labelled text box in the app's style. */
export function FormField({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" color="textTertiary">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={label}
        {...props}
        style={[
          {
            ...fontStyle('rounded', '400'),
            fontSize: 16,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            borderRadius: radius.sm,
            paddingHorizontal: 14,
            paddingVertical: 12,
          },
          props.style,
        ]}
      />
    </View>
  );
}

/** The main purple pill button. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        alignItems: 'center',
        paddingVertical: 15,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Text variant="bodyStrong" color="onPrimary">
        {label}
      </Text>
    </Pressable>
  );
}
