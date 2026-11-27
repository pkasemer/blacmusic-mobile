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

let counter = 0;
export const newEventId = () => `${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function record(event: Omit<ListeningEvent, 'id' | 'at'> & { at?: number }) {
  const { at = Date.now(), ...rest } = event;
  useListeningStore.getState().add({ ...rest, id: newEventId(), at: new Date(at).toISOString() });
}

function recordListen({ artistId, ...listen }: Listen) {
  record({ type: 'listen', ...listen });
  useListeningStore.getState().taste(listen.trackId, (t) => ({
    ...t,
    artistId: artistId ?? t.artistId,
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
