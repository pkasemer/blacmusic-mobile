/* Reanimated shared values are mutable by design; the compiler lint can't tell. */
/* eslint-disable react-hooks/immutability */
import { Pressable } from 'react-native';
import { Heart } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useFavouritesStore, useIsFavourite } from '@/store/favouritesStore';
import { useTheme } from '@/theme';
import { ActionPill } from './DetailActions';
import { haptics } from '@/utils/haptics';

/**
 * Heart button: tap to add the song or episode to your likes, tap again to remove it.
 *
 * - `pill`: "Like" or "Liked", matching the other buttons on a details page.
 * - `icon`: a bare 44 pt heart for toolbars and headers, in the colour you pass.
 */
export function FavouriteButton({
  itemId,
  variant = 'icon',
  color,
}: {
  itemId: string;
  variant?: 'pill' | 'icon';
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


  if (variant === 'pill') {
    return (
      <ActionPill
        label={isFavourite ? 'Liked' : 'Like'}
        hint={isFavourite ? 'Remove from likes' : 'Add to likes'}
        active={isFavourite}
        onPress={onPress}
        icon={
          <Animated.View style={popStyle}>
            <Heart size={17} color={isFavourite ? colors.accent : colors.text} fill={isFavourite ? colors.accent : 'none'} />
          </Animated.View>
        }
      />
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={isFavourite ? 'Remove from likes' : 'Add to likes'}
      accessibilityState={{ selected: isFavourite }}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Animated.View style={popStyle}>
        <Heart size={24} color={ink} fill={isFavourite ? ink : 'none'} />
      </Animated.View>
    </Pressable>
  );
}
