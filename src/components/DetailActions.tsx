import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Shuffle } from 'lucide-react-native';
import { playQueue, toggleMusicPlayback } from '@/audio/music/musicEngine';
import { sameSource, type PlaybackSource } from '@/audio/music/source';
import type { Playable } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { PlayButton } from './PlayButton';

const ROUND = 44;
const PLAY = 58;

/** A round button for a page's own actions: like, download, share and so on. */
export function RoundButton({ label, onPress, active, children }: { label: string; onPress: () => void; active?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({
        width: ROUND,
        height: ROUND,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: ROUND / 2,
        backgroundColor: active ? colors.primarySoft : colors.surfaceAlt,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/**
 * The one row of buttons under the top of every details page (artist, album, playlist, song). The page's own actions
 * (`tools`) are on the left; Shuffle and the big round Play button are always on the right, within reach of a thumb.
 * While this page's music is the one loaded in the player, Play pauses and resumes it instead of starting over.
 */
export function DetailActions({
  items,
  source,
  currentId,
  tools,
}: {
  /** What Play plays, in order. With nothing to play there is no Play button. */
  items: Playable[];
  source: PlaybackSource;
  /** On a song's page: the song itself. Play then belongs to that song only, and there is nothing to shuffle. */
  currentId?: string;
  tools?: ReactNode;
}) {
  const { colors } = useTheme();
  const isThis = useMusicStore((s) => s.active && (currentId ? s.queue[s.index]?.id === currentId : sameSource(s.source, source)));
  const phase = useMusicStore((s) => (s.buffering ? 'buffering' : s.playing ? 'playing' : 'paused'));
  const canShuffle = !currentId && items.length > 1;

  return (
    // The top of the page already leaves room below its text, so the row sits close under it.
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginTop: -20, minHeight: PLAY }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>{tools}</View>
      {canShuffle ? (
        <RoundButton
          label="Shuffle"
          onPress={() => {
            haptics.select();
            playQueue(items, Math.floor(Math.random() * items.length), { shuffle: true, source });
          }}
        >
          <Shuffle size={19} color={colors.text} />
        </RoundButton>
      ) : null}
      {items.length > 0 ? (
        <PlayButton
          size={PLAY}
          phase={isThis ? phase : 'paused'}
          onPress={() => (isThis ? toggleMusicPlayback() : playQueue(items, 0, { shuffle: false, source }))}
        />
      ) : null}
    </View>
  );
}
