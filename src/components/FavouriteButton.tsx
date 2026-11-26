/* Reanimated shared values are mutable by design; the compiler lint can't tell. */
/* eslint-disable react-hooks/immutability */
import { Pressable } from 'react-native';
import { Heart } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useFavouritesStore, useIsFavourite } from '@/store/favouritesStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

/**
 * Heart button: tap to add the song or episode to your likes, tap again to remove it.
 *
 * - `round`: a 44 pt filled circle, matching the other buttons on a details page.
 * - `icon`: a bare 44 pt heart for toolbars and headers, in the colour you pass.
 */
export function FavouriteButton({
  itemId,
  variant = 'icon',
  color,
}: {
  itemId: string;
  variant?: 'round' | 'icon';
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

  const round = variant === 'round';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={variant === 'icon' ? 6 : 0}
      accessibilityRole="button"
      accessibilityLabel={isFavourite ? 'Remove from likes' : 'Add to likes'}
      accessibilityState={{ selected: isFavourite }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        ...(round ? { borderRadius: 22, backgroundColor: isFavourite ? colors.primarySoft : colors.surfaceAlt } : null),
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Animated.View style={popStyle}>
        <Heart
          size={round ? 20 : 24}
          color={round && isFavourite ? colors.accent : ink}
          fill={isFavourite ? (round ? colors.accent : ink) : 'none'}
        />
      </Animated.View>
    </Pressable>
  );
}
