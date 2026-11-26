import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

/** Pages that open on top of a tab's own screen. They live inside the tab, so the tab bar and mini player stay. */
const DETAIL_PAGES = ['artist/[id]', 'album/[id]', 'track/[id]', 'podcast/[id]', 'playlist/[id]', 'more/[list]'];

/** What each screen is called, including in the list shown when the back button is held down. */
const TITLES: Record<string, string> = {
  index: 'Home',
  search: 'Search',
  library: 'Library',
  'artist/[id]': 'Artist',
  'album/[id]': 'Album',
  'track/[id]': 'Song',
  'podcast/[id]': 'Podcast',
  'playlist/[id]': 'Playlist',
};
const ARTWORK_PAGES = ['artist/[id]', 'album/[id]', 'track/[id]', 'playlist/[id]'];

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
        // Every screen needs a proper name: the header and the list under a held back button print the route's own name
        // ("album/[id]", "index") otherwise.
        title: route.name === 'more/[list]' ? ((route.params as { title?: string } | undefined)?.title ?? 'More') : (TITLES[route.name] ?? ''),
        // The pages with artwork draw their name themselves, so their header stays blank.
        ...(ARTWORK_PAGES.includes(route.name) ? { headerTitle: '' } : null),
      })}
    />
  );
}
