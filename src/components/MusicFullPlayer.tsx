import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  ArrowDownCircle,
  ChevronDown,
  CircleArrowDown,
  ListMusic,
  Moon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import {
  cycleRepeat,
  nextTrack,
  playQueueIndex,
  previousTrack,
  removeFromQueue,
  toggleMusicPlayback,
  toggleShuffle,
} from '@/audio/music/musicEngine';
import { useSleepRemaining, formatCountdown } from '@/audio/sleepTimer';
import { useArtworkPalette } from '@/hooks/useArtworkTint';
import type { Playable } from '@/domain/types';
import { cancelDownload, downloadBlockReason, downloadItem } from '@/offline/downloads';
import { useDownload } from '@/store/downloadStore';
import { useCurrentItem, useMusicStore } from '@/store/musicStore';
import { radius, useTheme } from '@/theme';
import { InkContext, useBackdropInk } from '@/theme/ink';
import { haptics } from '@/utils/haptics';
import { Artwork } from './Artwork';
import { FavouriteButton } from './FavouriteButton';
import { describeSource, sourceRoute } from '@/audio/music/source';
import { Grain, TintBlobs } from './PlayerBackdrop';
import { SeekBar } from './SeekBar';
import { SleepTimerSheet } from './SleepTimerSheet';
import { Text } from './Text';
import { subtitleOf } from './TrackRow';

const SPRING = { damping: 28, stiffness: 240, mass: 0.9 };

function IconButton({
  label,
  onPress,
  active,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.primarySoft : 'transparent',
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/** The upcoming queue, with the playing item highlighted. Tap to jump, X to remove an upcoming item. */
function QueueList() {
  const { colors } = useTheme();
  const queue = useMusicStore((s) => s.queue);
  const index = useMusicStore((s) => s.index);

  return (
    <FlatList
      data={queue}
      keyExtractor={(item, i) => `${item.id}-${i}`}
      initialScrollIndex={Math.min(index, Math.max(0, queue.length - 1))}
      getItemLayout={(_, i) => ({ length: 56, offset: 56 * i, index: i })}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
      renderItem={({ item, index: i }) => {
        const isCurrent = i === index;
        return (
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: i < index ? 0.5 : 1 }}>
            <Pressable
              onPress={() => {
                haptics.select();
                playQueueIndex(i);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Play ${item.title}`}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Artwork id={item.id} logoUrl={item.artworkUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1} color={isCurrent ? 'accent' : 'text'}>
                  {item.title}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {subtitleOf(item)}
                </Text>
              </View>
            </Pressable>
            {i > index ? (
              <Pressable
                onPress={() => removeFromQueue(i)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.title} from the queue`}
              >
                <X size={18} color={colors.textTertiary} />
              </Pressable>
            ) : null}
          </View>
        );
      }}
    />
  );
}

/** Download / downloaded / remove, for the item that is playing. */
function DownloadButton({ item }: { item: Playable }) {
  const { colors } = useTheme();
  const entry = useDownload(item.id);
  const blocked = downloadBlockReason(item);
  const done = entry?.state === 'done';
  const busy = entry?.state === 'queued' || entry?.state === 'downloading';
  const label = done ? 'Downloaded. Tap to remove' : busy ? 'Downloading. Tap to cancel' : blocked ?? 'Download for offline';

  return (
    <Pressable
      onPress={() => {
        if (done || busy) cancelDownload(item.id);
        else if (!blocked) downloadItem(item);
      }}
      disabled={!!blocked && !entry}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, opacity: blocked && !entry ? 0.35 : 1 }}
    >
      {done ? (
        <ArrowDownCircle size={20} color={colors.accent} />
      ) : (
        <CircleArrowDown size={20} color={busy ? colors.accent : colors.textSecondary} />
      )}
      {busy ? (
        <Text variant="caption" color="accent" style={{ fontVariant: ['tabular-nums'] }}>
          {Math.round((entry?.progress ?? 0) * 100)}%
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Full-screen now-playing view for music and podcasts: cover, seek bar, shuffle, repeat and queue. */
export function MusicFullPlayer() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const item = useCurrentItem();
  const isOpen = useMusicStore((s) => s.isFullOpen);
  const playing = useMusicStore((s) => s.playing);
  const buffering = useMusicStore((s) => s.buffering);
  const shuffle = useMusicStore((s) => s.shuffle);
  const repeat = useMusicStore((s) => s.repeat);
  const queueLength = useMusicStore((s) => s.queue.length);
  const index = useMusicStore((s) => s.index);
  const setMusic = useMusicStore((s) => s.set);
  const [showQueue, setShowQueue] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const sleepRemaining = useSleepRemaining();
  const router = useRouter();
  const source = useMusicStore((s) => s.source);
  const where = source ? describeSource(source) : null;
  const route = source ? sourceRoute(source) : null;

  const palette = useArtworkPalette(item ? { id: item.id, logoUrl: item.artworkUrl } : null);
  const tint = palette[0];
  const accents = palette.slice(1);
  const ink = useBackdropInk(tint);

  const minimise = () => {
    haptics.light();
    setShowQueue(false);
    setMusic({ isFullOpen: false });
  };

  /** Closes the player, then opens a page behind it: the song's details, the artist, or the podcast. */
  const goTo = (open: () => void) => {
    minimise();
    open();
  };

  const y = useSharedValue(height);
  useEffect(() => {
    y.value = withSpring(isOpen ? 0 : height, SPRING);
  }, [isOpen, height, y]);

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showQueue) setShowQueue(false);
      else setMusic({ isFullOpen: false });
      return true;
    });
    return () => sub.remove();
  }, [isOpen, showQueue, setMusic]);

  /* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable by design. */
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-30, 30])
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 140 || e.velocityY > 900) {
        y.value = withSpring(height, SPRING);
        scheduleOnRN(minimise);
      } else {
        y.value = withSpring(0, SPRING);
      }
    });
  /* eslint-enable react-hooks/immutability */

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (!item) return null;

  const artSize = Math.min(width - 72, 340);
  const isLast = index >= queueLength - 1;
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <Animated.View
      pointerEvents={isOpen ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, overflow: 'hidden' }, sheetStyle]}
    >
      <InkContext.Provider value={ink}>
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
          <TintBlobs tint={tint} accents={accents} active={isOpen} />
          <Grain />

          <GestureDetector gesture={pan}>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                  paddingTop: 6,
                  zIndex: 3,
                }}
              >
                <IconButton label="Minimise player" onPress={minimise}>
                  <ChevronDown size={26} color={ink.primary} />
                </IconButton>
                {/* The middle of the header says where the queue came from; tap it to go back to that page. */}
                <View
                  pointerEvents="box-none"
                  style={{ position: 'absolute', left: 64, right: 64, top: 6, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
                >
                  {showQueue ? (
                    <Text variant="label" color="textSecondary">
                      Queue
                    </Text>
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (route) goTo(() => router.push(route as never));
                      }}
                      disabled={!route}
                      hitSlop={8}
                      accessibilityRole={route ? 'button' : 'text'}
                      accessibilityLabel={where ? `Playing from ${where.kind}${where.name ? ` ${where.name}` : ''}` : 'Now playing'}
                      style={({ pressed }) => ({ alignItems: 'center', gap: 2, opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text variant="label" color="textSecondary">
                        {where ? 'Playing from' : item.kind === 'track' ? 'Now playing' : 'Podcast'}
                      </Text>
                      {where ? (
                        <Text variant="bodyStrong" numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, textAlign: 'center' }}>
                          {where.name ? `${where.kind} · ${where.name}` : where.kind}
                        </Text>
                      ) : null}
                    </Pressable>
                  )}
                </View>
                {item.kind === 'track' && item.preview ? (
                  <View style={{ width: 44, height: 44 }} />
                ) : (
                  <FavouriteButton itemId={item.id} color={ink.primary} />
                )}
              </View>

              {showQueue ? (
                <View style={{ flex: 1, paddingTop: 12 }}>
                  <QueueList />
                </View>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, zIndex: 1 }}>
                  <Artwork id={item.id} logoUrl={item.artworkUrl} size={artSize} />
                  <View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 32 }}>
                    {/* The song name opens the song's page; the artist (or podcast) name opens their page. */}
                    <Pressable
                      onPress={() => goTo(() => item.kind === 'track' && router.push({ pathname: '/track/[id]', params: { id: item.id } }))}
                      disabled={item.kind !== 'track' || !!item.preview}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}. Open song details`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text variant="title" numberOfLines={2} style={{ textAlign: 'center' }}>
                        {item.title}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        goTo(() => {
                          if (item.kind === 'track') router.push({ pathname: '/artist/[id]', params: { id: item.artistId } });
                          else router.push({ pathname: '/podcast/[id]', params: { id: item.podcastId } });
                        })
                      }
                      disabled={item.kind === 'track' && !item.artistId}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${subtitleOf(item)}. Open ${item.kind === 'track' ? 'artist' : 'podcast'}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text variant="bodyStrong" color="textSecondary" numberOfLines={1} style={{ textAlign: 'center' }}>
                        {subtitleOf(item)}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </GestureDetector>

          <View style={{ gap: 6, paddingHorizontal: 28, zIndex: 2 }}>
            <SeekBar fillColor={ink.primary} trackColor="rgba(128,128,128,0.35)" />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <IconButton label={shuffle ? 'Shuffle on' : 'Shuffle off'} active={shuffle} onPress={toggleShuffle}>
                <Shuffle size={22} color={shuffle ? colors.accent : ink.primary} />
              </IconButton>
              <IconButton label="Previous" onPress={previousTrack}>
                <SkipBack size={28} color={ink.primary} fill={ink.primary} strokeWidth={0} />
              </IconButton>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={playing ? 'Pause' : 'Play'}
                onPress={toggleMusicPlayback}
                style={({ pressed }) => ({
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                  transform: pressed ? [{ scale: 0.97 }] : [],
                })}
              >
                {buffering && !playing ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : playing ? (
                  <Pause size={30} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
                ) : (
                  <Play size={30} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} style={{ marginLeft: 3 }} />
                )}
              </Pressable>
              <IconButton label="Next" onPress={nextTrack} disabled={isLast && repeat !== 'all'}>
                <SkipForward size={28} color={ink.primary} fill={ink.primary} strokeWidth={0} />
              </IconButton>
              <IconButton
                label={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
                active={repeat !== 'off'}
                onPress={cycleRepeat}
              >
                <RepeatIcon size={22} color={repeat !== 'off' ? colors.accent : ink.primary} />
              </IconButton>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Pressable
                  onPress={() => setSleepOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Sleep timer"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}
                >
                  <Moon size={18} color={sleepRemaining !== null ? colors.accent : ink.secondary} />
                  {sleepRemaining !== null ? (
                    <Text variant="caption" color="accent" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatCountdown(sleepRemaining)}
                    </Text>
                  ) : null}
                </Pressable>
                <DownloadButton item={item} />
              </View>
              <Pressable
                onPress={() => {
                  haptics.select();
                  setShowQueue((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityLabel={showQueue ? 'Hide queue' : 'Show queue'}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                  backgroundColor: showQueue ? colors.primarySoft : 'transparent',
                }}
              >
                <ListMusic size={20} color={showQueue ? colors.accent : ink.primary} />
                <Text variant="caption" color={showQueue ? 'accent' : 'textSecondary'}>
                  {queueLength > 1 ? `${index + 1} of ${queueLength}` : 'Queue'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </InkContext.Provider>
      <SleepTimerSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} />
    </Animated.View>
  );
}
