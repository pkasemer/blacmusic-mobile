/** Pure queue helpers (no React, no audio), so the ordering rules are easy to reason about. */

/** Fisher-Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/*
 * Songs the listener added with "Add to queue" are "queued" until they have had their turn. They sit ahead of the rest
 * of the album or playlist, in the order they were added. `waiting` holds those entries themselves (the same objects as
 * in `queue`), so a queued song is never mistaken for the same song further down the playlist.
 */

/** Where a newly queued song goes: after the last queued song still to come, or else right after the current one. */
export function queueSlot<T>(queue: readonly T[], index: number, waiting: ReadonlySet<T>): number {
  for (let i = queue.length - 1; i > index; i--) if (waiting.has(queue[i])) return i + 1;
  return index + 1;
}

/** The queued songs still to come, in the order they will play. */
export function queuedAhead<T>(queue: readonly T[], index: number, waiting: ReadonlySet<T>): T[] {
  return queue.slice(index + 1).filter((x) => waiting.has(x));
}

/** What is still queued once the player is on `index`: a song that has played, or was skipped past, has had its turn. */
export function stillWaiting<T>(queue: readonly T[], index: number, waiting: ReadonlySet<T>): ReadonlySet<T> {
  const done = queue.slice(0, index + 1).filter((x) => waiting.has(x));
  if (done.length === 0) return waiting;
  const next = new Set(waiting);
  done.forEach((x) => next.delete(x));
  return next;
}

/** A new list with the queued songs placed right after `index`, ahead of the rest of the list. */
export function withQueued<T>(list: readonly T[], index: number, queued: readonly T[]): T[] {
  return [...list.slice(0, index + 1), ...queued, ...list.slice(index + 1)];
}

/**
 * The queue after jumping from `index` to `target` (a song that is not queued): the queued songs come along, so they
 * still play next. `at` is where the target ends up.
 */
export function jumpKeepingQueued<T>(queue: readonly T[], index: number, target: number, waiting: ReadonlySet<T>): { queue: T[]; at: number } {
  const moves = (x: T, i: number) => i > index && waiting.has(x);
  const at = target - queue.slice(0, target).filter(moves).length;
  const rest = queue.filter((x, i) => !moves(x, i));
  return { queue: withQueued(rest, at, queuedAhead(queue, index, waiting)), at };
}

/**
 * The queue after turning shuffle ON: the rest of the list is shuffled. What already played stays where it is, and
 * the queued songs stay next, in their order.
 */
export function shuffleUpcoming<T>(queue: readonly T[], index: number, waiting: ReadonlySet<T>, random?: () => number): T[] {
  const rest = queue.slice(index + 1).filter((x) => !waiting.has(x));
  return [...queue.slice(0, index + 1), ...queuedAhead(queue, index, waiting), ...shuffled(rest, random)];
}

/**
 * The queue after turning shuffle OFF: what already played, then the queued songs, then the rest of the list in its
 * own order. `original` is the list as it was before shuffling; it holds no queued songs.
 */
export function restoreUpcoming<T>(queue: readonly T[], index: number, original: readonly T[], waiting: ReadonlySet<T>): T[] {
  const played = queue.slice(0, index + 1);
  const done = new Set(played);
  // Carry on from the last song of the list that played (the current one may have come from the queue).
  let from = -1;
  for (let i = played.length - 1; i >= 0 && from < 0; i--) from = original.indexOf(played[i]);
  // After that point in the original order, then wrap around to what is left.
  const after = original.slice(from + 1).filter((x) => !done.has(x));
  const before = original.slice(0, Math.max(0, from)).filter((x) => !done.has(x));
  return [...played, ...queuedAhead(queue, index, waiting), ...after, ...before];
}

export type RepeatMode = 'off' | 'all' | 'one';

export const nextRepeatMode = (mode: RepeatMode): RepeatMode =>
  mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off';

/** Seconds as "3:07" or "1:02:09". */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
