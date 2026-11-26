import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Pause, Play, Shuffle } from 'lucide-react-native';
import { playQueue, toggleMusicPlayback } from '@/audio/music/musicEngine';
import { sameSource, type PlaybackSource } from '@/audio/music/source';
import type { Playable } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import { lightColors, radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

/** The colours of every button here except Play: white with black text in dark mode, soft grey in light mode. */
export function useSecondaryButton() {
  const { colors, isDark } = useTheme();
  return isDark
    ? { fill: '#FFFFFF', activeFill: '#FFFFFF', ink: '#000000', accent: lightColors.accent, muted: lightColors.textTertiary }
    : { fill: colors.surfaceAlt, activeFill: colors.primarySoft, ink: colors.text, accent: colors.accent, muted: colors.textTertiary };
}

/** Wide enough for the longest label ("Downloaded"); five of these still fit across a small phone. */
const ACTION_WIDTH = 66;
const CIRCLE = 46;

/**
 * A page's own action (download, share, like and so on): a small circle with its name underneath. Each is only as big
 * as it needs to be, so the row stays quiet and leaves the space around it empty.
 */
export function ActionButton({
  label,
  icon,
  onPress,
  hint,
  active,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  /** Said by VoiceOver instead of the label, when more words help. */
  hint?: string;
  active?: boolean;
}) {
  const button = useSecondaryButton();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ?? label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({ width: ACTION_WIDTH, alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? button.activeFill : button.fill }}>
        {icon}
      </View>
      <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ fontSize: 11.5, lineHeight: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Play (purple) or Shuffle: two equal pills of a modest, fixed width. */
function MainButton({ label, icon, onPress, main }: { label: string; icon: ReactNode; onPress: () => void; main?: boolean }) {
  const { colors } = useTheme();
  const button = useSecondaryButton();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 132,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: radius.pill,
        backgroundColor: main ? colors.primary : button.fill,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon}
      <Text variant="bodyStrong" style={{ color: main ? colors.onPrimary : button.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The buttons under the top of every details page (artist, album, playlist, song, podcast), all with their names.
 * First Play and Shuffle, centred; under them the page's own actions (`tools`), centred too. While this page's music is the
 * one loaded in the player, Play reads Pause and pauses or resumes it instead of starting over.
 */
export function DetailActions({
  items,
  source,
  currentId,
  shuffle = true,
  tools,
}: {
  /** What Play plays, in order. With nothing to play there is no Play button. */
  items: Playable[];
  source: PlaybackSource;
  /** On a song's page: the song itself. Play then belongs to that song only, and there is nothing to shuffle. */
  currentId?: string;
  /** Off where order matters, such as a podcast. */
  shuffle?: boolean;
  tools?: ReactNode;
}) {
  const { colors } = useTheme();
  const button = useSecondaryButton();
  const isThis = useMusicStore((s) => s.active && (currentId ? s.queue[s.index]?.id === currentId : sameSource(s.source, source)));
  const playing = useMusicStore((s) => s.playing);
  const buffering = useMusicStore((s) => s.buffering);
  const canShuffle = shuffle && !currentId && items.length > 1;
  const loading = isThis && buffering;
  const pausable = isThis && playing;

  return (
    // The top of the page already leaves room below its text, so the buttons sit close under it.
    <View style={{ gap: 20, paddingHorizontal: 20, marginTop: -12 }}>
      {items.length > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          <MainButton
            main
            label={loading ? 'Loading…' : pausable ? 'Pause' : 'Play'}
            icon={
              loading ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : pausable ? (
                <Pause size={17} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
              ) : (
                <Play size={17} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
              )
            }
            onPress={() => (isThis ? toggleMusicPlayback() : playQueue(items, 0, { shuffle: false, source }))}
          />
          {canShuffle ? (
            <MainButton
              label="Shuffle"
              icon={<Shuffle size={18} color={button.ink} />}
              onPress={() => {
                haptics.select();
                playQueue(items, Math.floor(Math.random() * items.length), { shuffle: true, source });
              }}
            />
          ) : null}
        </View>
      ) : null}
      {tools ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 2, rowGap: 14 }}>{tools}</View> : null}
    </View>
  );
}
