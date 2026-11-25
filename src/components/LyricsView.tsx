import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useAudioPlaylistStatus } from 'expo-audio';
import { useLyrics, type LyricLine } from '@/api/blac/lyrics';
import { getPlaylist, seekMusic } from '@/audio/music/musicEngine';
import { useInk } from '@/theme/ink';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

/** Index of the line being sung at `time`, or -1 before the first one. */
function activeIndex(lines: LyricLine[], time: number): number {
  let found = -1;
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].timeSec;
    if (at !== null && at <= time + 0.15) found = i;
    else if (at !== null) break;
  }
  return found;
}

/** The part of the player that follows the song: the line being sung is bright and the rest are dim. */
function SyncedLines({ lines }: { lines: LyricLine[] }) {
  const ink = useInk();
  const list = useRef<FlatList<LyricLine>>(null);
  const status = useAudioPlaylistStatus(getPlaylist());
  const active = useMemo(() => activeIndex(lines, status.currentTime), [lines, status.currentTime]);

  // Keep the current line a little below the top.
  useEffect(() => {
    if (active >= 0) list.current?.scrollToIndex({ index: active, animated: true, viewPosition: 0.3 });
  }, [active]);

  return (
    <FlatList
      ref={list}
      data={lines}
      keyExtractor={(_, i) => String(i)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 12, paddingBottom: 200 }}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item, index }) => {
        const current = index === active;
        const text = item.text.trim() ? item.text : '♪';
        return (
          <Pressable
            onPress={() => {
              if (item.timeSec === null) return;
              haptics.select();
              seekMusic(item.timeSec);
            }}
            accessibilityRole="button"
            accessibilityLabel={text}
            style={{ paddingVertical: 9 }}
          >
            <Text variant="display" style={{ fontSize: 28, lineHeight: 36, color: current ? ink.primary : ink.tertiary, opacity: current ? 1 : index < active ? 0.45 : 0.7 }}>
              {text}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

/** Lyrics that are not timed: plain text to read while the song plays. */
function PlainLines({ lines }: { lines: LyricLine[] }) {
  const ink = useInk();
  return (
    <FlatList
      data={lines}
      keyExtractor={(_, i) => String(i)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 12, paddingBottom: 200 }}
      renderItem={({ item }) => (
        <Text variant="display" style={{ fontSize: 24, lineHeight: 33, color: item.text.trim() ? ink.primary : 'transparent' }}>
          {item.text.trim() ? item.text : ' '}
        </Text>
      )}
    />
  );
}

/** The lyrics of one song, in the player. Tapping a line of timed lyrics jumps to it. */
export function LyricsView({ trackId }: { trackId: string }) {
  const lyrics = useLyrics(trackId, true);

  if (lyrics.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!lyrics.data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 40 }}>
        <Text variant="title" style={{ textAlign: 'center' }}>
          {lyrics.isError ? "Can't load the lyrics" : 'No lyrics yet'}
        </Text>
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          {lyrics.isError ? 'Check your connection and try again.' : 'Lyrics show up here when the artist adds them.'}
        </Text>
      </View>
    );
  }
  return lyrics.data.synced ? <SyncedLines lines={lyrics.data.lines} /> : <PlainLines lines={lyrics.data.lines} />;
}
