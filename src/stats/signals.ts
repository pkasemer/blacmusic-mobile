import { ApiError, apiRequest } from '@/api/blac/http';
import { useListeningStore, type ListeningEvent } from '@/store/listeningStore';
import { createListenTracker, type Listen } from './listenTracker';

/**
 * Listening behaviour: what is really enjoyed, as opposed to what was picked during onboarding. Events are saved on
 * the phone and sent in batches. A server that cannot take them yet answers "not found"; they are kept (the newest
 * thousand) and tried again later. Counting plays for artists stays with `useReportPlays`.
 */

const BATCH = 50;
/** After "not found", how long before asking again. */
const NOT_THERE_WAIT_MS = 60 * 60 * 1000;
/** How the app measures listens. The server keeps it, so measurements made differently can be told apart. */
const CAPTURE = 2;
/** The saved copy of the listen under way is brought up to date when this much more has been heard. */
const DRAFT_STEP_SEC = 5;

let counter = 0;
export const newEventId = () => `${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function record(event: Omit<ListeningEvent, 'id' | 'at'> & { id?: string; at?: number }) {
  const { id = newEventId(), at = Date.now(), ...rest } = event;
  useListeningStore.getState().add({ ...rest, id, at: new Date(at).toISOString() });
}

function listenEvent({ artistId: _artist, at, ...listen }: Listen): ListeningEvent {
  return { type: 'listen', ...listen, at: new Date(at).toISOString(), capture: CAPTURE };
}

function recordListen(listen: Listen) {
  useListeningStore.getState().add(listenEvent(listen));
  useListeningStore.getState().taste(listen.trackId, (t) => ({
    ...t,
    artistId: listen.artistId ?? t.artistId,
    completed: t.completed + (listen.outcome === 'completed' ? 1 : 0),
    skipped: t.skipped + (listen.outcome === 'skipped' ? 1 : 0),
    replays: t.replays + (listen.replay ? 1 : 0),
  }));
}

export const tracker = createListenTracker({
  onListen: recordListen,
  onSessionStart: ({ sessionId, at }) => record({ type: 'session_start', sessionId, at }),
  onSessionEnd: ({ sessionId, at }) => record({ type: 'session_end', sessionId, at }),
  newId: newEventId,
});

/**
 * Keeps the saved copy of the listen under way, so it is not lost if the app is closed or killed. Writes only when
 * enough has changed, or always with `now` (the app is being put away).
 */
export function saveDraft(now = false) {
  const open = tracker.draft();
  const { draft, setDraft } = useListeningStore.getState();
  if (!open) {
    // Under a second of the song heard, or nothing under way. A draft from before the app was closed waits for
    // `recoverDraft`; one of a listen that has been recorded was put away with it.
    return;
  }
  if (!now && draft?.id === open.id && draft.outcome === open.outcome && Math.abs(open.listenedSec - (draft.listenedSec ?? 0)) < DRAFT_STEP_SEC) {
    return;
  }
  setDraft(listenEvent(open));
}

/** A listen that was still open when the app went away is recorded as it stood. Call before following the player. */
export function recoverDraft() {
  const { draft, add } = useListeningStore.getState();
  if (draft && tracker.draft()?.id !== draft.id) add(draft);
}

/** A like or unlike the listener tapped. Podcast episodes are not music signals. */
export function recordLike(trackId: string, liked: boolean) {
  if (!trackId.startsWith('trk_')) return;
  record({ type: liked ? 'like' : 'unlike', trackId, sessionId: tracker.sessionId() });
  useListeningStore.getState().taste(trackId, (t) => ({ ...t, liked }));
}

/** A song the listener added to a playlist themselves (songs the app adds do not count). */
export function recordPlaylistAdd(trackId: string, playlistId: string) {
  record({ type: 'playlist_add', trackId, playlistId, sessionId: tracker.sessionId() });
}

/** Ends what is under way for signing out, and gives everything not yet sent. */
export function finishForSignOut(): ListeningEvent[] {
  recoverDraft();
  tracker.finish(Date.now());
  return useListeningStore.getState().pending.slice();
}

/**
 * Sends events with the token of an account the app has already signed out of. Resolves the ids the server has dealt
 * with; stops at the first failure.
 */
export async function sendWithToken(events: ListeningEvent[], accessToken: string): Promise<string[]> {
  const done: string[] = [];
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    try {
      await apiRequest<void>('/v1/me/listening-events', { method: 'POST', auth: false, headers: { Authorization: `Bearer ${accessToken}` }, body: { events: batch } });
    } catch {
      break;
    }
    done.push(...batch.map((e) => e.id));
  }
  return done;
}

let sending = false;
let waitUntil = 0;

/** Sends what is waiting. Safe to call often. */
export async function sendSignals() {
  if (sending || Date.now() < waitUntil) return;
  sending = true;
  try {
    for (;;) {
      const batch = useListeningStore.getState().pending.slice(0, BATCH);
      if (batch.length === 0) return;
      try {
        await apiRequest<void>('/v1/me/listening-events', { method: 'POST', body: { events: batch } });
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0;
        if (status === 404 || status === 405) waitUntil = Date.now() + NOT_THERE_WAIT_MS;
        // A batch the server calls wrong would block everything behind it for ever: drop it.
        if (status !== 400 && status !== 422) return;
      }
      useListeningStore.getState().sent(batch.map((e) => e.id));
    }
  } finally {
    sending = false;
  }
}
