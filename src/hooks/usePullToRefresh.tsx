import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { queryClient } from '@/api/queryClient';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

/** Re-fetches every music list (Home shelves, search, podcasts, saved items) from the server. */
export const refreshMusic = () => queryClient.refetchQueries({ queryKey: ['music'] });

/** Re-fetches the artist's Studio lists, quota and profile. */
export const refreshStudio = () => queryClient.refetchQueries({ queryKey: ['studio'] });

const MIN_SPIN_MS = 450;

/**
 * Pull-to-refresh for a scroll view: `<FlatList refreshControl={usePullToRefresh(load)} />`.
 * The spinner stays until `load` finishes (and at least a moment, so quick refreshes do not flicker).
 * A failed refresh just stops the spinner; each screen already shows its own error state.
 */
export function usePullToRefresh(load: () => Promise<unknown>) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    haptics.light();
    setRefreshing(true);
    try {
      await Promise.all([load(), new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS))]);
    } catch {
      // keep what is on screen
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />;
}
