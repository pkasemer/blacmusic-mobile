import { Alert } from 'react-native';
import { createAudioPlaylist, type AudioPlaylist, type AudioSource as ExpoAudioSource } from 'expo-audio';
import { blacApi } from '@/api/blac';
import type { Playable } from '@/domain/types';
import { localUriFor } from '@/store/downloadStore';
import { useMusicStore } from '@/store/musicStore';
import { useSettingsStore } from '@/store/settingsStore';
import { showToast } from '@/store/toastStore';
import { haptics } from '@/utils/haptics';
import type { PlaybackSource } from './source';
import {
  jumpKeepingQueued,
  moveUpcoming,
  nextRepeatMode,
  placeInList,
  queuedAhead,
  queueSlot,
  restoreUpcoming,
  shuffled,
  shuffleUpcoming,
  stillWaiting,
  withQueued,
  type RepeatMode,
} from './queue';

/**
 * On-demand player for music and podcast episodes, built on expo-audio's native `AudioPlaylist`.
 * The native playlist handles gapless moves, next/previous and the lock screen / notification buttons.
 * This file keeps it in step with the queue shown in the UI (`musicStore`) and adds shuffle, repeat and "Add to queue".
 *
 * Never use the native `insert`: on iPhone it rebuilds the whole playlist, which starts the playing song over. Adding
 * at the end and removing songs still to come are the two changes that leave the playing song alone, so a song is put
 * in the middle by taking off what follows that spot and adding it back after the new song.
 *
 * Offline: an item that has a finished, unexpired download plays from the local file instead of streaming.
 * Streaming: the backend's links expire after about an hour, so a link is fetched when an item is queued
 * and renewed before it runs out (see `resolveSource`).
 */

const PREVIOUS_RESTART_AFTER_SEC = 3;
/** A queued link is renewed once it has less than this left. */
const REFRESH_AHEAD_MS = 10 * 60 * 1000;

let playlist: AudioPlaylist | null = null;
/** Bumped on every full reload or stop, so a slow reload that has been replaced can tell and give up. */
let loadSeq = 0;
/** Same idea for rebuilding only the upcoming part of the queue. */
let upcomingSeq = 0;
/** The queue being loaded into the native player right now, if any. */
let loading: Promise<void> = Promise.resolve();
/** Bumped when the player stops, so a song still on its way into the queue is not added to what plays next. */
let session = 0;
/** Songs go into the queue one at a time, in the order they were asked for. */
let additions: Promise<void> = Promise.resolve();

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

/**
 * A source for a song that is already in the queue. If a new link cannot be had (no connection), the one it has is
 * kept for as long as it works, so changing the queue never throws songs out of it.
 */
function sourceToKeep(item: Playable, margin: number): Promise<ExpoAudioSource | null> {
  return resolveSource(item, margin).catch(() => {
    const link = links.get(item.id);
    return link && (link.expiresAt === null || link.expiresAt > Date.now()) ? { uri: link.url } : null;
  });
}

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

/** The player has moved on to the song at `index`. */
function arrivedAt(index: number) {
  const state = useMusicStore.getState();
  if (!state.active || index === state.index) return;
  state.set({ index, waiting: stillWaiting(state.queue, index, state.waiting) });
  const item = state.queue[index];
  if (item) playlist?.updateLockScreenMetadata(metadataFor(item));
  void refreshStaleUpcoming();
}

/**
 * The native player can move to the next song a moment before its event gets here. Called before changing the queue,
 * so a change is never worked out around the wrong song. True if the app had to catch up.
 */
function catchUp(): boolean {
  const { active, queue, index } = useMusicStore.getState();
  const player = getPlaylist();
  if (!active || player.trackCount !== queue.length || player.currentIndex === index) return false;
  arrivedAt(player.currentIndex);
  return true;
}

/** Waits until no queue is being loaded into the native player. */
async function loadSettled() {
  let latest: Promise<void>;
  do {
    latest = loading;
    await latest.catch(() => {});
  } while (latest !== loading);
}

/**
 * Makes the native playlist hold `sources` from position `from` on, in place of what was there. `from` must be after
 * the playing song, which is then not interrupted.
 */
function setNativeTail(from: number, sources: (ExpoAudioSource | null)[]) {
  const player = getPlaylist();
  for (let i = player.trackCount - 1; i >= from; i--) player.remove(i);
  sources.forEach((source) => source && player.add(source));
}

/**
 * A source for a song already in the queue, without waiting: its offline copy or the last link it had. A link that has
 * run out (or is missing) is renewed straight after, see `refreshStaleUpcoming`.
 */
function sourceAtHand(item: Playable): ExpoAudioSource {
  return { uri: localUriFor(item) ?? item.streamUrl ?? links.get(item.id)?.url ?? `unlinked:${item.id}` };
}

/**
 * Brings the native player's songs to come into line with the queue, in the same moment the queue changes. If it
 * waited for links, a tap or the end of a song could meanwhile land on a different song than the one shown. Songs
 * before position `from` have not moved.
 */
function matchUpcoming(from?: number) {
  const { queue, index } = useMusicStore.getState();
  // Nothing to line up while the native player is still loading (or if it failed to).
  if (getPlaylist().trackCount <= index) return;
  const start = Math.max(index + 1, from ?? 0);
  setNativeTail(start, queue.slice(start).map(sourceAtHand));
  void refreshStaleUpcoming();
}

/** The one playlist player, created on first use. */
export function getPlaylist(): AudioPlaylist {
  if (playlist) return playlist;
  const created = createAudioPlaylist({ updateInterval: 500, loop: 'none' });
  playlist = created;

  // The native side moved to another track (finished, or next/previous from the lock screen).
  created.addListener('trackChanged', ({ currentIndex }) => {
    // Events arrive a moment late: one left over from a queue that has since been replaced is ignored.
    if (created.trackCount !== useMusicStore.getState().queue.length || created.currentIndex !== currentIndex) return;
    arrivedAt(currentIndex);
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
async function startQueue(items: Playable[], startIndex: number, repeat: RepeatMode, positionSec = 0, autoplay = true) {
  const seq = ++loadSeq;
  const player = getPlaylist();
  player.pause();
  player.clear();

  const sources = await Promise.all(items.map(resolveOrNull));
  if (seq !== loadSeq) return; // a newer queue (or stop) took over while links were being fetched

  const sourceOf = new Map(items.map((item, i) => [item, sources[i]]));
  // While the links were being fetched, a song may have been removed, the order changed, or another song tapped:
  // the player is filled from the queue as it is now.
  const now = useMusicStore.getState();
  const startItem = now.queue[now.index];
  if (!startItem || sourceOf.get(startItem) === null) {
    now.set({ playing: false, buffering: false });
    cannotPlay();
    return;
  }

  const queue = now.queue.filter((x) => sourceOf.get(x) !== null);
  const index = queue.indexOf(startItem);
  if (queue.length !== now.queue.length) {
    now.set({ queue, originalQueue: now.originalQueue.filter((x) => sourceOf.get(x) !== null), index });
  }

  queue.forEach((item) => player.add(sourceOf.get(item) ?? sourceAtHand(item)));
  player.loop = loopFor(repeat);
  if (index > 0) player.skipTo(index);
  // The saved position belongs to the song that was asked for.
  if (positionSec > 0 && startItem === items[startIndex]) await player.seekTo(positionSec);
  activateLockScreen(startItem);
  if (autoplay) player.play();
  else useMusicStore.getState().set({ playing: false, buffering: false });

  // The queue may have changed again while the player moved to the saved position.
  const latest = useMusicStore.getState().queue;
  if (latest !== queue && (latest.length !== queue.length || latest.some((x, i) => x !== queue[i]))) matchUpcoming();
}

function load(...args: Parameters<typeof startQueue>) {
  loading = startQueue(...args);
}

/**
 * Starts playing `items` from `startIndex`. With `shuffle`, the chosen item plays first and the rest
 * follow in random order. Songs still in the queue stay: they play after the chosen item.
 */
export function playQueue(items: Playable[], startIndex = 0, options: { shuffle?: boolean; source?: PlaybackSource; positionSec?: number } = {}) {
  if (items.length === 0) return;
  const state = useMusicStore.getState();
  const shuffle = options.shuffle ?? state.shuffle;
  haptics.medium();

  const original = items.slice();
  // With shuffle on, the chosen item plays first and the rest follow in random order.
  const list = shuffle ? [original[startIndex], ...shuffled(original.filter((_, i) => i !== startIndex))] : original;
  const index = shuffle ? 0 : startIndex;

  const queued = state.active ? queuedAhead(state.queue, state.index, state.waiting) : [];
  // Choosing a queued song from a list plays it now, so it gives up its place in the queue.
  const chosen = queued.findIndex((x) => x.id === original[startIndex].id);
  if (chosen >= 0) queued.splice(chosen, 1);
  const ordered = withQueued(list, index, queued);

  state.set({
    queue: ordered,
    originalQueue: original,
    waiting: new Set(queued),
    index,
    shuffle,
    active: true,
    playing: true,
    buffering: true,
    source: options.source ?? null,
  });
  load(ordered, index, state.repeat, options.positionSec ?? 0);
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
    load(queue, index, repeat, player.currentTime);
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

/**
 * Jumps to an item that is already in the queue. Jumping to a queued song skips the ones queued before it; jumping to
 * any other song takes the queued songs along, so they still play next.
 */
export function playQueueIndex(index: number) {
  catchUp();
  const state = useMusicStore.getState();
  if (!state.active || index < 0 || index >= state.queue.length) return;
  const target = state.queue[index];
  const moving = index === state.index || state.waiting.has(target) ? [] : queuedAhead(state.queue, state.index, state.waiting);
  const player = getPlaylist();

  if (moving.length === 0) {
    state.set({ index, waiting: stillWaiting(state.queue, index, state.waiting) });
    player.skipTo(index);
  } else {
    const { queue, at } = jumpKeepingQueued(state.queue, state.index, index, state.waiting);
    // The queued songs are all still to come, so taking them out interrupts nothing. They go back behind the new song.
    for (let i = state.queue.length - 1; i > state.index; i--) if (state.waiting.has(state.queue[i])) player.remove(i);
    state.set({ queue, index: at });
    player.skipTo(at);
  }
  if (moving.length > 0) matchUpcoming();
  player.play();
  activateLockScreen(target);
}

/**
 * Loads the songs still to come into the native player again, as the queue now lists them. The current and played
 * songs stay, so the playing one is never interrupted. Items that cannot be linked are dropped.
 */
async function replaceUpcoming() {
  const seq = ++upcomingSeq;
  for (;;) {
    await loadSettled();
    const before = useMusicStore.getState();
    if (!before.active) return;
    const upcoming = before.queue.slice(before.index + 1);
    const sources = await Promise.all(upcoming.map((item) => sourceToKeep(item, REFRESH_AHEAD_MS)));
    if (seq !== upcomingSeq) return; // replaced by a newer change

    // If the queue or the song changed while the links were being fetched, work it out again.
    if (catchUp()) continue;
    const state = useMusicStore.getState();
    if (!state.active) return;
    if (state.queue !== before.queue || state.index !== before.index) continue;

    if (sources.some((s) => s === null)) {
      state.set({ queue: [...state.queue.slice(0, state.index + 1), ...upcoming.filter((_, i) => sources[i] !== null)] });
    }
    // Nothing to do if the native player never got this far (its queue failed to load).
    if (getPlaylist().trackCount > state.index) setNativeTail(state.index + 1, sources);
    return;
  }
}

/** Renews the links of upcoming items that are about to expire (for example in a long listening session). */
async function refreshStaleUpcoming() {
  const { active, queue, index } = useMusicStore.getState();
  if (!active) return;
  if (queue.slice(index + 1).some((item) => linkIsStale(item, REFRESH_AHEAD_MS))) await replaceUpcoming();
}

export function toggleShuffle() {
  catchUp();
  const state = useMusicStore.getState();
  const shuffle = !state.shuffle;
  haptics.select();
  if (!state.active) {
    state.set({ shuffle });
    return;
  }
  const queue = shuffle
    ? shuffleUpcoming(state.queue, state.index, state.waiting)
    : restoreUpcoming(state.queue, state.index, state.originalQueue, state.waiting);
  state.set({ shuffle, queue });
  matchUpcoming();
}

export function cycleRepeat() {
  const state = useMusicStore.getState();
  const repeat = nextRepeatMode(state.repeat);
  haptics.select();
  state.set({ repeat });
  if (playlist) playlist.loop = loopFor(repeat);
}

/**
 * Adds `item` to the queue. It plays after the current song, ahead of the rest of the album or playlist, and songs
 * added this way play in the order they were added. With nothing playing, it starts straight away.
 */
export function addToQueue(item: Playable) {
  if (!useMusicStore.getState().active) {
    playQueue([item]);
    return;
  }
  haptics.light();
  const asked = session;
  // Fetch the link now. The songs still go in one at a time, in the order asked, however long each link takes.
  const link = resolveSource(item);
  link.catch(() => {});
  additions = additions
    .then(() => putInQueue(item, link, asked))
    .catch(() => {
      if (asked === session) cannotPlay();
    });
}

async function putInQueue(item: Playable, link: Promise<ExpoAudioSource>, asked: number) {
  const source = await link;
  for (;;) {
    await loadSettled();
    const before = useMusicStore.getState();
    if (asked !== session || !before.active) return;
    const at = queueSlot(before.queue, before.index, before.waiting);
    const after = before.queue.slice(at);
    // These are in the player already: any link that still works will do.
    const sources = await Promise.all(after.map((x) => sourceToKeep(x, 0)));
    if (asked !== session) return;

    if (catchUp()) continue;
    const state = useMusicStore.getState();
    if (!state.active) return;
    if (state.queue !== before.queue || state.index !== before.index) continue;

    // A copy of its own, so this entry is told apart from the same song elsewhere in the queue.
    const entry: Playable = { ...item };
    state.set({
      queue: [...state.queue.slice(0, at), entry, ...after.filter((_, i) => sources[i] !== null)],
      waiting: new Set(state.waiting).add(entry),
    });
    if (getPlaylist().trackCount >= at) setNativeTail(at, [source, ...sources]);
    showToast('Added to queue');
    return;
  }
}

/**
 * Moves an upcoming song to follow `after` (or to play next, when `after` is `null` or has played since), as one of the
 * queued songs or as one of the rest. The playing song is never interrupted.
 */
export function moveInQueue(entry: Playable, after: Playable | null, queued: boolean) {
  catchUp();
  const state = useMusicStore.getState();
  if (!state.active) return;
  const queue = moveUpcoming(state.queue, state.index, entry, after);
  if (!queue) return;
  const waiting = new Set(state.waiting);
  if (queued) waiting.add(entry);
  else waiting.delete(entry);
  // A queued song is not part of the list being played. With shuffle off, the list follows the order set here; with
  // shuffle on, it keeps its own order.
  let originalQueue = state.originalQueue;
  if (queued) originalQueue = originalQueue.filter((x) => x !== entry);
  else if (!state.shuffle || !originalQueue.includes(entry)) originalQueue = placeInList(originalQueue, queue, entry);

  const from = state.queue.indexOf(entry, state.index + 1);
  const to = queue.indexOf(entry, state.index + 1);
  state.set({ queue, waiting, originalQueue });
  if (from !== to) matchUpcoming(Math.min(from, to));
}

/** Removes an upcoming item from the queue. The current and earlier items cannot be removed this way. */
export function removeFromQueue(index: number) {
  catchUp();
  const state = useMusicStore.getState();
  if (!state.active || index <= state.index || index >= state.queue.length) return;
  const removed = state.queue[index];
  const waiting = new Set(state.waiting);
  // A queued song is not part of the list being played, so the list keeps its own copy of that song.
  const wasQueued = waiting.delete(removed);
  state.set({
    queue: state.queue.filter((_, i) => i !== index),
    originalQueue: wasQueued ? state.originalQueue : state.originalQueue.filter((x) => x !== removed),
    waiting,
  });
  getPlaylist().remove(index);
}

/**
 * Takes songs that are no longer on Blac out of the player. If the one loaded now is among them, playback stops.
 * Songs still to come are removed without a break. Removing one already played makes the native player start the
 * current song over, so in that case the queue is loaded again at the same second, still paused if it was paused.
 */
export function dropFromPlayer(ids: ReadonlySet<string>): 'stopped' | 'removed' | null {
  // Their stream links must not be used again.
  ids.forEach((id) => links.delete(id));
  const state = useMusicStore.getState();
  if (!state.active || !state.queue.some((item) => ids.has(item.id))) return null;
  const current = state.queue[state.index];
  if (!current || ids.has(current.id)) {
    stopMusic();
    return 'stopped';
  }
  if (state.queue.slice(0, state.index).some((item) => ids.has(item.id))) {
    const queue = state.queue.filter((item) => !ids.has(item.id));
    const index = queue.indexOf(current);
    const position = getPlaylist().currentTime;
    const wasPlaying = state.playing;
    upcomingSeq++;
    state.set({ queue, originalQueue: state.originalQueue.filter((item) => !ids.has(item.id)), index });
    load(queue, index, state.repeat, position, wasPlaying);
    return 'removed';
  }
  // From the end, so the positions still to be removed do not move.
  for (let i = state.queue.length - 1; i > state.index; i--) {
    if (ids.has(useMusicStore.getState().queue[i].id)) removeFromQueue(i);
  }
  return 'removed';
}

/** Stops playback, clears the queue and the lock screen. */
export function stopMusic() {
  loadSeq++;
  upcomingSeq++;
  session++;
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

