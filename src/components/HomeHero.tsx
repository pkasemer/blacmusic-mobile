import { useMemo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { greeting } from '@/utils/timeAgo';
import { Avatar } from './Avatar';
import { HeroWash } from './ScreenHero';
import { Text } from './Text';

/** One quick-access tile: a cover (or icon) and a title. Tapping runs `onPress`. */
export interface HomeTile {
  key: string;
  title: string;
  /** The picture on the left, drawn at 56 by 56. */
  art: ReactNode;
  onPress: () => void;
}

export const TILE_SIZE = 56;

function Tile({ tile }: { tile: HomeTile }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={tile.onPress}
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      style={({ pressed }) => ({
        width: '48.5%',
        height: TILE_SIZE,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.card,
        overflow: 'hidden',
        backgroundColor: colors.surfaceAlt,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ width: TILE_SIZE, height: TILE_SIZE }}>{tile.art}</View>
      <Text variant="headline" numberOfLines={2} style={{ flex: 1, fontSize: 14, lineHeight: 18, paddingHorizontal: 10 }}>
        {tile.title}
      </Text>
    </Pressable>
  );
}

/**
 * The top of Home: a soft purple wash, your picture (opens Settings), a greeting with your name, a search button
 * and a grid of quick-access tiles (your favourites, playlists and recent songs; picks for newcomers).
 */
export function HomeHero({ tiles }: { tiles: HomeTile[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hello = useMemo(() => greeting(), []);
  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  return (
    <View style={{ gap: 20 }}>
      <HeroWash />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 }}>
        {user ? (
          <Pressable
            onPress={() => {
              haptics.select();
              router.navigate('/settings');
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Open your profile and settings"
          >
            <Avatar url={user.avatarUrl} name={user.displayName ?? user.email} size={48} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {hello.text}
          </Text>
          <Text variant="title" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 26, lineHeight: 32 }}>
            {firstName ?? 'Welcome back'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            haptics.select();
            router.navigate('/search');
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={({ pressed }) => ({
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceAlt,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Search size={21} color={colors.text} />
        </Pressable>
      </View>

      {tiles.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, paddingHorizontal: 20 }}>
          {tiles.map((tile) => (
            <Tile key={tile.key} tile={tile} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
