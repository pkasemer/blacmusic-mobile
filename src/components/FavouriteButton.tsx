/* Reanimated shared values are mutable by design; the compiler lint can't tell. */
/* eslint-disable react-hooks/immutability */
import { Pressable } from 'react-native';
import { Heart } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useFavouritesStore, useIsFavourite } from '@/store/favouritesStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

/**
 * Heart button: tap to add the song or episode to your favourites, tap again to remove it.
 *
 * - `box`: a bordered 52 pt square, matching the other action buttons on the details sheet.
 * - `icon`: a bare 44 pt heart for toolbars and headers, in the colour you pass.
 */
export function FavouriteButton({
  itemId,
  variant = 'icon',
  color,
}: {
  itemId: string;
  variant?: 'box' | 'icon';
  color?: string;
}) {
  const { colors } = useTheme();
  const isFavourite = useIsFavourite(itemId);
  const toggle = useFavouritesStore((s) => s.toggle);
  const scale = useSharedValue(1);

  const ink = color ?? colors.text;
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPress = () => {
    const added = toggle(itemId);
    // A little pop when you add one, a light tap when you remove it.
    if (added) {
      haptics.success();
      scale.value = withSequence(withTiming(0.78, { duration: 80 }), withSpring(1, { damping: 7, stiffness: 280 }));
    } else {
      haptics.light();
      scale.value = withSequence(withTiming(0.9, { duration: 70 }), withTiming(1, { duration: 120 }));
    }
  };

  const size = variant === 'box' ? 52 : 44;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={variant === 'icon' ? 6 : 0}
      accessibilityRole="button"
      accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
      accessibilityState={{ selected: isFavourite }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        ...(variant === 'box'
          ? { borderRadius: radius.md, borderWidth: 1, borderColor: isFavourite ? colors.accent : colors.border }
          : null),
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Animated.View style={popStyle}>
        <Heart
          size={variant === 'box' ? 22 : 24}
          color={variant === 'box' && isFavourite ? colors.accent : ink}
          fill={isFavourite ? (variant === 'box' ? colors.accent : ink) : 'none'}
        />
      </Animated.View>
    </Pressable>
  );
}
