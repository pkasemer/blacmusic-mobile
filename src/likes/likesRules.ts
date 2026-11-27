/** The rules for keeping likes the same on the phone and the server. Kept apart from the app so they can be tested. */

export interface LikeState {
  /** What the app shows as liked, newest first. Songs and episodes. */
  ids: string[];
  /** Changes the server has not had yet: song id to liked or not. */
  pending: Record<string, boolean>;
  /** The liked songs the server had when last heard from. */
  onServer: string[];
  /** Songs the server would not take (no longer public, say): they stay on the phone and are not sent again. */
  localOnly: string[];
}

/** Only songs are kept by the server; episodes stay on the phone. */
export const isSong = (id: string) => id.startsWith('trk_');

/** A tap on the heart. */
export function toggled(state: LikeState, id: string): LikeState & { liked: boolean } {
  const liked = !state.ids.includes(id);
  return {
    ids: liked ? [id, ...state.ids] : state.ids.filter((x) => x !== id),
    pending: isSong(id) ? { ...state.pending, [id]: liked } : state.pending,
    onServer: state.onServer,
    localOnly: state.localOnly.filter((x) => x !== id),
    liked,
  };
}

/**
 * Brings in what the server has (`server`, newest first). What it had before and no longer has was unliked somewhere
 * else. What it never had (liked before the app sent likes) is marked to be sent. What is waiting to be sent wins.
 */
export function merged(state: LikeState, server: string[]): LikeState {
  const there = new Set(server);
  const before = new Set(state.onServer);
  const stays = new Set(state.localOnly);
  const pending = { ...state.pending };
  for (const id of state.ids) {
    if (isSong(id) && !there.has(id) && !before.has(id) && !stays.has(id) && !(id in pending)) pending[id] = true;
  }
  const kept = state.ids.filter((id) => !isSong(id) || there.has(id) || !before.has(id) || pending[id] === true);
  const have = new Set(kept);
  const added = server.filter((id) => !have.has(id) && pending[id] !== false);
  return { ids: [...added, ...kept], pending, onServer: server, localOnly: state.localOnly };
}

/** What is waiting, in the order to send it: the oldest likes first, so the server lists them in the same order. */
export function toSend(state: LikeState): [string, boolean][] {
  const age = new Map(state.ids.map((id, i) => [id, i]));
  return Object.entries(state.pending).sort(([a], [b]) => (age.get(b) ?? -1) - (age.get(a) ?? -1));
}

/** The server has dealt with one change: it took it, or (`refused`) it never will. A newer change stays waiting. */
export function settled(state: LikeState, id: string, liked: boolean, refused = false): LikeState {
  const pending = { ...state.pending };
  if (pending[id] === liked) delete pending[id];
  const onServer = state.onServer.filter((x) => x !== id);
  if (liked && !refused) onServer.unshift(id);
  return { ids: state.ids, pending, onServer, localOnly: liked && refused ? [...state.localOnly.filter((x) => x !== id), id] : state.localOnly };
}
