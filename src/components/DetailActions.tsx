import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Ellipsis, Pause, Play, Shuffle } from 'lucide-react-native';
import { playQueue, toggleMusicPlayback } from '@/audio/music/musicEngine';
import { sameSource, type PlaybackSource } from '@/audio/music/source';
import type { Playable } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

/** The look of every button here except Play: just a thin border, with the theme's text colour inside. */
export function useSecondaryButton() {
  const { colors, isDark } = useTheme();
  return {
    // See-through, so it shows on any colour behind it.
    border: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.24)',
    ink: colors.text,
    accent: colors.accent,
    muted: colors.textTertiary,
  };
}

/** The one shape of every button on these pages: same height, same corners, same gap between them. */
const SHAPE = { height: 54, borderRadius: 12, borderCurve: 'continuous' } as const;
const GAP = 8;
/** After the sheet is told to close, iPhone needs a moment before it can show a dialog or the share sheet. */
const AFTER_SHEET_MS = 250;

/**
 * Where a page's action is drawn: as the second button of the row (beside Play), or as a line in the "More" sheet.
 * `dismiss` is set in the sheet, which closes before the action runs, so a sheet or dialog it opens can appear.
 */
const InSheet = createContext<((after: () => void) => void) | null>(null);

/**
 * One of a page's own actions (download, share, like and so on). In the row it looks like Shuffle, with the icon beside
 * its name; in the "More" sheet it is a full-width line.
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
  const { colors } = useTheme();
  const button = useSecondaryButton();
  const dismiss = useContext(InSheet);
  return (
    <Pressable
      onPress={dismiss ? () => dismiss(() => setTimeout(onPress, AFTER_SHEET_MS)) : onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ?? label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) =>
        dismiss
          ? { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56, paddingHorizontal: 20, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }
          : {
              ...SHAPE,
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 6,
              borderWidth: 1,
              borderColor: active ? button.accent : button.border,
              opacity: pressed ? 0.7 : 1,
            }
      }
    >
      <View style={{ width: dismiss ? 26 : undefined, height: 22, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text
        variant={dismiss ? 'body' : 'bodyStrong'}
        numberOfLines={1}
        adjustsFontSizeToFit={!dismiss}
        minimumFontScale={0.8}
        style={{ flexShrink: 1, color: button.ink, ...(dismiss ? { fontSize: 16 } : null) }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Play (purple) or Shuffle: the same shape as the tiles, in equal columns. */
function MainButton({ label, icon, onPress, main }: { label: string; icon: ReactNode; onPress: () => void; main?: boolean }) {
  const { colors } = useTheme();
  const button = useSecondaryButton();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        ...SHAPE,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: main ? colors.primary : 'transparent',
        borderWidth: 1,
        borderColor: main ? colors.primary : button.border,
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
 * The buttons under the top of every details page (artist, album, playlist, song, podcast, mix): at most three, in one
 * row of equal columns. Play, then Shuffle, then More, which opens a sheet with the page's other actions. Where there
 * is nothing to shuffle (one song, a podcast), the page's first action takes Shuffle's place. While this page's music
 * is the one loaded in the player, Play reads Pause and pauses or resumes it instead of starting over.
 */
export function DetailActions({
  items,
  source,
  currentId,
  shuffle = true,
  actions = [],
}: {
  /** What Play plays, in order. With nothing to play there is no Play button. */
  items: Playable[];
  source: PlaybackSource;
  /** On a song's page: the song itself. Play then belongs to that song only, and there is nothing to shuffle. */
  currentId?: string;
  /** Off where order matters, such as a podcast. */
  shuffle?: boolean;
  /** The page's own actions, most useful first, each an `ActionButton` or something that draws one. */
  actions?: (ReactElement | false | null | undefined)[];
}) {
  const { colors } = useTheme();
  const button = useSecondaryButton();
  const isThis = useMusicStore((s) => s.active && (currentId ? s.queue[s.index]?.id === currentId : sameSource(s.source, source)));
  const playing = useMusicStore((s) => s.playing);
  const buffering = useMusicStore((s) => s.buffering);
  const [open, setOpen] = useState(false);
  const canShuffle = shuffle && !currentId && items.length > 1;
  const loading = isThis && buffering;
  const pausable = isThis && playing;
  const own = actions.filter((a): a is ReactElement => !!a);
  const second = canShuffle ? null : own[0];
  const more = canShuffle ? own : own.slice(1);

  return (
    // The top of the page already leaves room below its text, so the buttons sit close under it.
    <View style={{ flexDirection: 'row', gap: GAP, paddingHorizontal: 20, marginTop: -16 }}>
      {items.length > 0 ? (
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
      ) : null}
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
      {second}
      {more.length > 0 ? (
        <MainButton
          label="More"
          icon={<Ellipsis size={20} color={button.ink} />}
          onPress={() => {
            haptics.select();
            setOpen(true);
          }}
        />
      ) : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        {(dismiss) => (
          <View style={{ flexShrink: 1 }}>
            {'name' in source ? (
              <Text variant="headline" numberOfLines={1} accessibilityRole="header" style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                {source.name}
              </Text>
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 6 }} />
            <ScrollView style={{ flexShrink: 1 }} bounces={false}>
              <InSheet.Provider value={dismiss}>{more}</InSheet.Provider>
            </ScrollView>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}
