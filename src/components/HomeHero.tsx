import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Search } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { useArtworkPalette } from '@/hooks/useArtworkTint';
import { mixHex } from '@/utils/color';
import { Avatar } from './Avatar';
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

/** The big card at the top of Home: what to listen to next. */
export interface HomeFeatured {
  /** A small line above the title, such as "Continue listening". */
  label: string;
  title: string;
  subtitle?: string;
  /** The cover, drawn at 112 by 112. */
  art: ReactNode;
  /** The picture the card takes its colour from. */
  tint: { id: string; logoUrl: string | null };
  /** Opens the page of the song or release. */
  onPress: () => void;
  /** Plays it right away, when there is something to play. */
  onPlay?: () => void;
  /** How far into the song you got, 0 to 1, drawn as a thin bar. */
  progress?: number;
  /** The text on the Play button. */
  playLabel?: string;
}

function FeaturedCard({ featured }: { featured: HomeFeatured }) {
  const { colors } = useTheme();
  const tint = useArtworkPalette(featured.tint)[0];
  // The card is a soft wash of the cover's own colour over the page's grey, so it feels like the music it holds.
  const background = mixHex(colors.surfaceAlt, tint, 0.28);
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        featured.onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${featured.label}: ${featured.title}`}
      style={({ pressed }) => ({
        marginHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 14,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: background,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <View style={{ width: 112, height: 112, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}>{featured.art}</View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="label" color="textSecondary">
          {featured.label}
        </Text>
        <Text variant="title" numberOfLines={2} style={{ fontSize: 20, lineHeight: 25 }}>
          {featured.title}
        </Text>
        {featured.subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {featured.subtitle}
          </Text>
        ) : null}
        {featured.onPlay ? (
          <Pressable
            onPress={() => {
              haptics.select();
              featured.onPlay?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Play ${featured.title}`}
            hitSlop={6}
            style={({ pressed }) => ({
              marginTop: 8,
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingHorizontal: 18,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Play size={15} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
            <Text variant="bodyStrong" color="onPrimary">
              {featured.playLabel ?? 'Play'}
            </Text>
          </Pressable>
        ) : null}
        {featured.progress !== undefined && featured.progress > 0 ? (
          <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.3)', overflow: 'hidden', marginTop: 6 }}>
            <View style={{ width: `${Math.min(100, Math.round(featured.progress * 100))}%`, height: 3, backgroundColor: colors.text }} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The top of Home: a large "Home" title with search and your picture (opens Settings) on the right, a big card for what
 * to listen to next, and a grid of quick-access tiles (your likes, playlists and recent songs; picks for newcomers).
 */
export function HomeHero({ tiles, featured }: { tiles: HomeTile[]; featured?: HomeFeatured }) {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 }}>
        <Text variant="display" accessibilityRole="header" style={{ flex: 1 }}>
          Home
        </Text>
        <Pressable
          onPress={() => {
            haptics.select();
            router.navigate('/search');
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceAlt,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Search size={20} color={colors.text} />
        </Pressable>
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
            <Avatar url={user.avatarUrl} name={user.displayName ?? user.email} size={44} />
          </Pressable>
        ) : null}
      </View>

      {featured ? <FeaturedCard featured={featured} /> : null}

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
