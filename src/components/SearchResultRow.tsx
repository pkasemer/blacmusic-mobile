import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { VerifiedBadge } from './VerifiedBadge';

/** A small label such as "Song", "Album", "EP", "Playlist" or "Artist". */
export function TagPill({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
      <Text variant="label" color="textSecondary" style={{ fontSize: 10, lineHeight: 14, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

const PAD = 20;
const GAP = 14;
const LEAD = 52;

/**
 * One search result that is not a song (a song uses `TrackRow`): a picture, the title (with the verified badge for a
 * verified artist), and a line with the tag and a short description. Tapping opens its page.
 */
export function SearchResultRow({
  leading,
  title,
  verified,
  tag,
  subtitle,
  onPress,
  onRemove,
  separator = true,
}: {
  /** The cover, artist picture or playlist cover, drawn at 52 points. */
  leading: ReactNode;
  title: string;
  verified?: boolean;
  tag: string;
  subtitle?: ReactNode;
  onPress: () => void;
  /** When set, the row ends with an X that calls this, instead of the chevron (used in recent searches). */
  onRemove?: () => void;
  separator?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tag}: ${title}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: GAP,
        minHeight: 68,
        paddingVertical: 8,
        paddingHorizontal: PAD,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
      })}
    >
      <View style={{ width: LEAD, height: LEAD }}>{leading}</View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Text>
          {verified ? <VerifiedBadge size={15} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TagPill label={tag} />
          {subtitle}
        </View>
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${title} from recent`}>
          <X size={18} color={colors.textTertiary} />
        </Pressable>
      ) : (
        <ChevronRight size={18} color={colors.textTertiary} />
      )}
      {separator ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: PAD + LEAD + GAP, right: PAD, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong }}
        />
      ) : null}
    </Pressable>
  );
}
