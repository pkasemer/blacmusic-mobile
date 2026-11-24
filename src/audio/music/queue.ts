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

/**
 * The upcoming part of a queue after turning shuffle ON: everything after the current item, shuffled.
 * Items already played (before and including `index`) stay where they are.
 */
export function shuffleUpcoming<T>(queue: readonly T[], index: number, random?: () => number): T[] {
  return [...queue.slice(0, index + 1), ...shuffled(queue.slice(index + 1), random)];
}

/**
 * The queue after turning shuffle OFF: keep what already played, then the rest in their original order.
 * `original` is the order the list had before it was shuffled. `idOf` compares items.
 */
export function restoreUpcoming<T>(
  queue: readonly T[],
  index: number,
  original: readonly T[],
  idOf: (item: T) => string,
): T[] {
  const played = queue.slice(0, index + 1);
  const playedIds = new Set(played.map(idOf));
  const current = queue[index];
  const currentOriginal = current ? original.findIndex((x) => idOf(x) === idOf(current)) : -1;
  // Continue from where the current item sits in the original order, then wrap around to what is left.
  const after = original.slice(currentOriginal + 1).filter((x) => !playedIds.has(idOf(x)));
  const before = original.slice(0, Math.max(0, currentOriginal)).filter((x) => !playedIds.has(idOf(x)));
  return [...played, ...after, ...before];
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
