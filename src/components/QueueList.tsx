import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, ChevronUp, Menu, X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  measure,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { moveInQueue, playQueueIndex, removeFromQueue } from '@/audio/music/musicEngine';
import { dragTarget, dropAt, dropOffset, upcomingRows, type QueueRow } from '@/audio/music/queue';
import { describeSource } from '@/audio/music/source';
import type { Playable } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import type { Ink } from '@/theme/ink';
import { haptics } from '@/utils/haptics';
import { ArtistName } from './ArtistName';
import { Artwork } from './Artwork';
import { Equalizer } from './Equalizer';
import { Text } from './Text';
import { subtitleOf } from './TrackRow';

const ROW_H = 60;
const HEADER_H = 42;
/** A long queue is shown this many songs at a time. */
const PAGE = 100;
/** Holding a dragged song this close to the top or bottom of the list scrolls it. */
const EDGE = 64;
/** Points per frame at the very edge. */
const SCROLL_SPEED = 9;
const SHIFT_MS = 140;
/** Behind the song being dragged: solid, so the rows under it do not show through. */
const LIFTED = '#3A3A3C';
const CARD_FILL = 'rgba(255,255,255,0.14)';

/** What is playing, set apart in its own card above the queue: moving bars while it plays, still ones when paused. */
export function NowPlaying({ item, title, actions }: { item: Playable; title: ReactNode; actions: ReactNode }) {
  const playing = useMusicStore((s) => s.playing);
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 12, gap: 10, borderRadius: 16, borderCurve: 'continuous', backgroundColor: CARD_FILL }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible accessibilityLabel={playing ? 'Now playing' : 'Paused'}>
        <Equalizer active={playing} color="#FFFFFF" size={12} />
        <Text variant="label" color="textSecondary">
          {playing ? 'Now playing' : 'Paused'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Artwork id={item.id} logoUrl={item.artworkUrl} size={60} />
        {title}
        {actions}
      </View>
    </View>
  );
}

// ---- Dragging ---------------------------------------------------------------------------------------

/** The one drag that can be going on, shared by every row (read and written on the UI thread). */
interface Drag {
  /** The row picked up, or -1. */
  from: SharedValue<number>;
  /** The row it would land on. */
  to: SharedValue<number>;
  /** How far the picked-up row is from its place. */
  dy: SharedValue<number>;
  /** Which arrangement of the list the drag belongs to. Once the list is rearranged, the offsets no longer apply. */
  version: SharedValue<number>;
  /** True while the dropped row slides into place. */
  settling: SharedValue<boolean>;
  heights: SharedValue<number[]>;
  /** How far the finger has moved, and where it is on the screen. */
  moved: SharedValue<number>;
  fingerY: SharedValue<number>;
  startScroll: SharedValue<number>;
  /** The top and bottom of the list on the screen. */
  top: SharedValue<number>;
  bottom: SharedValue<number>;
}

function useDrag(): Drag {
  return {
    from: useSharedValue(-1),
    to: useSharedValue(-1),
    dy: useSharedValue(0),
    version: useSharedValue(0),
    settling: useSharedValue(false),
    heights: useSharedValue<number[]>([]),
    moved: useSharedValue(0),
    fingerY: useSharedValue(0),
    startScroll: useSharedValue(0),
    top: useSharedValue(0),
    bottom: useSharedValue(0),
  };
}

/** Moves a row with the finger if it is the one picked up, or out of its way if it is not. */
function useRowStyle(drag: Drag, pos: number, version: number) {
  return useAnimatedStyle(() => {
    const from = drag.from.value;
    if (from < 0 || drag.version.value !== version) {
      return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, backgroundColor: 'transparent' };
    }
    if (from === pos) return { transform: [{ translateY: drag.dy.value }, { scale: 1.02 }], zIndex: 10, backgroundColor: LIFTED };
    const to = drag.to.value;
    const shift = to > from && pos > from && pos <= to ? -ROW_H : to < from && pos >= to && pos < from ? ROW_H : 0;
    return { transform: [{ translateY: withTiming(shift, { duration: SHIFT_MS }) }, { scale: 1 }], zIndex: 0, backgroundColor: 'transparent' };
  }, [pos, version]);
}

// ---- Rows -------------------------------------------------------------------------------------------

function HeaderRow({ label, pos, version, drag }: { label: string; pos: number; version: number; drag: Drag }) {
  const style = useRowStyle(drag, pos, version);
  return (
    <Animated.View style={[{ height: HEADER_H, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 6 }, style]}>
      <Text variant="bodyStrong" numberOfLines={1} accessibilityRole="header" style={{ fontSize: 15 }}>
        {label}
      </Text>
    </Animated.View>
  );
}

/** A song's cover and names; tapping plays it. */
function SongButton({ entry, onPress }: { entry: Playable; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Play ${entry.title}, ${subtitleOf(entry)}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Artwork id={entry.id} logoUrl={entry.artworkUrl} size={44} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {entry.title}
        </Text>
        <ArtistName name={subtitleOf(entry)} verified={entry.kind === 'track' ? entry.artistVerified : false} />
      </View>
    </Pressable>
  );
}

/** Where a song stands in the queue right now (it may have moved since the row was drawn). -1 once it has played. */
function upcomingIndexOf(entry: Playable) {
  const { queue, index } = useMusicStore.getState();
  return queue.indexOf(entry, index + 1);
}

function UpcomingRow({
  entry,
  pos,
  version,
  drag,
  heights,
  listRef,
  scroll,
  scrollGesture,
  ink,
  onLift,
  onDrop,
  onStep,
}: {
  entry: Playable;
  pos: number;
  version: number;
  drag: Drag;
  heights: number[];
  listRef: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
  scroll: SharedValue<number>;
  scrollGesture: ReturnType<typeof Gesture.Native>;
  ink: Ink;
  onLift: () => void;
  onDrop: (from: number, to: number) => void;
  /** Moves the song one row up or down, for people using VoiceOver. */
  onStep: (from: number, to: number) => void;
}) {
  const style = useRowStyle(drag, pos, version);

  /* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable by design. */
  const pan = Gesture.Pan()
    // Starts on the smallest movement, before the list would take it as a scroll.
    .activeOffsetY([-3, 3])
    .blocksExternalGesture(scrollGesture)
    .onStart((e) => {
      const box = measure(listRef);
      if (drag.from.value >= 0 || !box) return;
      drag.top.value = box.pageY;
      drag.bottom.value = box.pageY + box.height;
      drag.startScroll.value = scroll.value;
      drag.moved.value = e.translationY;
      drag.fingerY.value = e.absoluteY;
      drag.heights.value = heights;
      drag.version.value = version;
      drag.settling.value = false;
      drag.to.value = pos;
      drag.dy.value = 0;
      drag.from.value = pos;
      scheduleOnRN(onLift);
    })
    .onUpdate((e) => {
      if (drag.from.value !== pos || drag.settling.value) return;
      drag.moved.value = e.translationY;
      drag.fingerY.value = e.absoluteY;
      drag.dy.value = e.translationY + scroll.value - drag.startScroll.value;
      drag.to.value = dragTarget(drag.heights.value, pos, drag.dy.value);
    })
    .onFinalize((_, success) => {
      if (drag.from.value !== pos || drag.settling.value || drag.version.value !== version) return;
      drag.settling.value = true;
      // A drag the phone interrupted goes back where it came from.
      const target = success ? drag.to.value : pos;
      drag.to.value = target;
      drag.dy.value = withTiming(dropOffset(drag.heights.value, pos, target), { duration: SHIFT_MS }, () => {
        scheduleOnRN(onDrop, pos, target);
      });
    });
  /* eslint-enable react-hooks/immutability */

  return (
    <Animated.View style={[{ height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 12, paddingLeft: 12, borderRadius: 12 }, style]}>
      <SongButton
        entry={entry}
        onPress={() => {
          const at = upcomingIndexOf(entry);
          if (at < 0) return;
          haptics.select();
          playQueueIndex(at);
        }}
      />
      <Pressable
        onPress={() => {
          const at = upcomingIndexOf(entry);
          if (at >= 0) removeFromQueue(at);
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${entry.title} from the queue`}
        style={({ pressed }) => ({ width: 32, height: ROW_H, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
      >
        <X size={17} color={ink.tertiary} />
      </Pressable>
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${entry.title}`}
          accessibilityHint="Drag to move this song"
          accessibilityActions={[
            { name: 'up', label: 'Move up' },
            { name: 'down', label: 'Move down' },
          ]}
          onAccessibilityAction={(e) => onStep(pos, e.nativeEvent.actionName === 'up' ? pos - 1 : pos + 1)}
          style={{ width: 44, height: ROW_H, alignItems: 'center', justifyContent: 'center' }}
        >
          <Menu size={20} color={ink.secondary} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

// ---- The list ---------------------------------------------------------------------------------------

const keys = new WeakMap<Playable, number>();
let lastKey = 0;
/** A key that stays with an entry as it moves (the same song can be in the queue twice). */
function keyOf(entry: Playable) {
  let key = keys.get(entry);
  if (key === undefined) keys.set(entry, (key = ++lastKey));
  return key;
}

/**
 * What comes after the song that is playing: the songs you queued and the rest of the list, each under its own
 * heading. Drag a song by its handle to move it, tap it to play it, or remove it with the X. Songs already played are
 * folded away at the top.
 */
export function QueueList({ ink }: { ink: Ink }) {
  const queue = useMusicStore((s) => s.queue);
  const index = useMusicStore((s) => s.index);
  const waiting = useMusicStore((s) => s.waiting);
  const repeat = useMusicStore((s) => s.repeat);
  const source = useMusicStore((s) => s.source);
  const [limit, setLimit] = useState(PAGE);
  const [showPlayed, setShowPlayed] = useState(false);
  /** The rows as they were when a song was picked up: they hold still until it is dropped. */
  const [held, setHeld] = useState<QueueRow<Playable>[] | null>(null);
  const [version, setVersion] = useState(0);
  const heldRef = useRef<QueueRow<Playable>[]>([]);

  const live = useMemo(() => upcomingRows(queue, index, waiting, limit), [queue, index, waiting, limit]);
  const rows = held ?? live;
  const heights = useMemo(() => rows.map((r) => (r.kind === 'header' ? HEADER_H : ROW_H)), [rows]);
  const played = queue.slice(0, index);
  const more = Math.max(0, queue.length - index - 1 - limit);
  const where = source ? describeSource(source) : null;
  const restLabel = where ? `Next from ${where.name ? `${where.kind} · ${where.name}` : where.kind}` : 'Up next';

  const listRef = useAnimatedRef<Animated.ScrollView>();
  const scroll = useScrollOffset(listRef);
  const contentHeight = useSharedValue(0);
  const drag = useDrag();
  const scrollGesture = Gesture.Native();

  // The list has been rearranged (or the drag given up): the next drag can start.
  useLayoutEffect(() => {
    drag.from.set(-1);
    // `drag` is a new object each render, holding the same shared values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // While a dragged song is held near the top or bottom, the list scrolls under it.
  /* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable by design. */
  useFrameCallback(() => {
    const from = drag.from.value;
    if (from < 0 || drag.settling.value) return;
    const finger = drag.fingerY.value;
    const above = drag.top.value + EDGE - finger;
    const below = finger - (drag.bottom.value - EDGE);
    const speed = above > 0 ? -SCROLL_SPEED * Math.min(1, above / EDGE) : below > 0 ? SCROLL_SPEED * Math.min(1, below / EDGE) : 0;
    if (speed === 0) return;
    const end = Math.max(0, contentHeight.value - (drag.bottom.value - drag.top.value));
    const next = Math.min(end, Math.max(0, scroll.value + speed));
    if (Math.abs(next - scroll.value) < 0.5) return;
    scrollTo(listRef, 0, next, false);
    drag.dy.value = drag.moved.value + next - drag.startScroll.value;
    drag.to.value = dragTarget(drag.heights.value, from, drag.dy.value);
  });
  /* eslint-enable react-hooks/immutability */

  const lift = () => {
    haptics.medium();
    heldRef.current = rows;
    setHeld(rows);
  };

  const move = (list: QueueRow<Playable>[], from: number, to: number) => {
    const change = dropAt(list, from, to);
    if (!change) return;
    haptics.light();
    moveInQueue(change.entry, change.after, change.queued);
  };

  const drop = (from: number, to: number) => {
    move(heldRef.current, from, to);
    // These change together with the queue, so rows are never drawn in the new order with the old offsets.
    setHeld(null);
    setVersion((v) => v + 1);
  };

  const used = new Map<number, number>();
  /** The entry's own key, numbered if the very same entry is listed more than once. */
  const rowKey = (entry: Playable) => {
    const key = keyOf(entry);
    const times = used.get(key) ?? 0;
    used.set(key, times + 1);
    return `${key}-${times}`;
  };

  return (
    <GestureDetector gesture={scrollGesture}>
      <Animated.ScrollView
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={held === null}
        scrollEventThrottle={16}
        onContentSizeChange={(_, height) => contentHeight.set(height)}
      >
        {played.length > 0 ? (
          <>
            <Pressable
              onPress={() => {
                haptics.select();
                setShowPlayed((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showPlayed }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <Text variant="caption" color="textSecondary">
                {showPlayed ? 'Hide played songs' : `Played earlier · ${played.length}`}
              </Text>
              {showPlayed ? <ChevronUp size={15} color={ink.secondary} /> : <ChevronDown size={15} color={ink.secondary} />}
            </Pressable>
            {showPlayed
              ? played.map((entry, i) => (
                  <View key={rowKey(entry)} style={{ height: ROW_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, opacity: 0.55 }}>
                    <SongButton
                      entry={entry}
                      onPress={() => {
                        haptics.select();
                        playQueueIndex(i);
                      }}
                    />
                  </View>
                ))
              : null}
          </>
        ) : null}

        {rows.map((row, pos) =>
          row.kind === 'header' ? (
            <HeaderRow key={`heading-${pos}`} label={row.queued ? 'Next in queue' : restLabel} pos={pos} version={version} drag={drag} />
          ) : (
            <UpcomingRow
              key={rowKey(row.entry)}
              entry={row.entry}
              pos={pos}
              version={version}
              drag={drag}
              heights={heights}
              listRef={listRef}
              scroll={scroll}
              scrollGesture={scrollGesture}
              ink={ink}
              onLift={lift}
              onDrop={drop}
              onStep={(from, to) => move(rows, from, to)}
            />
          ),
        )}

        {more > 0 ? (
          <Pressable onPress={() => setLimit((n) => n + PAGE)} accessibilityRole="button" style={({ pressed }) => ({ paddingHorizontal: 24, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
            <Text variant="bodyStrong">Show more ({more})</Text>
          </Pressable>
        ) : null}

        {rows.length === 0 ? (
          <View style={{ paddingHorizontal: 32, paddingVertical: 28, gap: 6, alignItems: 'center' }}>
            <Text variant="bodyStrong">Nothing up next</Text>
            <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              {repeat === 'one'
                ? 'Repeat one is on, so this song plays again.'
                : repeat === 'all'
                  ? 'Repeat is on, so the queue starts over after this song.'
                  : 'Choose "Add to queue" on any song to line it up here.'}
            </Text>
          </View>
        ) : null}
      </Animated.ScrollView>
    </GestureDetector>
  );
}
