import type { LeaveReason } from '@/stats/listenTracker';

/**
 * What the player tells whoever is following the listening. The player's own events keep coming while the app is in
 * the background, when the app's timers may not run.
 */
export type PlayerEvent =
  /** The player reported where it is, or moved to another song. */
  | { type: 'status' }
  /** The listener is about to do something that leaves the current song. Sent before anything changes. */
  | { type: 'leaving'; reason: LeaveReason }
  /** The last song of the queue ran out. */
  | { type: 'ended' };

const listeners = new Set<(event: PlayerEvent) => void>();

export function onPlayerEvent(listener: (event: PlayerEvent) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function emitPlayerEvent(event: PlayerEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Following the listening must never get in the way of the music.
    }
  });
}
