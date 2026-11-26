import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldAlert, X } from 'lucide-react-native';
import { useYouTubeConnection } from '@/api/blac/youtubeQueries';
import { useIsArtist, useStudioSuspended } from '@/store/artistStore';
import { refreshArtist } from '@/studio/refreshArtist';
import { useDisconnectYouTube } from '@/studio/useDisconnectYouTube';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { SettingsGroup, SettingsRow, useGroupedColors } from './SettingsList';
import { Text } from './Text';

/** What the Studio shows instead of its tools while the artist profile is suspended. */
export function SuspendedStudio() {
  const { colors } = useTheme();
  const youtube = useYouTubeConnection();
  const disconnect = useDisconnectYouTube();
  const [checking, setChecking] = useState(false);

  const checkAgain = async () => {
    haptics.select();
    setChecking(true);
    // If the suspension has been lifted, the Studio comes back by itself.
    await refreshArtist();
    setChecking(false);
  };

  return (
    <View style={{ gap: 24 }}>
      <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingTop: 12 }}>
        <View style={{ width: 72, height: 72, borderRadius: 18, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
          <ShieldAlert size={34} color={colors.text} strokeWidth={1.8} />
        </View>
        <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Your artist profile is suspended
        </Text>
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          The Studio is turned off, so you can&apos;t upload, edit or publish. Listeners can&apos;t see your artist page or your releases.
        </Text>
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          Your account still works. You can listen, use your library and playlists, follow artists and manage your account.
        </Text>
      </View>

      <SettingsGroup footer="If you think this is a mistake, contact the Blac team.">
        <SettingsRow
          key="check"
          title="Check again"
          center
          onPress={() => void checkAgain()}
          disabled={checking}
          right={checking ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
        />
        {youtube.data?.connected ? (
          <SettingsRow
            key="youtube"
            title="Disconnect YouTube"
            destructive
            center
            onPress={disconnect.confirm}
            disabled={disconnect.busy}
            right={disconnect.busy ? <ActivityIndicator size="small" color={colors.danger} /> : undefined}
          />
        ) : null}
      </SettingsGroup>
    </View>
  );
}

/** What an open Studio screen shows when the artist profile has just been taken off this account. */
function NoLongerArtist() {
  return (
    <View style={{ gap: 12, paddingHorizontal: 32, paddingTop: 24, alignItems: 'center' }}>
      <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
        No artist profile
      </Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        Your account no longer has an artist profile, so this part of the Studio is closed. The rest of your account works as before.
      </Text>
    </View>
  );
}

/** A notice as a whole screen. A modal has no header of its own here, so it gets a close button. */
function NoticeScreen({ modal, children }: { modal: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  const g = useGroupedColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <ScrollView
      style={{ backgroundColor: g.page }}
      // Under a native header, let iOS start the content below it.
      contentInsetAdjustmentBehavior={modal ? 'never' : 'automatic'}
      // An iOS sheet already starts below the status bar.
      contentContainerStyle={{ paddingTop: modal && Platform.OS !== 'ios' ? insets.top + 12 : 12, paddingBottom: insets.bottom + 40, gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      {modal ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ alignSelf: 'flex-end', paddingHorizontal: 20, paddingTop: 4 }}
        >
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      ) : null}
      {children}
    </ScrollView>
  );
}

/**
 * Wraps a Studio screen: while the artist is suspended, or once the artist is taken off the account, it shows a notice
 * instead, even if the screen was already open. Opening the screen also asks the server again.
 */
export function StudioGuard({ children, modal = false }: { children: React.ReactNode; modal?: boolean }) {
  const suspended = useStudioSuspended();
  const isArtist = useIsArtist();
  // Some import screens may be opened without a profile (they offer to create one), so only losing it counts.
  const [openedAsArtist] = useState(isArtist);
  useEffect(() => void refreshArtist(), []);

  if (!suspended && !(openedAsArtist && !isArtist)) return children;
  return <NoticeScreen modal={modal}>{suspended ? <SuspendedStudio /> : <NoLongerArtist />}</NoticeScreen>;
}

/** `export default withStudioGuard(Screen)` */
export function withStudioGuard<P extends object>(Screen: ComponentType<P>, options: { modal?: boolean } = {}) {
  return function GuardedStudioScreen(props: P) {
    return (
      <StudioGuard modal={options.modal}>
        <Screen {...props} />
      </StudioGuard>
    );
  };
}
