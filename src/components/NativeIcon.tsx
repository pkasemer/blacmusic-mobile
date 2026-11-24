import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { LucideIcon } from 'lucide-react-native';

/**
 * An Apple SF Symbol on iOS (the same icons the system uses for Wi-Fi, connection problems and so on,
 * which also follow Dynamic Type and look at home next to the native controls). Other platforms show
 * the matching drawn icon instead.
 */
export function NativeIcon({
  symbol,
  Fallback,
  size,
  color,
  weight = 'medium',
}: {
  symbol: SFSymbol;
  Fallback: LucideIcon;
  size: number;
  color: string;
  weight?: 'regular' | 'medium' | 'semibold';
}) {
  return (
    <SymbolView
      name={symbol}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
      fallback={<Fallback size={size} color={color} />}
    />
  );
}
