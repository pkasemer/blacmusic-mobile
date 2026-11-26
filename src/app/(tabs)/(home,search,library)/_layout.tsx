import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

/** Pages that open on top of a tab's own screen. They live inside the tab, so the tab bar and mini player stay. */
const DETAIL_PAGES = ['artist/[id]', 'album/[id]', 'track/[id]', 'podcast/[id]', 'playlist/[id]', 'more/[list]'];

/**
 * One navigation stack per tab (Home, Search, Library). The artist, album, track and podcast pages are shared:
 * this file is used by all three tabs, and each stack starts on its own main screen (`index`, `search` or
 * `library`), because fixed screens come before `[id]` pages. Pushing a page here keeps the native tab bar and
 * the mini player visible under it.
 */
export default function TabStackLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Stack
      screenOptions={({ route }) => ({
        // Home, Search and Library draw their own titles; only the detail pages have a navigation header
        // (a back button over their colour).
        headerShown: DETAIL_PAGES.includes(route.name),
        // Just the back arrow, with no "Back" or previous-screen text next to it.
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
        // The native header draws with the system's light colours unless told otherwise.
        headerUserInterfaceStyle: isDark ? 'dark' : 'light',
        ...(route.name === 'podcast/[id]' ? { title: 'Podcast' } : null),
      })}
    />
  );
}
