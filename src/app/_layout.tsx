import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient, subscribeAppFocus } from '@/api/queryClient';
import { useNetworkWatcher } from '@/network/network';
import { reconcileDownloads } from '@/offline/downloads';
import { useSleepTimerEngine } from '@/audio/sleepTimer';
import { useAudioMode } from '@/audio/useAudioMode';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { BrandBackground } from '@/components/BrandBackdrop';
import { Toast } from '@/components/Toast';
import { useNotifications } from '@/notifications/useNotifications';
import { useReportPlays } from '@/stats/useReportPlays';
import { useSaveProgress } from '@/audio/music/useSaveProgress';
import { useRemoveGone } from '@/offline/removeGone';
import { useArtistWatch } from '@/studio/useArtistWatch';
import { MusicFullPlayer } from '@/components/MusicFullPlayer';
import { USES_BACKEND } from '@/api/blac';
import { REQUIRE_EMAIL_CODE } from '@/api/blac/config';
import { useSessionSync } from '@/auth/session';
import { useArtistStore } from '@/store/artistStore';
import { useAuthStore } from '@/store/authStore';
import { useDownloadStore } from '@/store/downloadStore';
import { useFavouritesStore } from '@/store/favouritesStore';
import { useHistoryStore, useRecordListeningHistory } from '@/store/historyStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { applyScheme } from '@/theme/scheme';
import { fontSources } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** True once both persisted Zustand stores have been read from AsyncStorage. */
const persistedStores = [useSettingsStore, useHistoryStore, useFavouritesStore, useDownloadStore, useArtistStore, useAuthStore];

function useStoresHydrated() {
  const allHydrated = () => persistedStores.every((store) => store.persist.hasHydrated());
  const [hydrated, setHydrated] = useState(allHydrated);
  useEffect(() => {
    const check = () => setHydrated(allHydrated());
    const unsubs = persistedStores.map((store) => store.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, []);
  return hydrated;
}

function AppShell() {
  const { colors, isDark } = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);

  // With the real backend the app needs an account; with the sample data it opens straight away.
  const hasSession = useAuthStore((s) => s.refreshToken !== null);
  const signedIn = !USES_BACKEND || hasSession;
  // An account made with an email and password must confirm the email (6 digit code) before the app opens.
  const needsCode = useAuthStore((s) => REQUIRE_EMAIL_CODE && s.refreshToken !== null && s.user?.emailVerified === false);
  const inApp = signedIn && !needsCode;
  // The navigator paints its own background from this theme (light grey in light mode). Before sign-in it must be
  // see-through, or it covers the brand backdrop drawn behind it.
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = useMemo(
    () => (inApp ? base : { ...base, colors: { ...base.colors, background: 'transparent', card: 'transparent' } }),
    [base, inApp],
  );

  // Signing out always lands on the Get started screen, whatever the navigator would have picked on its own.
  const router = useRouter();
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (wasSignedIn.current && !signedIn) router.replace('/welcome');
    wasSignedIn.current = signedIn;
  }, [signedIn, router]);

  useSessionSync();
  useNotifications(USES_BACKEND && hasSession && !needsCode);
  useReportPlays(USES_BACKEND && hasSession && !needsCode);
  useSaveProgress();
  // Take off the phone what is no longer on Blac (a banned artist's downloads, recent searches, queued songs).
  useRemoveGone(USES_BACKEND && hasSession && !needsCode);
  // Keep up with the artist profile: suspended, given or taken away. None of these signs anyone out.
  useArtistWatch(USES_BACKEND && hasSession && !needsCode);
  useNetworkWatcher();
  useAudioMode();
  useSleepTimerEngine();
  useRecordListeningHistory();
  useEffect(subscribeAppFocus, []);
  // Downloads cut short by the app closing cannot resume: mark them failed so they can be retried.
  useEffect(() => reconcileDownloads(), []);

  // Drive the native color scheme so system UI (status bar, sheets, dialogs) matches the choice.
  useEffect(() => {
    applyScheme(themeMode);
  }, [themeMode]);

  return (
    <>
      {/* While nobody is in the app, the brand backdrop is drawn once behind every screen (they are transparent). */}
      <ThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: inApp ? colors.bg : '#000000' }}>
      {inApp ? null : <BrandBackground />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: inApp ? colors.bg : 'transparent' } }}>
        {/* Signed out: only the welcome, tour and sign-in screens exist. The app opens as soon as tokens are saved. */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        {/* Signed in but the email is not confirmed yet: only the code screen. */}
        <Stack.Protected guard={signedIn && needsCode}>
          <Stack.Screen name="verify-code" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="become-artist" options={{ presentation: 'modal' }} />
          <Stack.Screen name="verify-email" options={{ presentation: 'modal' }} />
          <Stack.Screen name="release/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="release/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="release/add-audio" options={{ presentation: 'modal' }} />
          <Stack.Screen name="release/lyrics" options={{ presentation: 'modal' }} />
          <Stack.Screen name="release/credits" options={{ presentation: 'modal' }} />
          <Stack.Screen name="youtube" options={{ presentation: 'modal' }} />
          <Stack.Screen name="release/[id]" options={{ headerShown: true, title: 'Release', headerBackButtonDisplayMode: 'minimal' }} />
          <Stack.Screen name="insights" options={{ headerShown: true, title: 'Insights', headerBackButtonDisplayMode: 'minimal' }} />
        </Stack.Protected>
      </Stack>
      </View>
      </ThemeProvider>
      <MusicFullPlayer />
      <Toast />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  // SF Pro Display + Rounded from assets/fonts (a missing file falls back to the system font).
  const [fontsLoaded] = useFonts(fontSources);
  const hydrated = useStoresHydrated();
  const ready = fontsLoaded && hydrated;

  // The animated splash is on screen from the first frame; the native splash (same logo, same spot)
  // is hidden as soon as it has been laid out, so the hand-off is seamless.
  const hideNativeSplash = () => SplashScreen.hideAsync().catch(() => {});

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>{ready ? <AppShell /> : null}</QueryClientProvider>
      </SafeAreaProvider>
      <AnimatedSplash ready={ready} fontsLoaded={fontsLoaded} onShown={hideNativeSplash} />
    </GestureHandlerRootView>
  );
}
