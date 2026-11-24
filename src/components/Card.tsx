import { View, type ViewProps } from 'react-native';
import { radius, useTheme } from '@/theme';

/** Flat card: no shadow, no left accent — just a light hairline border. */
export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.card,
        },
        style,
      ]}
    />
  );
}
