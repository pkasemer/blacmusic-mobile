import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowDownCircle, CircleArrowDown, Ellipsis, Play } from 'lucide-react-native';
import { formatTime } from '@/audio/music/queue';
import type { Playable } from '@/domain/types';
import { useDownload } from '@/store/downloadStore';
import { useMusicStore } from '@/store/musicStore';
import { useTheme } from '@/theme';
import { Artwork } from './Artwork';
import { Equalizer } from './Equalizer';
import { Text } from './Text';

export const subtitleOf = (item: Playable) => (item.kind === 'track' ? item.artistName : item.podcastTitle);

const PAD = 20;
const GAP = 14;
const ART = 52;
const NUMBER = 28;

interface Props {
  item: Playable;
  onPress: () => void;
  /** Hide the artwork (for lists that need no cover). */
  compact?: boolean;
  /** Show this number instead of the cover, as in an album's track list. Numbered rows also show the length. */
  index?: number;
  /** When set, the row shows a small play button; `onPress` can then open a details page instead of playing. */
  onPlay?: () => void;
  /** When set, the row ends with a three-dots button that calls this (to open the song's menu). */
  onMore?: () => void;
  /** Extra text after the artist, such as a download size or state. */
  detail?: string;
  detailTone?: 'normal' | 'danger';
  /** A thin line under the row, starting at the text. Turn it off for the last row of a list. Default on. */
  separator?: boolean;
}

/**
 * One row in a song or episode list. A cover (or a number in album lists) on the left, the title above the artist,
 * and on the right the length (numbered lists), a play button and a three-dots button when asked for. The song that
 * is playing is picked out in purple, with moving bars over its cover. A hairline separates rows.
 */
function TrackRowBase({ item, onPress, compact, index, onPlay, onMore, detail, detailTone = 'normal', separator = true }: Props) {
  const { colors } = useTheme();
  // Re-render only when this row's own "is it the current item / is it playing" answer changes.
  const isCurrent = useMusicStore((s) => s.active && s.queue[s.index]?.id === item.id);
  const isPlaying = useMusicStore((s) => s.active && s.playing && s.queue[s.index]?.id === item.id);
  const download = useDownload(item.id);

  const lead = index !== undefined ? NUMBER : compact ? 0 : ART;
  const explicit = item.kind === 'track' && item.explicit;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={onPlay ? `${item.title}, ${subtitleOf(item)}. Open details` : `Play ${item.title}, ${subtitleOf(item)}`}
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
      {/* Left: a number, or the cover with moving bars on it while it plays */}
      {index !== undefined ? (
        <View style={{ width: NUMBER, alignItems: 'center', justifyContent: 'center' }}>
          {isPlaying ? (
            <Equalizer active color={colors.accent} size={13} />
          ) : (
            <Text variant="caption" color={isCurrent ? 'accent' : 'textTertiary'} style={{ fontVariant: ['tabular-nums'], fontSize: 14 }}>
              {index}
            </Text>
          )}
        </View>
      ) : compact ? null : (
        <View style={{ width: ART, height: ART }}>
          <Artwork id={item.id} logoUrl={item.artworkUrl} size={ART} />
          {isPlaying ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
            >
              <Equalizer active color="#FFFFFF" size={16} />
            </View>
          ) : null}
        </View>
      )}

      {/* Middle: title, then explicit tag, download state and the artist */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="headline" numberOfLines={1} color={isCurrent ? 'accent' : 'text'}>
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {explicit ? (
            <View style={{ paddingHorizontal: 4, borderRadius: 3, backgroundColor: colors.textTertiary, alignItems: 'center' }}>
              <Text variant="label" style={{ fontSize: 9, lineHeight: 13, letterSpacing: 0.4, color: colors.bg }}>
                E
              </Text>
            </View>
          ) : null}
          {download?.state === 'done' ? (
            <ArrowDownCircle size={14} color={colors.accent} />
          ) : download ? (
            <CircleArrowDown size={14} color={colors.textTertiary} />
          ) : null}
          <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {subtitleOf(item)}
          </Text>
          {detail ? (
            <Text variant="caption" color={detailTone === 'danger' ? 'danger' : 'textTertiary'} numberOfLines={1}>
              · {detail}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Right: length (numbered lists), play, more */}
      {index !== undefined ? (
        <Text variant="caption" color="textTertiary" style={{ fontVariant: ['tabular-nums'] }}>
          {formatTime(item.durationSec)}
        </Text>
      ) : null}
      {onPlay ? (
        <Pressable
          onPress={onPlay}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Play ${item.title}`}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Play size={15} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} style={{ marginLeft: 1 }} />
        </Pressable>
      ) : null}
      {onMore ? (
        <Pressable
          onPress={onMore}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${item.title}`}
          style={({ pressed }) => ({ padding: 4, marginRight: -4, opacity: pressed ? 0.5 : 1 })}
        >
          <Ellipsis size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      {/* Separator: starts under the text, not under the cover */}
      {separator ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: PAD + (lead > 0 ? lead + GAP : 0),
            right: PAD,
            bottom: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.borderStrong,
          }}
        />
      ) : null}
    </Pressable>
  );
}

export const TrackRow = memo(TrackRowBase);
