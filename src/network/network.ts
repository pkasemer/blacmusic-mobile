import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Device connectivity, from `expo-network`, in one small store.
 *
 * `expo-network` has a native part. It is loaded lazily inside a try/catch, so an installed build
 * that does not include it yet keeps working: there are simply no network events, and playback falls
 * back to the supervisor's own retry loop.
 */
type NetworkModule = typeof import('expo-network');

let Network: NetworkModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Network = require('expo-network') as NetworkModule;
} catch {
  Network = null;
}

interface NetworkStore {
  /** `true` online, `false` offline, `null` until the first reading. */
  online: boolean | null;
  /** Connection kind, e.g. "WIFI" or "CELLULAR". Changes when you move between networks. */
  type: string | null;
  set: (state: { online: boolean; type: string | null }) => void;
}

export const useNetworkStore = create<NetworkStore>()((set) => ({
  online: null,
  type: null,
  set: ({ online, type }) =>
    set((current) => (current.online === online && current.type === type ? current : { online, type })),
}));

/** Reads a network event. Unknown reachability is treated as online; only an explicit `false` is offline. */
function toState(state: { type?: string; isConnected?: boolean; isInternetReachable?: boolean }) {
  return {
    online: state.isConnected !== false && state.isInternetReachable !== false,
    type: state.type ?? null,
  };
}

/** Asks the system right now. `true`/`false`, or `null` when this build can't tell. */
export async function readOnlineNow(): Promise<boolean | null> {
  if (!Network) return null;
  try {
    return toState(await Network.getNetworkStateAsync()).online;
  } catch {
    return null;
  }
}

/** Re-reads the connection into the store (e.g. when the app comes back to the foreground). */
export async function refreshNetwork() {
  if (!Network) return;
  try {
    useNetworkStore.getState().set(toState(await Network.getNetworkStateAsync()));
  } catch {
    // Keep the last known state.
  }
}

/** Starts listening for network changes. Returns the cleanup function. */
export function startNetworkWatcher(): () => void {
  if (!Network) return () => {};
  const { set } = useNetworkStore.getState();

  Network.getNetworkStateAsync()
    .then((state) => set(toState(state)))
    .catch(() => {});
  const subscription = Network.addNetworkStateListener((state) => set(toState(state)));
  return () => subscription.remove();
}

/** Mount once in the root layout. */
export function useNetworkWatcher() {
  useEffect(() => startNetworkWatcher(), []);
}
