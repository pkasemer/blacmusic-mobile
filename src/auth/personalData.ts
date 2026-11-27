import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFavouritesStore } from '@/store/favouritesStore';
import { useHistoryStore, type HistoryEntry } from '@/store/historyStore';
import { useListeningStore, type ListeningEvent } from '@/store/listeningStore';
import { settled, type LikeState } from '@/likes/likesRules';
import { useRecentSearchStore, type RecentOpen } from '@/store/recentSearchStore';
import { useResumeStore } from '@/store/resumeStore';
import { useScheduleStore } from '@/store/scheduleStore';

/**
 * What a person builds up on the phone: likes, listening history, recent searches, where they stopped listening, the
 * go-live times chosen for drafts, and whatever the server has not had yet (likes and listening events). At sign out
 * all of it leaves the app, so the next person on this phone sees none of it, and it is set aside under the account it
 * belongs to. It comes back when that same account signs in again, and is thrown away when the account is deleted.
 */
interface Snapshot {
  likes: string[];
  history: HistoryEntry[];
  searches: RecentOpen[];
  resume: { itemId: string | null; positionSec: number; durationSec: number };
  schedule: Record<string, number>;
  /** Missing in what was set aside before likes went to the server. */
  likeSync?: Pick<LikeState, 'pending' | 'onServer' | 'localOnly'>;
  /** Listening events the server has not had. */
  events?: ListeningEvent[];
}

const keyFor = (userId: string) => `blac-personal:${userId}`;

/** What is set aside is read and written one change at a time. */
let chain: Promise<unknown> = Promise.resolve();
function inTurn(work: () => Promise<unknown>): Promise<void> {
  const next = chain.then(work).then(
    () => {},
    () => {},
  );
  chain = next;
  return next;
}

/** Resolves once everything asked of what is set aside has been done. */
export const personalDataSettled = (): Promise<unknown> => chain;

/** Takes everything personal out of the app and sets it aside for `userId`. */
export function putAwayPersonalData(userId: string | undefined) {
  const { itemId, positionSec, durationSec } = useResumeStore.getState();
  const snapshot: Snapshot = {
    likes: useFavouritesStore.getState().ids,
    history: useHistoryStore.getState().entries,
    searches: useRecentSearchStore.getState().items,
    resume: { itemId, positionSec, durationSec },
    schedule: useScheduleStore.getState().byRelease,
    likeSync: (({ pending, onServer, localOnly }) => ({ pending, onServer, localOnly }))(useFavouritesStore.getState()),
    events: useListeningStore.getState().pending,
  };
  useFavouritesStore.setState({ ids: [], pending: {}, onServer: [], localOnly: [] });
  useHistoryStore.getState().clear();
  useRecentSearchStore.getState().clear();
  useResumeStore.getState().clear();
  useScheduleStore.setState({ byRelease: {} });
  if (userId) void inTurn(() => AsyncStorage.setItem(keyFor(userId), JSON.stringify(snapshot)));
}

/** Takes out of what was set aside the events and likes the server has since had. */
export function removeFromAside(userId: string, eventIds: string[], likes: [string, boolean][]): Promise<void> {
  return inTurn(async () => {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return;
    const saved = JSON.parse(raw) as Snapshot;
    const sent = new Set(eventIds);
    saved.events = saved.events?.filter((e) => !sent.has(e.id));
    if (saved.likeSync) {
      let state: LikeState = { ids: saved.likes, ...saved.likeSync };
      for (const [id, liked] of likes) state = settled(state, id, liked);
      saved.likeSync = { pending: state.pending, onServer: state.onServer, localOnly: state.localOnly };
    }
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(saved));
  });
}

/** Gives `userId` back what was set aside when they last signed out on this phone. */
export function bringBackPersonalData(userId: string): Promise<void> {
  return inTurn(() => restore(userId));
}

async function restore(userId: string) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return;
    const saved = JSON.parse(raw) as Snapshot;
    // Anything done in the moment since signing in stays, in front of what was saved.
    useFavouritesStore.setState((s) => ({
      ids: [...s.ids, ...saved.likes.filter((id) => !s.ids.includes(id) && s.pending[id] !== false)],
      // What was tapped since signing in is newer than what was set aside.
      pending: { ...saved.likeSync?.pending, ...s.pending },
      onServer: s.onServer.length > 0 ? s.onServer : (saved.likeSync?.onServer ?? []),
      localOnly: [...new Set([...s.localOnly, ...(saved.likeSync?.localOnly ?? [])])],
    }));
    saved.events?.forEach((event) => useListeningStore.getState().add(event));
    useHistoryStore.setState((s) => ({ entries: [...s.entries, ...saved.history.filter((h) => !s.entries.some((e) => e.itemId === h.itemId))] }));
    useRecentSearchStore.setState((s) => ({ items: [...s.items, ...saved.searches.filter((r) => !s.items.some((i) => i.key === r.key))] }));
    if (!useResumeStore.getState().itemId && saved.resume.itemId) useResumeStore.setState(saved.resume);
    useScheduleStore.setState((s) => ({ byRelease: { ...saved.schedule, ...s.byRelease } }));
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    // Unreadable: leave it where it is rather than lose it.
  }
}

/** Throws away what was set aside, for an account that no longer exists. */
export function discardPersonalData(userId: string) {
  void inTurn(() => AsyncStorage.removeItem(keyFor(userId)));
}
