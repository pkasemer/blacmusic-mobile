import { Alert } from 'react-native';
import { createAudioPlaylist, type AudioPlaylist, type AudioSource as ExpoAudioSource } from 'expo-audio';
import { blacApi } from '@/api/blac';
import type { Playable } from '@/domain/types';
import { localUriFor } from '@/store/downloadStore';
import { useMusicStore } from '@/store/musicStore';
import { useSettingsStore } from '@/store/settingsStore';
import { haptics } from '@/utils/haptics';
import type { PlaybackSource } from './source';
import { nextRepeatMode, restoreUpcoming, shuffled, shuffleUpcoming, type RepeatMode } from './queue';

/**
 * On-demand player for music and podcast episodes, built on expo-audio's native `AudioPlaylist`.
 * The native playlist handles gapless moves, next/previous and the lock screen / notification buttons.
 * This file keeps it in step with the queue shown in the UI (`musicStore`) and adds shuffle and repeat.
 *
 * Offline: an item that has a finished, unexpired download plays from the local file instead of streaming.
 * Streaming: the backend's links expire after about an hour, so a link is fetched when an item is queued
 * and renewed before it runs out (see `resolveSource`).
 */

const PREVIOUS_RESTART_AFTER_SEC = 3;
/** A queued link is renewed once it has less than this left. */
const REFRESH_AHEAD_MS = 10 * 60 * 1000;
const idOf = (item: Playable) => item.id;

let playlist: AudioPlaylist | null = null;
/** Bumped on every full reload or stop, so a slow reload that has been replaced can tell and give up. */
let loadSeq = 0;
/** Same idea for rebuilding only the upcoming part of the queue. */
let upcomingSeq = 0;

const loopFor = (repeat: RepeatMode) => (repeat === 'one' ? 'single' : repeat === 'all' ? 'all' : 'none');

// ---- Where to play from ----------------------------------------------------------------------------

interface CachedLink {
  url: string;
  expiresAt: number | null;
  quality: string;
}
const links = new Map<string, CachedLink>();

/**
 * Where to play an item from: its offline copy, a direct link it already carries, or a stream link from
 * the backend (reused while it has at least `margin` ms left). Rejects when no link can be had.
 */
export async function resolveSource(item: Playable, margin = REFRESH_AHEAD_MS): Promise<ExpoAudioSource> {
  const local = localUriFor(item);
  if (local) return { uri: local };
  if (item.streamUrl) return { uri: item.streamUrl };

  const quality = useSettingsStore.getState().streamQuality;
  const cached = links.get(item.id);
  if (cached && cached.quality === quality && (cached.expiresAt === null || cached.expiresAt - Date.now() > margin)) {
    return { uri: cached.url };
  }
  const link = await blacApi.getPlayback(item.id, quality);
  links.set(item.id, { ...link, quality });
  return { uri: link.url };
}

const resolveOrNull = (item: Playable) => resolveSource(item).catch(() => null);

/** True when the link for `item` has run out, or is about to. */
function linkIsStale(item: Playable, margin: number): boolean {
  if (localUriFor(item) || item.streamUrl) return false;
  const link = links.get(item.id);
  return !link || (link.expiresAt !== null && link.expiresAt - Date.now() < margin);
}

function cannotPlay() {
  haptics.error();
  Alert.alert("Can't play this right now", 'Check your connection and try again.');
}

// ---- Native playlist -------------------------------------------------------------------------------

function metadataFor(item: Playable) {
  return item.kind === 'track'
    ? { title: item.title, artist: item.artistName, albumTitle: item.albumTitle ?? undefined, artworkUrl: item.artworkUrl ?? undefined }
    : { title: item.title, artist: item.podcastTitle, albumTitle: item.podcastTitle, artworkUrl: item.artworkUrl ?? undefined };
}

function activateLockScreen(item: Playable) {
  playlist?.setActiveForLockScreen(true, metadataFor(item), { showNextTrack: true, showPreviousTrack: true });
}

/** The one playlist player, created on first use. */
export function getPlaylist(): AudioPlaylist {
  if (playlist) return playlist;
  const created = createAudioPlaylist({ updateInterval: 500, loop: 'none' });
  playlist = created;

  // The native side moved to another track (finished, or next/previous from the lock screen).
  created.addListener('trackChanged', ({ currentIndex }) => {
    const state = useMusicStore.getState();
    if (!state.active || currentIndex === state.index) return;
    state.set({ index: currentIndex });
    const item = state.queue[currentIndex];
    if (item) created.updateLockScreenMetadata(metadataFor(item));
    void refreshStaleUpcoming();
  });

  created.addListener('playlistStatusUpdate', (status) => {
    const state = useMusicStore.getState();
    if (!state.active) return;
    if (state.playing !== status.playing || state.buffering !== status.isBuffering) {
      state.set({ playing: status.playing, buffering: status.isBuffering });
    }
  });

  return created;
}

/**
 * Replaces the native playlist with `items`, positioned on `startIndex` (and `positionSec` into it), then
 * plays. Links are fetched first. Items that cannot be linked are dropped from the queue; if the starting
 * item itself cannot be linked, nothing plays.
 */
async function startQueue(items: Playable[], startIndex: number, repeat: RepeatMode, positionSec = 0) {
  const seq = ++loadSeq;
  const player = getPlaylist();
  player.pause();
  player.clear();

  const sources = await Promise.all(items.map(resolveOrNull));
  if (seq !== loadSeq) return; // a newer queue (or stop) took over while links were being fetched

  const startItem = items[startIndex];
  if (!sources[startIndex]) {
    useMusicStore.getState().set({ playing: false, buffering: false });
    cannotPlay();
    return;
  }

  const playable = items.filter((_, i) => sources[i] !== null);
  const index = playable.indexOf(startItem);
  if (playable.length !== items.length) {
    const state = useMusicStore.getState();
    state.set({
      queue: playable,
      originalQueue: state.originalQueue.filter((o) => playable.some((p) => p.id === o.id)),
      index,
    });
  }

  sources.forEach((source) => source && player.add(source));
  player.loop = loopFor(repeat);
  if (index > 0) player.skipTo(index);
  if (positionSec > 0) await player.seekTo(positionSec);
  activateLockScreen(startItem);
  player.play();
}

/**
 * Starts playing `items` from `startIndex`. With `shuffle`, the chosen item plays first and the rest
 * follow in random order.
 */
export function playQueue(items: Playable[], startIndex = 0, options: { shuffle?: boolean; source?: PlaybackSource } = {}) {
  if (items.length === 0) return;
  const state = useMusicStore.getState();
  const shuffle = options.shuffle ?? state.shuffle;
  haptics.medium();

  const original = items.slice();
  // With shuffle on, the chosen item plays first and the rest follow in random order.
  const ordered = shuffle ? [original[startIndex], ...shuffled(original.filter((_, i) => i !== startIndex))] : original;
  const index = shuffle ? 0 : startIndex;

  state.set({ queue: ordered, originalQueue: original, index, shuffle, active: true, playing: true, buffering: true, source: options.source ?? null });
  void startQueue(ordered, index, state.repeat);
}

export function toggleMusicPlayback() {
  const player = getPlaylist();
  const { active, playing, queue, index, repeat } = useMusicStore.getState();
  if (!active) return;
  haptics.light();
  if (playing) {
    player.pause();
    return;
  }
  // A stream link that expired while paused would fail on resume: fetch a new one and carry on from here.
  const current = queue[index];
  if (current && linkIsStale(current, 30_000)) {
    useMusicStore.getState().set({ playing: true, buffering: true });
    void startQueue(queue, index, repeat, player.currentTime);
    return;
  }
  player.play();
}

export function pauseMusic() {
  playlist?.pause();
}

export function nextTrack() {
  const state = useMusicStore.getState();
  if (!state.active || state.queue.length === 0) return;
  haptics.light();
  const atEnd = state.index >= state.queue.length - 1;
  if (atEnd && state.repeat !== 'all') return;
  getPlaylist().next();
}

export function previousTrack() {
  const state = useMusicStore.getState();
  const player = getPlaylist();
  if (!state.active) return;
  haptics.light();
  // Like every player: a second tap goes back a track, the first restarts the current one.
  if (player.currentTime > PREVIOUS_RESTART_AFTER_SEC || state.index === 0) {
    void player.seekTo(0);
    return;
  }
  player.previous();
}

export function seekMusic(seconds: number) {
  void getPlaylist().seekTo(Math.max(0, seconds));
}

export function skipBy(deltaSec: number) {
  const player = getPlaylist();
  void player.seekTo(Math.max(0, Math.min(player.duration || Infinity, player.currentTime + deltaSec)));
}

/** Jumps to an item that is already in the queue. */
export function playQueueIndex(index: number) {
  const state = useMusicStore.getState();
  if (!state.active || index < 0 || index >= state.queue.length) return;
  state.set({ index });
  getPlaylist().skipTo(index);
  getPlaylist().play();
  activateLockScreen(state.queue[index]);
}

/**
 * Replaces everything after the current item with `upcoming` (the current and played items stay, so
 * the track that is playing is never interrupted). Items that cannot be linked are dropped.
 */
async function replaceUpcoming(upcoming: Playable[]) {
  const seq = ++upcomingSeq;
  const sources = await Promise.all(upcoming.map(resolveOrNull));
  if (seq !== upcomingSeq) return; // replaced by a newer change

  const state = useMusicStore.getState();
  if (!state.active) return;
  const player = getPlaylist();
  for (let i = player.trackCount - 1; i > state.index; i--) player.remove(i);
  sources.forEach((source) => source && player.add(source));

  if (sources.some((s) => s === null)) {
    state.set({ queue: [...state.queue.slice(0, state.index + 1), ...upcoming.filter((_, i) => sources[i] !== null)] });
  }
}

/** Renews the links of upcoming items that are about to expire (for example in a long listening session). */
async function refreshStaleUpcoming() {
  const { active, queue, index } = useMusicStore.getState();
  if (!active) return;
  const upcoming = queue.slice(index + 1);
  if (upcoming.some((item) => linkIsStale(item, REFRESH_AHEAD_MS))) await replaceUpcoming(upcoming);
}

export function toggleShuffle() {
  const state = useMusicStore.getState();
  const shuffle = !state.shuffle;
  haptics.select();
  if (!state.active) {
    state.set({ shuffle });
    return;
  }
  const queue = shuffle
    ? shuffleUpcoming(state.queue, state.index)
    : restoreUpcoming(state.queue, state.index, state.originalQueue, idOf);
  state.set({ shuffle, queue });
  void replaceUpcoming(queue.slice(state.index + 1));
}

export function cycleRepeat() {
  const state = useMusicStore.getState();
  const repeat = nextRepeatMode(state.repeat);
  haptics.select();
  state.set({ repeat });
  if (playlist) playlist.loop = loopFor(repeat);
}

/** Plays `item` right after the current one. */
export function playNext(item: Playable) {
  if (!useMusicStore.getState().active) {
    playQueue([item]);
    return;
  }
  void resolveSource(item)
    .then((source) => {
      const state = useMusicStore.getState();
      if (!state.active) return;
      const queue = [...state.queue.slice(0, state.index + 1), item, ...state.queue.slice(state.index + 1)];
      state.set({ queue, originalQueue: [...state.originalQueue, item] });
      getPlaylist().insert(source, state.index + 1);
    })
    .catch(cannotPlay);
}

/** Adds `item` to the end of the queue. */
export function addToQueue(item: Playable) {
  if (!useMusicStore.getState().active) {
    playQueue([item]);
    return;
  }
  void resolveSource(item)
    .then((source) => {
      const state = useMusicStore.getState();
      if (!state.active) return;
      state.set({ queue: [...state.queue, item], originalQueue: [...state.originalQueue, item] });
      getPlaylist().add(source);
    })
    .catch(cannotPlay);
}

/** Removes an upcoming item from the queue. The current and earlier items cannot be removed this way. */
export function removeFromQueue(index: number) {
  const state = useMusicStore.getState();
  if (!state.active || index <= state.index || index >= state.queue.length) return;
  const removed = state.queue[index];
  state.set({
    queue: state.queue.filter((_, i) => i !== index),
    originalQueue: state.originalQueue.filter((x) => x.id !== removed.id),
  });
  getPlaylist().remove(index);
}

/** Stops playback, clears the queue and the lock screen. */
export function stopMusic() {
  loadSeq++;
  upcomingSeq++;
  const state = useMusicStore.getState();
  if (!playlist || !state.active) {
    state.reset();
    return;
  }
  playlist.pause();
  playlist.clear();
  playlist.clearLockScreenControls();
  state.reset();
}

