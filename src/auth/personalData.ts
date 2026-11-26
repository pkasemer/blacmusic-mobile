import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFavouritesStore } from '@/store/favouritesStore';
import { useHistoryStore, type HistoryEntry } from '@/store/historyStore';
import { useRecentSearchStore, type RecentOpen } from '@/store/recentSearchStore';
import { useResumeStore } from '@/store/resumeStore';
import { useScheduleStore } from '@/store/scheduleStore';

/**
 * What a person builds up that is kept on the phone only (the server has no copy): likes, listening history, recent
 * searches, where they stopped listening and the go-live times chosen for drafts. At sign out all of it leaves the
 * app, so the next person on this phone sees none of it, and it is set aside under the account it belongs to. It
 * comes back when that same account signs in again, and is thrown away when the account is deleted.
 */
interface Snapshot {
  likes: string[];
  history: HistoryEntry[];
  searches: RecentOpen[];
  resume: { itemId: string | null; positionSec: number; durationSec: number };
  schedule: Record<string, number>;
}

const keyFor = (userId: string) => `blac-personal:${userId}`;

/** Takes everything personal out of the app and sets it aside for `userId`. */
export function putAwayPersonalData(userId: string | undefined) {
  const { itemId, positionSec, durationSec } = useResumeStore.getState();
  const snapshot: Snapshot = {
    likes: useFavouritesStore.getState().ids,
    history: useHistoryStore.getState().entries,
    searches: useRecentSearchStore.getState().items,
    resume: { itemId, positionSec, durationSec },
    schedule: useScheduleStore.getState().byRelease,
  };
  useFavouritesStore.setState({ ids: [] });
  useHistoryStore.getState().clear();
  useRecentSearchStore.getState().clear();
  useResumeStore.getState().clear();
  useScheduleStore.setState({ byRelease: {} });
  if (userId) AsyncStorage.setItem(keyFor(userId), JSON.stringify(snapshot)).catch(() => {});
}

/** Gives `userId` back what was set aside when they last signed out on this phone. */
export async function bringBackPersonalData(userId: string) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return;
    const saved = JSON.parse(raw) as Snapshot;
    // Anything done in the moment since signing in stays, in front of what was saved.
    useFavouritesStore.setState((s) => ({ ids: [...s.ids, ...saved.likes.filter((id) => !s.ids.includes(id))] }));
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
  AsyncStorage.removeItem(keyFor(userId)).catch(() => {});
}
