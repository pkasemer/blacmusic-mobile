import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/theme';

/** A square tick box. The row around it should be the pressable (with role "checkbox"). */
export function Checkbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: checked ? colors.primary : colors.borderStrong,
        backgroundColor: checked ? colors.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {checked ? <Check size={16} color={colors.onPrimary} /> : null}
    </View>
  );
}
