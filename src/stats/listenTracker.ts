/**
 * Turns what the player is doing, looked at once a second, into one record per listen and a record per listening
 * session. Kept apart from React and the stores so the rules can be tested on their own.
 */

export type ListenOutcome = 'completed' | 'skipped' | 'stopped';

export interface Listen {
  trackId: string;
  artistId?: string;
  /** Seconds really heard (pauses and jumps forward do not count). */
  listenedSec: number;
  durationSec: number;
  /** Seconds heard as a share of the song, 0 to 100. */
  completion: number;
  /** `completed`: 90% or more, or played to the end. `skipped`: left early for another song. `stopped`: playback ended. */
  outcome: ListenOutcome;
  /** The same song had already been listened to in this session, or was started over. */
  replay: boolean;
  source?: string;
  sessionId: string;
}

export interface SessionMark {
  sessionId: string;
  /** Epoch ms. */
  at: number;
}

export interface PlayerSnapshot {
  /** The song loaded in the player (never a podcast or an unpublished preview), or `null`. */
  track: { id: string; artistId?: string; durationSec: number; source?: string } | null;
  positionSec: number;
  playing: boolean;
}

/** A session ends after this long without listening. */
export const SESSION_GAP_MS = 30 * 60 * 1000;
const COMPLETED_AT = 0.9;
/** Within this many seconds of the end counts as reaching it. */
const END_SLACK_SEC = 3;

interface Current {
  trackId: string;
  artistId?: string;
  durationSec: number;
  source?: string;
  listenedSec: number;
  lastPositionSec: number;
  replay: boolean;
}

export function createListenTracker(events: {
  onListen: (listen: Listen) => void;
  onSessionStart: (mark: SessionMark) => void;
  onSessionEnd: (mark: SessionMark) => void;
  newId: () => string;
}) {
  let current: Current | null = null;
  let session: { id: string; lastAt: number; heard: Set<string> } | null = null;

  function sessionAt(now: number) {
    if (session && now - session.lastAt > SESSION_GAP_MS) {
      events.onSessionEnd({ sessionId: session.id, at: session.lastAt });
      session = null;
    }
    if (!session) {
      session = { id: events.newId(), lastAt: now, heard: new Set() };
      events.onSessionStart({ sessionId: session.id, at: now });
    }
    session.lastAt = now;
    return session;
  }

  /** Records the listen under way. `movedOn`: another song took its place (leaving early is then a skip). */
  function close(movedOn: boolean) {
    const done = current;
    current = null;
    if (!done || !session || done.listenedSec < 1) return;
    const share = done.durationSec > 0 ? Math.min(1, done.listenedSec / done.durationSec) : 0;
    const reachedEnd = done.durationSec > 0 && done.lastPositionSec >= done.durationSec - END_SLACK_SEC && share >= 0.5;
    events.onListen({
      trackId: done.trackId,
      artistId: done.artistId,
      listenedSec: Math.round(done.listenedSec),
      durationSec: Math.round(done.durationSec),
      completion: Math.round(share * 100),
      outcome: share >= COMPLETED_AT || reachedEnd ? 'completed' : movedOn ? 'skipped' : 'stopped',
      replay: done.replay,
      source: done.source,
      sessionId: session.id,
    });
    session.heard.add(done.trackId);
  }

  return {
    /** Call once a second. `elapsedSec` is the time since the last call. */
    tick({ track, positionSec, playing }: PlayerSnapshot, now: number, elapsedSec = 1) {
      if (current && (!track || track.id !== current.trackId)) close(track !== null);
      if (!track) return;
      // Started over: it was well into the song and is back at the beginning.
      const restarted = !!current && positionSec < 3 && current.lastPositionSec > 10 && current.listenedSec > 10;
      if (restarted) close(false);
      if (!playing) {
        if (current) current.lastPositionSec = positionSec;
        return;
      }
      const live = sessionAt(now);
      current ??= {
        trackId: track.id,
        artistId: track.artistId,
        durationSec: track.durationSec,
        source: track.source,
        listenedSec: 0,
        lastPositionSec: positionSec,
        replay: restarted || live.heard.has(track.id),
      };
      // After a long gap (the app was in the background) only count as far as the song really got.
      const moved = current.listenedSec === 0 ? positionSec : positionSec - current.lastPositionSec;
      current.listenedSec += elapsedSec <= 2 ? elapsedSec : Math.min(elapsedSec, Math.max(0, moved) + 1);
      current.lastPositionSec = positionSec;
    },
    /** Records what is under way and ends the session, for signing out. */
    finish(now: number) {
      close(false);
      if (session) events.onSessionEnd({ sessionId: session.id, at: Math.min(now, session.lastAt) });
      session = null;
    },
    sessionId: () => session?.id,
  };
}
