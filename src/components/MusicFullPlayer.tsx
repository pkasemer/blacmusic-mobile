import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ellipsis, ListMusic, MessageSquareQuote, Moon, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import {
  cycleRepeat,
  nextTrack,
  previousTrack,
  toggleMusicPlayback,
  toggleShuffle,
} from '@/audio/music/musicEngine';
import { useSleepRemaining, formatCountdown } from '@/audio/sleepTimer';
import { useArtworkPalette } from '@/hooks/useArtworkTint';
import { useCurrentItem, useMusicStore } from '@/store/musicStore';
import { radius } from '@/theme';
import { InkContext, type Ink } from '@/theme/ink';
import { haptics } from '@/utils/haptics';
import { ArtistName } from './ArtistName';
import { Artwork } from './Artwork';
import { FavouriteButton } from './FavouriteButton';
import { LyricsView } from './LyricsView';
import { NowPlaying, QueueList } from './QueueList';
import { describeSource, sourceRoute } from '@/audio/music/source';
import { Grain, TintBlobs } from './PlayerBackdrop';
import { SeekBar } from './SeekBar';
import { SleepTimerSheet } from './SleepTimerSheet';
import { Text } from './Text';
import { useTrackMenu } from './TrackActionSheet';
import { subtitleOf } from './TrackRow';

const SPRING = { damping: 28, stiffness: 240, mass: 0.9 };

/**
 * The player looks the same in light and dark mode: white controls and labels on a black canvas washed with the
 * cover's colours. (Picking black or white from the cover's colour went wrong: black text landed on dark backgrounds.)
 */
const PLAYER_INK: Ink = {
  primary: '#FFFFFF',
  secondary: 'rgba(255,255,255,0.84)',
  tertiary: 'rgba(255,255,255,0.66)',
  accent: '#FFFFFF',
};
const CANVAS = '#000000';
/** Darkens the cover's colours just enough that white stays easy to read even on a yellow or very light cover. */
const SCRIM = 'rgba(0,0,0,0.42)';
/** The soft white fill behind round buttons and pills. */
const SOFT_FILL = 'rgba(255,255,255,0.18)';

type Panel = 'cover' | 'lyrics' | 'queue';

/** A plain icon button for the bottom row and the queue pills: no background unless it is switched on. */
function BarButton({
  label,
  onPress,
  active,
  disabled,
  ink,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  ink: Ink;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 52,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? ink.primary : 'transparent',
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/** One of the big transport glyphs: previous, play or pause, next. */
function Transport({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={14}
      style={({ pressed }) => ({
        width: 76,
        height: 76,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
        transform: [{ scale: pressed ? 0.88 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}

/** Full-screen now-playing view, in the style of Apple Music: cover, big controls, lyrics and queue. */
export function MusicFullPlayer() {
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
  const [panel, setPanel] = useState<Panel>('cover');
  const [sleepOpen, setSleepOpen] = useState(false);
  const sleepRemaining = useSleepRemaining();
  const router = useRouter();
  const menu = useTrackMenu();
  const source = useMusicStore((s) => s.source);
  const where = source ? describeSource(source) : null;
  const route = source ? sourceRoute(source) : null;

  const palette = useArtworkPalette(item ? { id: item.id, logoUrl: item.artworkUrl } : null);
  const tint = palette[0];
  const accents = palette.slice(1);
  const ink = PLAYER_INK;

  const minimise = () => {
    haptics.light();
    setPanel('cover');
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

  // The cover breathes: full size while playing, a little smaller when paused, as in Apple Music.
  const cover = useSharedValue(playing ? 1 : 0.84);
  useEffect(() => {
    cover.value = withSpring(playing ? 1 : 0.84, { damping: 14, stiffness: 130, mass: 0.8 });
  }, [playing, cover]);
  const coverStyle = useAnimatedStyle(() => ({ transform: [{ scale: cover.value }] }));

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panel !== 'cover') setPanel('cover');
      else setMusic({ isFullOpen: false });
      return true;
    });
    return () => sub.remove();
  }, [isOpen, panel, setMusic]);

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

  const isTrack = item.kind === 'track';
  const playable = isTrack && !item.preview;
  const artSize = Math.min(width - 56, height * 0.4, 380);
  const isLast = index >= queueLength - 1;
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const hasLyricsButton = isTrack && item.hasLyrics !== false;

  const toggle = (next: Panel) => {
    haptics.select();
    setPanel((current) => (current === next ? 'cover' : next));
  };

  const openArtist = () =>
    goTo(() => {
      if (item.kind === 'track') router.push({ pathname: '/artist/[id]', params: { id: item.artistId } });
      else router.push({ pathname: '/podcast/[id]', params: { id: item.podcastId } });
    });

  /** The song and artist names, left aligned. The song opens its page; the artist (or podcast) opens theirs. */
  const titleBlock = (compact: boolean) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Pressable
        onPress={() => goTo(() => item.kind === 'track' && router.push({ pathname: '/track/[id]', params: { id: item.id } }))}
        disabled={!playable}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. Open song details`}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text variant="title" numberOfLines={2} style={{ fontSize: compact ? 17 : 24, lineHeight: compact ? 22 : 30, fontWeight: '700' }}>
          {item.title}
        </Text>
      </Pressable>
      <Pressable
        onPress={openArtist}
        disabled={item.kind === 'track' && !item.artistId}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${subtitleOf(item)}. Open ${item.kind === 'track' ? 'artist' : 'podcast'}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: 'flex-start', maxWidth: '100%' })}
      >
        <ArtistName name={subtitleOf(item)} verified={item.kind === 'track' ? item.artistVerified : false} variant={compact ? 'caption' : 'body'} color="textSecondary" />
      </Pressable>
    </View>
  );

  /** The heart and the round "more" button on the right of the title. */
  const actions = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {item.kind === 'track' && item.preview ? null : <FavouriteButton itemId={item.id} color={ink.primary} />}
      {playable ? (
        <Pressable
          onPress={() => {
            haptics.select();
            menu.open(item, { onNavigate: minimise });
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="More options"
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: SOFT_FILL,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ellipsis size={20} color={ink.primary} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Animated.View pointerEvents={isOpen ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: CANVAS, overflow: 'hidden' }, sheetStyle]}>
      {/* White status bar over the player; the app's own comes back when it closes */}
      {isOpen ? <StatusBar style="light" /> : null}
      <InkContext.Provider value={ink}>
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
          <TintBlobs tint={tint} accents={accents} active={isOpen} />
          <Grain />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} />

          <GestureDetector gesture={pan}>
            <View style={{ flex: panel === 'cover' ? 1 : 0 }}>
              {/* The grabber, and where the queue came from. Pull down on anything here to close. */}
              <View style={{ alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 8, zIndex: 3 }}>
                <Pressable onPress={minimise} hitSlop={12} accessibilityRole="button" accessibilityLabel="Minimise player" style={{ paddingVertical: 6, paddingHorizontal: 40 }}>
                  <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: ink.tertiary }} />
                </Pressable>
                {panel === 'cover' && where ? (
                  <Pressable
                    onPress={() => {
                      if (route) goTo(() => router.push(route as never));
                    }}
                    disabled={!route}
                    hitSlop={8}
                    accessibilityRole={route ? 'button' : 'text'}
                    accessibilityLabel={`Playing from ${where.kind}${where.name ? ` ${where.name}` : ''}`}
                    style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.6 : 1, paddingHorizontal: 32 })}
                  >
                    <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ textAlign: 'center' }}>
                      Playing from {where.name ? `${where.kind} · ${where.name}` : where.kind}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {panel === 'cover' ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  <Animated.View
                    style={[
                      {
                        width: artSize,
                        height: artSize,
                        borderRadius: 14,
                        shadowColor: '#000',
                        shadowOpacity: 0.4,
                        shadowRadius: 26,
                        shadowOffset: { width: 0, height: 14 },
                      },
                      coverStyle,
                    ]}
                  >
                    <Artwork id={item.id} logoUrl={item.artworkUrl} size={artSize} />
                  </Animated.View>
                </View>
              ) : null}
            </View>
          </GestureDetector>

          {panel !== 'cover' ? (
                <View style={{ flex: 1, zIndex: 1 }}>
                  {/* The queue sets what is playing apart in a card; lyrics have a small song header, as in Apple Music */}
                  {panel === 'queue' ? (
                    <NowPlaying item={item} title={titleBlock(true)} actions={actions} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 }}>
                      <Artwork id={item.id} logoUrl={item.artworkUrl} size={56} />
                      {titleBlock(true)}
                      {actions}
                    </View>
                  )}
                  {panel === 'queue' ? (
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingBottom: 10 }}>
                        <Pressable
                          onPress={toggleShuffle}
                          accessibilityRole="button"
                          accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle off'}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: radius.pill, backgroundColor: shuffle ? ink.primary : SOFT_FILL }}
                        >
                          <Shuffle size={17} color={shuffle ? CANVAS : ink.primary} />
                          <Text variant="bodyStrong" style={{ color: shuffle ? CANVAS : ink.primary, fontSize: 14 }}>
                            Shuffle
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={cycleRepeat}
                          accessibilityRole="button"
                          accessibilityLabel={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: radius.pill, backgroundColor: repeat !== 'off' ? ink.primary : SOFT_FILL }}
                        >
                          <RepeatIcon size={17} color={repeat !== 'off' ? CANVAS : ink.primary} />
                          <Text variant="bodyStrong" style={{ color: repeat !== 'off' ? CANVAS : ink.primary, fontSize: 14 }}>
                            {repeat === 'one' ? 'Repeat one' : 'Repeat'}
                          </Text>
                        </Pressable>
                      </View>
                      <QueueList ink={ink} />
                    </View>
                  ) : (
                    <LyricsView trackId={item.id} />
                  )}
                </View>
          ) : null}

          <View style={{ gap: 18, paddingHorizontal: 28, zIndex: 2 }}>
            {/* Song and artist on the left, heart and more on the right (the cover view only: lyrics and queue have their own) */}
            {panel === 'cover' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {titleBlock(false)}
                {actions}
              </View>
            ) : null}

            <SeekBar slim fillColor={ink.primary} trackColor="rgba(255,255,255,0.3)" />

            {/* The big three: previous, play or pause, next */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
              <Transport label="Previous" onPress={previousTrack}>
                <SkipBack size={38} color={ink.primary} fill={ink.primary} strokeWidth={0} />
              </Transport>
              <Transport label={playing ? 'Pause' : 'Play'} onPress={toggleMusicPlayback}>
                {buffering && !playing ? (
                  <ActivityIndicator color={ink.primary} size="large" />
                ) : playing ? (
                  <Pause size={52} color={ink.primary} fill={ink.primary} strokeWidth={0} />
                ) : (
                  <Play size={52} color={ink.primary} fill={ink.primary} strokeWidth={0} style={{ marginLeft: 4 }} />
                )}
              </Transport>
              <Transport label="Next" onPress={nextTrack} disabled={isLast && repeat !== 'all'}>
                <SkipForward size={38} color={ink.primary} fill={ink.primary} strokeWidth={0} />
              </Transport>
            </View>

            {/* Lyrics on the left, the sleep timer in the middle, the queue on the right */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
              <BarButton label={panel === 'lyrics' ? 'Hide lyrics' : 'Show lyrics'} active={panel === 'lyrics'} disabled={!hasLyricsButton} onPress={() => toggle('lyrics')} ink={ink}>
                <MessageSquareQuote size={22} color={panel === 'lyrics' ? CANVAS : ink.primary} />
              </BarButton>
              <BarButton label="Sleep timer" onPress={() => setSleepOpen(true)} ink={ink}>
                {sleepRemaining !== null ? (
                  <Text variant="caption" style={{ color: ink.primary, fontVariant: ['tabular-nums'] }}>
                    {formatCountdown(sleepRemaining)}
                  </Text>
                ) : (
                  <Moon size={22} color={ink.primary} />
                )}
              </BarButton>
              <BarButton label={panel === 'queue' ? 'Hide queue' : 'Show queue'} active={panel === 'queue'} onPress={() => toggle('queue')} ink={ink}>
                <ListMusic size={22} color={panel === 'queue' ? CANVAS : ink.primary} />
              </BarButton>
            </View>
          </View>
        </View>
      </InkContext.Provider>
      <SleepTimerSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} />
      {menu.sheet}
    </Animated.View>
  );
}
