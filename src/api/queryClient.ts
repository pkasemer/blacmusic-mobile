import { AppState, Platform } from 'react-native';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { useNetworkStore } from '@/network/network';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnReconnect: true,
    },
  },
});

// Pause queries while offline and refetch stale ones when the connection comes back.
onlineManager.setEventListener((setOnline) =>
  useNetworkStore.subscribe((state) => setOnline(state.online !== false)),
);

/** Let TanStack Query know when the app returns to the foreground. */
export function subscribeAppFocus() {
  if (Platform.OS === 'web') return () => {};
  const sub = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
  return () => sub.remove();
}
