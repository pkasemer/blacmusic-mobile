import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { Languages } from 'lucide-react-native';
import { useLyrics, type LyricLine } from '@/api/blac/lyrics';
import { getPlaylist, seekMusic } from '@/audio/music/musicEngine';
import { useSettingsStore } from '@/store/settingsStore';
import { radius } from '@/theme';
import { useInk } from '@/theme/ink';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

/** How often the song's position is read, so a line lights up when it is sung. */
const LOOK_EVERY_MS = 100;
/** Where the line being sung sits, as a share of the way down. */
const SUNG_AT = 0.3;

/** Index of the line being sung at `time`, or -1 before the first one. Only lyric lines have times. */
function activeIndex(lines: LyricLine[], time: number): number {
  let found = -1;
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].timeSec;
    if (at !== null && at <= time + 0.15) found = i;
    else if (at !== null) break;
  }
  return found;
}

/** The line being sung now. The screen is only redrawn when it changes. */
function useActiveLine(lines: LyricLine[]) {
  const [active, setActive] = useState(() => activeIndex(lines, getPlaylist().currentTime));
  useEffect(() => {
    const look = () => setActive(activeIndex(lines, getPlaylist().currentTime));
    look();
    const timer = setInterval(look, LOOK_EVERY_MS);
    return () => clearInterval(timer);
  }, [lines]);
  return active;
}

/**
 * The part of the player that follows the song: the line being sung is bright and the rest are dim. A line and its
 * translation are one block, so lines with and without a translation follow the song the same way.
 */
function SyncedLines({ lines, translated }: { lines: LyricLine[]; translated: boolean }) {
  const ink = useInk();
  const list = useRef<FlatList<LyricLine>>(null);
  const active = useActiveLine(lines);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the current line a little below the top; again when translations change the blocks' heights.
  useEffect(() => {
    if (active < 0) return;
    const timer = setTimeout(() => list.current?.scrollToIndex({ index: active, animated: true, viewPosition: SUNG_AT }), 30);
    return () => {
      clearTimeout(timer);
      if (retry.current) clearTimeout(retry.current);
    };
  }, [active, translated]);

  return (
    <FlatList
      ref={list}
      data={lines}
      extraData={`${active}-${translated}`}
      keyExtractor={(_, i) => String(i)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 12, paddingBottom: 200 }}
      // A far line (after jumping ahead) is not measured yet: go near it, then to it.
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
        retry.current = setTimeout(() => list.current?.scrollToIndex({ index, animated: true, viewPosition: SUNG_AT }), 120);
      }}
      renderItem={({ item, index }) => {
        const current = index === active;
        const text = item.text.trim() ? item.text : '♪';
        const translation = translated ? item.translation : undefined;
        const dim = current ? 1 : index < active ? 0.45 : 0.7;
        return (
          <Pressable
            onPress={() => {
              if (item.timeSec === null) return;
              haptics.select();
              seekMusic(item.timeSec);
            }}
            accessibilityRole="button"
            accessibilityLabel={translation ? `${text}. In English: ${translation}` : text}
            style={{ paddingVertical: 9, gap: 4 }}
          >
            <Text variant="display" style={{ fontSize: 28, lineHeight: 36, color: current ? ink.primary : ink.tertiary, opacity: dim }}>
              {text}
            </Text>
            {translation ? (
              <Text variant="headline" style={{ fontSize: 17, lineHeight: 24, color: current ? ink.secondary : ink.tertiary, opacity: dim }}>
                {translation}
              </Text>
            ) : null}
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

/** Turns the English lines on and off. Shown only for lyrics that have some. The choice is remembered. */
function TranslationSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const ink = useInk();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onToggle();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="English translation"
      hitSlop={8}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 24,
        bottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        height: 38,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        // Solid, so the words scrolling underneath do not show through.
        backgroundColor: on ? '#FFFFFF' : '#2A2A2E',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Languages size={16} color={on ? '#121212' : ink.primary} />
      <Text variant="bodyStrong" style={{ fontSize: 13, color: on ? '#121212' : ink.primary }}>
        Translation
      </Text>
    </Pressable>
  );
}

/** The lyrics of one song, in the player. Tapping a line of timed lyrics jumps to it. */
export function LyricsView({ trackId }: { trackId: string }) {
  const lyrics = useLyrics(trackId, true);
  const showTranslations = useSettingsStore((s) => s.showTranslations);
  const setShowTranslations = useSettingsStore((s) => s.setShowTranslations);

  if (lyrics.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FFFFFF" />
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
          {lyrics.isError ? 'Check your connection and try again.' : 'Lyrics show up here when they are added.'}
        </Text>
      </View>
    );
  }
  const { synced, lines } = lyrics.data;
  if (!synced) return <PlainLines lines={lines} />;
  const hasTranslation = lines.some((l) => l.translation);
  return (
    <View style={{ flex: 1 }}>
      <SyncedLines key={trackId} lines={lines} translated={hasTranslation && showTranslations} />
      {hasTranslation ? <TranslationSwitch on={showTranslations} onToggle={() => setShowTranslations(!showTranslations)} /> : null}
    </View>
  );
}
