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

/**
 * A solid pill with an icon and a word, for a page's own actions: download, share, like and so on. Pills in a row
 * share its width and move to a new line when they do not fit.
 */
export function ActionPill({
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
      style={({ pressed }) => ({
        flexGrow: 1,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        backgroundColor: active ? button.activeFill : button.fill,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon}
      <Text variant="bodyStrong" numberOfLines={1} style={{ color: button.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One of the two wide buttons: Play (purple) and Shuffle. */
function WideButton({ label, icon, onPress, main }: { label: string; icon: ReactNode; onPress: () => void; main?: boolean }) {
  const { colors } = useTheme();
  const button = useSecondaryButton();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 50,
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
 * First Play and Shuffle, side by side; under them the page's own actions (`tools`). While this page's music is the
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
    <View style={{ gap: 10, paddingHorizontal: 20, marginTop: -16 }}>
      {items.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <WideButton
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
            <WideButton
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
      {tools ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{tools}</View> : null}
    </View>
  );
}
