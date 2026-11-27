/**
 * Turns what the player reports into one record per listen and a record per listening session. Kept apart from React
 * and the stores so the rules can be tested on their own.
 *
 * Time heard is how far the song really moved while it was playing, so it does not matter how often the player is
 * looked at: in the background the looks can be far apart. A jump forward (further than the clock moved) and waiting
 * for audio add nothing.
 *
 * A listen is a skip only when there is a reason to think the listener left it: they did something in the app, or the
 * change was seen as it happened (a lock-screen button). A song that ran out, and a change nobody saw, are not skips.
 */

export type ListenOutcome = 'completed' | 'skipped' | 'stopped';

/** Why the listener is about to leave the song, told by the player just before it does. */
export type LeaveReason = 'next' | 'previous' | 'jump' | 'replaced' | 'removed' | 'stopped';

/**
 * How a listen ended. As above, plus: `ended` the song ran out; `restart` started over; `paused` left paused until the
 * session was over; `sign_out`; `app_closed` the app went away with the song open; `unobserved` the song changed at a
 * moment the app did not see.
 */
export type EndReason = LeaveReason | 'ended' | 'restart' | 'paused' | 'sign_out' | 'app_closed' | 'unobserved';

export interface Listen {
  /** Made when the listen starts, so the same listen sent twice is recognised. */
  id: string;
  trackId: string;
  artistId?: string;
  /** Seconds really heard (pauses and jumps forward do not count). */
  listenedSec: number;
  durationSec: number;
  /** Seconds heard as a share of the song, 0 to 100. */
  completion: number;
  /**
   * `completed`: 90% or more heard, or at least half and reached the end. `skipped`: the listener left it early for
   * another song. `stopped`: anything else.
   */
  outcome: ListenOutcome;
  /** The same song had already been listened to in this session, or was started over. */
  replay: boolean;
  source?: string;
  /** Autoplay chose this song, from `autoplaySeedId`. */
  autoplay?: boolean;
  autoplaySeedId?: string;
  endReason: EndReason;
  /** How far into the song it was when last seen. */
  positionSec: number;
  sessionId: string;
  /** Epoch ms the listen ended, as near as is known. */
  at: number;
}

export interface SessionMark {
  sessionId: string;
  /** Epoch ms. */
  at: number;
}

export interface PlayerTrack {
  /** Tells this place in the queue from any other, even one holding the same song. */
  key: number;
  id: string;
  artistId?: string;
  durationSec: number;
  source?: string;
  autoplay?: boolean;
  autoplaySeedId?: string;
}

export interface PlayerSnapshot {
  /** The song loaded in the player (never a podcast or an unpublished preview), or `null`. */
  track: PlayerTrack | null;
  /** Its place in the queue, to tell going back from going on. */
  index: number;
  /** Where the player is in `track`, or `null` while it is not showing that song yet (still loading, or moving). */
  positionSec: number | null;
  playing: boolean;
}

/** A session ends after this long without listening. A song left paused this long is over too. */
export const SESSION_GAP_MS = 30 * 60 * 1000;
const COMPLETED_AT = 0.9;
/** Within this many seconds of the end counts as reaching it. */
const END_SLACK_SEC = 3;
/** The position may be this far ahead of the clock and still have been played through. */
const SEEK_SLACK_SEC = 1.5;
/** A playing song not seen for longer than this was not watched when it changed. */
const FRESH_MS = 5000;
/** How long what the listener did explains the change that follows. */
const INTENT_MS = 5000;

interface Current extends PlayerTrack {
  listenId: string;
  index: number;
  listenedSec: number;
  lastPositionSec: number;
  lastAt: number;
  playing: boolean;
  pausedAt: number | null;
  replay: boolean;
}

const nearEnd = (c: Current) => c.durationSec > 0 && c.lastPositionSec >= c.durationSec - END_SLACK_SEC;

export function createListenTracker(events: {
  onListen: (listen: Listen) => void;
  onSessionStart: (mark: SessionMark) => void;
  onSessionEnd: (mark: SessionMark) => void;
  newId: () => string;
}) {
  let current: Current | null = null;
  let session: { id: string; lastAt: number; heard: Set<string> } | null = null;
  let intent: { reason: LeaveReason; at: number } | null = null;
  /** The queue entry that was closed for signing out: it is not opened again while the player is being stopped. */
  let done: number | null = null;

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

  /** The record of a listen as it would be if it ended this way now. */
  function recordOf(c: Current, sessionId: string, endReason: EndReason, at: number): Listen {
    const share = c.durationSec > 0 ? Math.min(1, c.listenedSec / c.durationSec) : 0;
    const completed = share >= COMPLETED_AT || (nearEnd(c) && share >= 0.5);
    // Starting something else counts against a song only if it was playing then.
    const left = endReason === 'next' || endReason === 'jump' || (endReason === 'replaced' && c.playing);
    return {
      id: c.listenId,
      trackId: c.id,
      artistId: c.artistId,
      listenedSec: Math.round(c.listenedSec),
      durationSec: Math.round(c.durationSec),
      completion: Math.round(share * 100),
      outcome: completed ? 'completed' : left && !nearEnd(c) ? 'skipped' : 'stopped',
      replay: c.replay,
      source: c.source,
      ...(c.autoplay ? { autoplay: true, autoplaySeedId: c.autoplaySeedId } : {}),
      endReason,
      positionSec: Math.max(0, Math.round(c.lastPositionSec)),
      sessionId,
      at,
    };
  }

  function close(endReason: EndReason, at: number) {
    const closing = current;
    current = null;
    if (!closing || !session || closing.listenedSec < 1) return;
    events.onListen(recordOf(closing, session.id, endReason, at));
    session.heard.add(closing.id);
  }

  /** Why the song under way gave way to `next`. */
  function changeReason(c: Current, next: PlayerSnapshot, now: number): EndReason {
    // The same song chosen again, from another list: it was not left.
    if (next.track && next.track.id === c.id) return 'restart';
    if (intent && now - intent.at <= INTENT_MS) {
      // Going on to a podcast, say, is not passing the song over.
      return intent.reason === 'replaced' && !next.track ? 'stopped' : intent.reason;
    }
    if (c.playing) {
      const gap = now - c.lastAt;
      if (gap > FRESH_MS) return 'unobserved';
      if (c.durationSec > 0 && c.lastPositionSec + gap / 1000 >= c.durationSec - END_SLACK_SEC) return 'ended';
    }
    if (!next.track) return 'stopped';
    // Nothing was done in the app, and the song had not run out: a button on the lock screen or headphones.
    return next.index < c.index ? 'previous' : 'next';
  }

  return {
    /** Call whenever the player has something to say, and about once a second while it can. */
    tick(snapshot: PlayerSnapshot, now: number) {
      const { track, index, positionSec, playing } = snapshot;
      if (current?.pausedAt != null && now - current.pausedAt > SESSION_GAP_MS) close('paused', current.pausedAt);
      if (done !== null && track?.key !== done) done = null;

      if (current && (!track || track.key !== current.key)) {
        const reason = changeReason(current, snapshot, now);
        intent = null;
        close(reason, reason === 'unobserved' ? current.lastAt : now);
      }
      if (!track || positionSec === null || track.key === done) return;

      let restarted = false;
      if (current) {
        // Started over: it was well into the song and is back at the beginning (also a song on repeat going round).
        if (positionSec < 3 && current.lastPositionSec > 10 && (current.listenedSec > 10 || nearEnd(current))) {
          restarted = true;
          close(nearEnd(current) ? 'ended' : 'restart', now);
        } else {
          const moved = positionSec - current.lastPositionSec;
          if (current.playing && moved > 0 && moved <= (now - current.lastAt) / 1000 + SEEK_SLACK_SEC) current.listenedSec += moved;
          current.lastPositionSec = positionSec;
          current.lastAt = now;
          current.playing = playing;
          current.pausedAt = playing ? null : (current.pausedAt ?? now);
          current.index = index;
        }
      }
      if (!playing) return;
      const live = sessionAt(now);
      current ??= {
        ...track,
        listenId: events.newId(),
        index,
        // Seen for the first time just after its start: those moments were heard too.
        listenedSec: positionSec < 3 ? Math.min(positionSec, SEEK_SLACK_SEC) : 0,
        lastPositionSec: positionSec,
        lastAt: now,
        playing: true,
        pausedAt: null,
        replay: restarted || live.heard.has(track.id),
      };
    },
    /** The listener is about to do something that leaves the song. Call before the player changes. */
    leaving(reason: LeaveReason, now: number) {
      intent = { reason, at: now };
    },
    /** The last song of the queue ran out. */
    ended(now: number) {
      close('ended', now);
    },
    /** Records what is under way and ends the session, for signing out. */
    finish(now: number) {
      done = current?.key ?? null;
      close('sign_out', now);
      if (session) events.onSessionEnd({ sessionId: session.id, at: Math.min(now, session.lastAt) });
      session = null;
    },
    /** The song under way as it should be recorded if the app went away now, or `null`. */
    draft(): Listen | null {
      return current && session && current.listenedSec >= 1 ? recordOf(current, session.id, 'app_closed', current.lastAt) : null;
    },
    sessionId: () => session?.id,
  };
}
