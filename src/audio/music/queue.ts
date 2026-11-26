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

/*
 * The queue screen. What is still to come is listed in playing order under headings: "queued" songs under one, the
 * rest of the album or playlist under another. A song can be dragged anywhere; the heading above the spot it is
 * dropped on decides whether it is queued.
 */

export type QueueRow<T, R = never> = { kind: 'header'; queued: boolean; basedOn?: R } | { kind: 'song'; entry: T; queued: boolean };

/**
 * The rows for the songs still to come (the first `limit` of them), with a heading wherever the kind changes. `added`
 * says, for songs autoplay put in, which song they were chosen from; each such batch gets its own heading.
 */
export function upcomingRows<T, R = never>(queue: readonly T[], index: number, waiting: ReadonlySet<T>, limit = Infinity, added?: ReadonlyMap<T, R>): QueueRow<T, R>[] {
  const rows: QueueRow<T, R>[] = [];
  let last: { queued: boolean; basedOn: R | undefined } | null = null;
  for (const entry of queue.slice(index + 1, index + 1 + limit)) {
    const queued = waiting.has(entry);
    const basedOn = queued ? undefined : added?.get(entry);
    if (!last || queued !== last.queued || basedOn !== last.basedOn) rows.push({ kind: 'header', queued, ...(basedOn !== undefined ? { basedOn } : null) });
    rows.push({ kind: 'song', entry, queued });
    last = { queued, basedOn };
  }
  return rows;
}

/**
 * What dragging the song at row `from` to row `to` means: which song it now follows (`null`: it plays next) and
 * whether it is queued there. `null` when nothing changes. Nothing can go above the first heading.
 */
export function dropAt<T, R = never>(rows: readonly QueueRow<T, R>[], from: number, to: number): { entry: T; after: T | null; queued: boolean } | null {
  const row = rows[from];
  if (!row || row.kind !== 'song') return null;
  const at = Math.max(1, Math.min(to, rows.length - 1));
  const moved = [...rows.slice(0, from), ...rows.slice(from + 1)];
  moved.splice(at, 0, row);
  let after: T | null = null;
  let queued = row.queued;
  for (let i = 0; i < at; i++) {
    const above = moved[i];
    if (above.kind === 'header') queued = above.queued;
    else after = above.entry;
  }
  return at === from && queued === row.queued ? null : { entry: row.entry, after, queued };
}

/**
 * The queue with the upcoming song `entry` moved to follow `after`. If `after` is `null`, or has played since the
 * drag began, the song goes right after the current one. `null` if `entry` is no longer still to come.
 */
export function moveUpcoming<T>(queue: readonly T[], index: number, entry: T, after: T | null): T[] | null {
  const from = queue.indexOf(entry, index + 1);
  if (from < 0) return null;
  const rest = [...queue.slice(0, from), ...queue.slice(from + 1)];
  const found = after === null ? -1 : rest.indexOf(after, index + 1);
  const at = found < 0 ? index + 1 : found + 1;
  return [...rest.slice(0, at), entry, ...rest.slice(at)];
}

/**
 * The list's own order (what shuffle off returns to) with `entry` placed as it now stands in the queue: after the
 * nearest earlier song of the list, or else before the nearest later one.
 */
export function placeInList<T>(original: readonly T[], queue: readonly T[], entry: T): T[] {
  const list = original.filter((x) => x !== entry);
  const at = queue.indexOf(entry);
  for (let i = at - 1; i >= 0; i--) {
    const found = list.indexOf(queue[i]);
    if (found >= 0) return [...list.slice(0, found + 1), entry, ...list.slice(found + 1)];
  }
  for (let i = at + 1; i < queue.length; i++) {
    const found = list.indexOf(queue[i]);
    if (found >= 0) return [...list.slice(0, found), entry, ...list.slice(found)];
  }
  return [...list, entry];
}

/** While a row is dragged `dy` points from its place, the row it would land on. Rows may differ in height. */
export function dragTarget(heights: readonly number[], from: number, dy: number): number {
  'worklet';
  let top = 0;
  const tops: number[] = [];
  for (let i = 0; i < heights.length; i++) {
    tops.push(top);
    top += heights[i];
  }
  const upper = tops[from] + dy;
  const lower = upper + heights[from];
  let to = from;
  // Moving down, the lower edge has to pass the middle of a row; moving up, the upper edge. Row 0 is a heading.
  for (let i = from + 1; i < heights.length; i++) if (lower > tops[i] + heights[i] / 2) to = i;
  for (let i = from - 1; i >= 1; i--) if (upper < tops[i] + heights[i] / 2) to = i;
  return to;
}

/** How far the dragged row ends up from where it started when it lands on `to`. */
export function dropOffset(heights: readonly number[], from: number, to: number): number {
  'worklet';
  let offset = 0;
  for (let i = from + 1; i <= to; i++) offset += heights[i];
  for (let i = to; i < from; i++) offset -= heights[i];
  return offset;
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
