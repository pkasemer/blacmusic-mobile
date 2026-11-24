import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Appearance, FlatList, Platform, Pressable, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearImageCache, formatBytes, getCacheStats, type CacheStats } from '@/cache/imageCache';
import { formatCountdown, useSleepRemaining } from '@/audio/sleepTimer';
import { Avatar } from '@/components/Avatar';
import { ScreenHero } from '@/components/ScreenHero';
import { Card } from '@/components/Card';
import { DeleteAccountSheet } from '@/components/DeleteAccountSheet';
import { Chip } from '@/components/Chip';
import { Skeleton, SkeletonGroup, SettingsSectionSkeleton } from '@/components/Skeleton';
import { presetLabel } from '@/components/SleepTimerSheet';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { USES_BACKEND, authApi, type StreamQuality } from '@/api/blac';
import { studioApi } from '@/api/blac/studio';
import { queryClient } from '@/api/queryClient';
import { signOut, syncAccount } from '@/auth/session';
import { getNotificationPrefs, getPushStatus, openSystemSettings, registerPushToken, requestPush, setNotificationPrefs, unregisterPushToken, type NotificationPrefs, type PushStatus } from '@/notifications/push';
import { refreshStudio, usePullToRefresh } from '@/hooks/usePullToRefresh';
import { chooseAvatar } from '@/uploads/pickCover';
import { useArtistStore } from '@/store/artistStore';
import { useAuthStore } from '@/store/authStore';
import { useHistoryStore } from '@/store/historyStore';
import { useSettingsStore, type ThemeMode } from '@/store/settingsStore';
import { SLEEP_PRESETS, useSleepStore } from '@/store/sleepStore';
import { radius, useTheme } from '@/theme';
import { clearColorCache } from '@/utils/dominantColor';
import { haptics } from '@/utils/haptics';
import { openLegal } from '@/utils/legal';
import { topInset } from '@/utils/platform';

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'system', label: 'System', Icon: Monitor },
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="label" color="textTertiary" style={{ paddingHorizontal: 4 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
  last,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          onChange(next);
          haptics.select();
        }}
        // Light: deep-purple track with a white thumb (a white thumb on pale purple disappears).
        // Dark: purple track with a dark thumb, like the reference. Off is a neutral grey track.
        trackColor={{ false: colors.borderStrong, true: isDark ? colors.primary : colors.accent }}
        thumbColor={value && isDark ? colors.bg : '#FFFFFF'}
        ios_backgroundColor={colors.borderStrong}
      />
    </View>
  );
}

/**
 * Changes the theme in one step: the native colour scheme and the saved choice together, so the
 * picker, the page and the system bars all switch on the same frame instead of one after another.
 */
function applyThemeMode(mode: ThemeMode) {
  Appearance.setColorScheme(mode === 'system' ? 'auto' : mode);
  useSettingsStore.getState().setThemeMode(mode);
  haptics.select();
}

/** iOS: the system's own segmented control, which restyles itself for light and dark without flicker. */
function NativeThemePicker() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  return (
    <Host style={{ height: 40 }}>
      <Picker
        modifiers={[pickerStyle('segmented')]}
        label="Theme"
        selection={themeMode}
        onSelectionChange={(mode) => applyThemeMode(mode as ThemeMode)}
      >
        {THEME_OPTIONS.map(({ mode, label }) => (
          <SwiftText key={mode} modifiers={[tag(mode)]}>
            {label}
          </SwiftText>
        ))}
      </Picker>
    </Host>
  );
}

function ThemePicker() {
  const { colors } = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  if (Platform.OS === 'ios') return <NativeThemePicker />;

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {THEME_OPTIONS.map(({ mode, label, Icon }) => {
        const selected = themeMode === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => applyThemeMode(mode)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.sm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              backgroundColor: selected ? colors.surface : 'transparent',
              borderWidth: 1,
              borderColor: selected ? colors.border : 'transparent',
            }}
          >
            <Icon size={16} color={selected ? colors.accent : colors.textSecondary} />
            <Text variant="caption" color={selected ? 'accent' : 'textSecondary'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Builds a section a moment after the screen appears, showing a skeleton of it until then, so
 * switching to Settings paints instantly even though the sections are heavy.
 */
function Deferred({ placeholder, children }: { placeholder: ReactNode; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(timer);
  }, []);
  return ready ? children : placeholder;
}

function AppearanceSection() {
  return (
    <Section title="Appearance">
      <ThemePicker />
    </Section>
  );
}

function PlaybackSection() {
  const s = useSettingsStore();
  return (
    <Section title="Playback">
      <Card style={{ paddingHorizontal: 16 }}>
        <ToggleRow
          title="Play in background"
          description="Keep music playing when you leave the app or lock your phone."
          value={s.backgroundPlayback}
          onChange={s.setBackgroundPlayback}
          last={Platform.OS !== 'ios'}
        />
        {Platform.OS === 'ios' ? (
          <ToggleRow
            title="Play in silent mode"
            description="Keep audio on even when the ringer switch is muted."
            value={s.playInSilentMode}
            onChange={s.setPlayInSilentMode}
            last
          />
        ) : null}
      </Card>
    </Section>
  );
}

/** Sleep timer: pick a length to stop playback after, or cancel the running one. */
function SleepSection() {
  const { colors } = useTheme();
  const fade = useSettingsStore((s) => s.sleepFadeOut);
  const setFade = useSettingsStore((s) => s.setSleepFadeOut);
  const durationMin = useSleepStore((s) => s.durationMin);
  const start = useSleepStore((s) => s.start);
  const cancel = useSleepStore((s) => s.cancel);
  const remaining = useSleepRemaining();
  const active = remaining !== null;

  return (
    <Section title="Sleep timer">
      <Card style={{ paddingHorizontal: 16 }}>
        <View style={{ gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{active ? 'Timer running' : 'Stop playing after…'}</Text>
              <Text variant="caption" color="textSecondary">
                {active
                  ? `Playback stops in ${formatCountdown(remaining)}`
                  : 'Pick a length. You can also set it from the player.'}
              </Text>
            </View>
            {active ? (
              <Pressable
                onPress={() => {
                  haptics.warning();
                  cancel();
                }}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text variant="bodyStrong" color="danger">
                  Cancel
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SLEEP_PRESETS.map((minutes) => {
              const selected = active && durationMin === minutes;
              return (
                <Chip
                  key={minutes}
                  label={presetLabel(minutes)}
                  selected={selected}
                  onPress={() => (selected ? cancel() : start(minutes))}
                />
              );
            })}
          </View>
        </View>

        <ToggleRow
          title="Fade out"
          description="Lower the volume gradually over 10 seconds before playback stops."
          value={fade}
          onChange={setFade}
          last
        />
      </Card>
    </Section>
  );
}

function FeedbackSection() {
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  return (
    <Section title="Feedback">
      <Card style={{ paddingHorizontal: 16 }}>
        <ToggleRow
          title="Haptic feedback"
          description="Subtle vibrations for taps, playback changes and errors."
          value={hapticsEnabled}
          onChange={setHapticsEnabled}
          last
        />
      </Card>
    </Section>
  );
}

/**
 * Push notifications: tells you when a YouTube import finishes or a scheduled release goes live. Needs the phone's
 * permission (asked the first time you turn it on) and can be switched off here without changing that permission.
 */
function NotificationsSection() {
  const optOut = useSettingsStore((s) => s.pushOptOut);
  const setOptOut = useSettingsStore((s) => s.setPushOptOut);
  const [status, setStatus] = useState<PushStatus>('undetermined');
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  // The phone's permission can change in the system Settings, so read it again whenever this screen is shown.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getPushStatus().then((s) => {
        if (!cancelled) setStatus(s);
      });
      void getNotificationPrefs()
        .then((p) => {
          if (!cancelled) setPrefs(p);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const on = status === 'granted' && !optOut;

  /** Flips one kind at once on screen, then saves it; puts it back if the save fails. */
  const flip = (key: keyof NotificationPrefs, value: boolean) => {
    haptics.select();
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    setNotificationPrefs({ [key]: value }).catch(() => {
      setPrefs((p) => (p ? { ...p, [key]: !value } : p));
      haptics.error();
    });
  };

  const change = async (next: boolean) => {
    haptics.select();
    if (!next) {
      setOptOut(true);
      await unregisterPushToken();
      return;
    }
    let current = status;
    if (current === 'undetermined') {
      current = await requestPush();
      setStatus(current);
    }
    if (current !== 'granted') {
      Alert.alert('Notifications are off for Blac', 'Turn them on in your phone\'s Settings to hear about finished imports and new releases.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: openSystemSettings },
      ]);
      return;
    }
    setOptOut(false);
    await registerPushToken();
  };

  return (
    <Section title="Notifications">
      <Card style={{ paddingHorizontal: 16 }}>
        <ToggleRow
          title="Push notifications"
          description={
            status === 'denied'
              ? 'Blac is not allowed to send notifications. Turn the switch on to open your phone\'s Settings.'
              : 'Hear when a YouTube import finishes or a scheduled release goes live.'
          }
          value={on}
          onChange={(v) => void change(v)}
          last={!(on && prefs)}
        />
        {on && prefs ? (
          <>
            <ToggleRow title="YouTube imports" description="When an import finishes or needs attention." value={prefs.transfers} onChange={(v) => flip('transfers', v)} />
            <ToggleRow title="Releases going live" description="When a release you scheduled is published." value={prefs.releases} onChange={(v) => flip('releases', v)} last />
          </>
        ) : null}
      </Card>
    </Section>
  );
}

/**
 * The top of Settings: the purple wash, your profile picture (tap to change), your name and email, and buttons to
 * add, change or remove the picture. The same picture is your artist picture. Without an account (sample data) it
 * is just the title.
 */
function ProfileHero() {
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  /** The same picture is the profile picture and the artist picture, so re-read the artist profile and lists too. */
  const afterChange = async () => {
    await syncAccount();
    void queryClient.invalidateQueries();
  };

  const changePhoto = async () => {
    const file = await chooseAvatar();
    if (!file) return;
    setBusy(true);
    try {
      const imageId = await studioApi.uploadImage(file, 'avatar');
      await authApi.updateProfile({ avatarImageId: imageId });
      await afterChange();
      haptics.success();
    } catch (e) {
      haptics.error();
      Alert.alert("Couldn't change your photo", e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    haptics.warning();
    Alert.alert('Remove your profile picture?', 'It is also your artist picture, so it is removed there too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await authApi.updateProfile({ avatarImageId: '' });
            await afterChange();
          } catch (e) {
            haptics.error();
            Alert.alert("Couldn't remove it", e instanceof Error ? e.message : 'Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScreenHero
      label="Settings"
      title={user?.displayName ?? 'Settings'}
      subtitle={user?.email}
      leading={
        user ? (
          <Pressable onPress={changePhoto} disabled={busy} accessibilityRole="button" accessibilityLabel="Change profile picture">
            <Avatar url={user.avatarUrl} name={user.displayName ?? user.email} size={76} />
            {busy ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                }}
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>
        ) : undefined
      }
    >
      {user ? (
        <View style={{ gap: 8, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label={user.avatarUrl ? 'Change photo' : 'Add photo'} onPress={() => void changePhoto()} />
            {user.avatarUrl ? <Chip label="Remove" onPress={removePhoto} /> : null}
          </View>
          <Text variant="caption" color="textTertiary">
            This picture is also shown on your artist profile.
          </Text>
        </View>
      ) : null}
    </ScreenHero>
  );
}

/** The sign-out button. Only shown when the app uses the Blac backend. */
function AccountSection() {
  const [deleting, setDeleting] = useState(false);
  const confirmSignOut = () => {
    haptics.warning();
    Alert.alert(
      'Sign out?',
      'Your downloaded music is removed from this device when you sign out. You can download it again after signing in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };
  return (
    <Section title="Account">
      <Card style={{ paddingHorizontal: 16 }}>
        <Pressable onPress={confirmSignOut} accessibilityRole="button" style={{ paddingVertical: 15 }}>
          <Text variant="bodyStrong" color="danger">
            Sign out
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.select();
            setDeleting(true);
          }}
          accessibilityRole="button"
          style={{ paddingVertical: 15, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.25)' }}
        >
          <Text variant="body" color="textSecondary">
            Delete account
          </Text>
        </Pressable>
      </Card>
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />
    </Section>
  );
}

/** Links to the Privacy Policy and Terms of Service (served by the backend). */
function AboutSection() {
  return (
    <Section title="About">
      <Card style={{ paddingHorizontal: 16 }}>
        <Pressable onPress={() => openLegal('privacy')} accessibilityRole="link" style={{ paddingVertical: 15 }}>
          <Text variant="body">Privacy Policy</Text>
        </Pressable>
        <Pressable
          onPress={() => openLegal('terms')}
          accessibilityRole="link"
          style={{ paddingVertical: 15, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.25)' }}
        >
          <Text variant="body">Terms of Service</Text>
        </Pressable>
      </Card>
    </Section>
  );
}

const QUALITY_OPTIONS:{ value: StreamQuality; label: string }[] = [
  { value: 'low', label: 'Low data' },
  { value: 'medium', label: 'Standard' },
  { value: 'high', label: 'High' },
];

/** Music streaming quality. Takes effect for songs queued from now on. */
function QualitySection() {
  const quality = useSettingsStore((s) => s.streamQuality);
  const setQuality = useSettingsStore((s) => s.setStreamQuality);
  return (
    <Section title="Music quality">
      <Card style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUALITY_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={quality === o.value} onPress={() => setQuality(o.value)} />
          ))}
        </View>
        <Text variant="caption" color="textSecondary">
          Low data uses about 21 MB an hour, Standard about 58 MB and High about 115 MB.
        </Text>
      </Card>
    </Section>
  );
}

/** Become an artist, or jump to the Studio once you are one. */
function ArtistSection() {
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useArtistStore((s) => s.profile);
  return (
    <Section title="Artists">
      <Card style={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text variant="bodyStrong">{profile ? profile.name : 'Share your music on Blac'}</Text>
          <Text variant="caption" color="textSecondary">
            {profile
              ? profile.verification === 'verified'
                ? 'Verified artist'
                : 'Your artist profile is set up. Open the Studio to upload and manage your music.'
              : 'Create an artist profile to upload songs and podcasts. 10 GB of storage is free.'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            haptics.select();
            if (profile) router.navigate('/studio');
            else router.push('/become-artist');
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text variant="bodyStrong" color="onPrimary">
            {profile ? 'Open Studio' : 'Become an artist'}
          </Text>
        </Pressable>
      </Card>
    </Section>
  );
}

/** Image cache size and a clear button. Measured lazily: only when this section is on screen. */
function StorageSection() {
  const { colors } = useTheme();
  const [stats, setStats] = useState<CacheStats | null>(null);

  const refresh = useCallback(() => setStats(getCacheStats()), []);

  // Re-measure each time the Settings tab is focused, since other tabs keep filling the cache.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(refresh, 0);
      return () => clearTimeout(timer);
    }, [refresh]),
  );

  const confirmClear = () => {
    haptics.warning();
    Alert.alert('Clear image cache?', 'Cover art will be downloaded again the next time it is shown.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearImageCache();
          clearColorCache();
          refresh();
          haptics.success();
        },
      },
    ]);
  };

  const empty = stats !== null && stats.count === 0;

  return (
    <Section title="Storage">
      <Card style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">Image cache</Text>
            <Text variant="caption" color="textSecondary">
              Cover art is saved on this device, so it loads instantly and is not downloaded again.
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            {stats ? (
              <>
                <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatBytes(stats.bytes)}
                </Text>
                <Text variant="caption" color="textTertiary">
                  {stats.count} {stats.count === 1 ? 'image' : 'images'}
                </Text>
              </>
            ) : (
              // Still measuring the cache
              <SkeletonGroup label="Measuring cache" style={{ alignItems: 'flex-end', gap: 6 }}>
                <Skeleton width={58} height={18} />
                <Skeleton width={42} height={11} />
              </SkeletonGroup>
            )}
          </View>
        </View>
        <Pressable
          onPress={confirmClear}
          disabled={stats === null || empty}
          accessibilityRole="button"
          style={{ paddingVertical: 15, opacity: stats === null || empty ? 0.4 : 1 }}
        >
          <Text variant="bodyStrong" color="danger">
            Clear image cache
          </Text>
          <Text variant="caption" color="textSecondary">
            {empty ? 'Nothing to clear' : 'Frees up space; logos download again when needed'}
          </Text>
        </Pressable>
      </Card>
    </Section>
  );
}

function DataSection() {
  const historyCount = useHistoryStore((h) => h.entries.length);
  const clearHistory = useHistoryStore((h) => h.clear);

  const confirmClear = () => {
    haptics.warning();
    Alert.alert('Clear listening history?', 'This removes all songs and episodes from your recently played list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearHistory },
    ]);
  };

  return (
    <Section title="Data">
      <Card style={{ paddingHorizontal: 16 }}>
        <Pressable
          onPress={confirmClear}
          disabled={historyCount === 0}
          accessibilityRole="button"
          style={{ paddingVertical: 15, opacity: historyCount === 0 ? 0.4 : 1 }}
        >
          <Text variant="bodyStrong" color="danger">
            Clear listening history
          </Text>
          <Text variant="caption" color="textSecondary">
            {historyCount === 0
              ? 'Nothing to clear'
              : `${historyCount} ${historyCount === 1 ? 'item' : 'items'} in your history`}
          </Text>
        </Pressable>
      </Card>
    </Section>
  );
}

type SectionId =
  | 'account'
  | 'appearance'
  | 'playback'
  | 'quality'
  | 'artist'
  | 'sleep'
  | 'feedback'
  | 'notifications'
  | 'storage'
  | 'about'
  | 'data';

const SECTIONS: SectionId[] = [
  ...(USES_BACKEND ? (['account'] as const) : []),
  'appearance',
  'playback',
  'quality',
  'artist',
  'sleep',
  'feedback',
  ...(USES_BACKEND ? (['notifications'] as const) : []),
  'storage',
  'about',
  'data',
];

const SECTION_COMPONENTS: Record<SectionId, () => React.JSX.Element> = {
  account: AccountSection,
  appearance: AppearanceSection,
  playback: PlaybackSection,
  quality: QualitySection,
  artist: ArtistSection,
  sleep: SleepSection,
  feedback: FeedbackSection,
  notifications: NotificationsSection,
  storage: StorageSection,
  about: AboutSection,
  data: DataSection,
};

/** How many rows each section's skeleton shows (roughly the real section's height). */
const SKELETON_ROWS: Record<SectionId, number> = {
  account: 2,
  appearance: 1,
  quality: 1,
  playback: 2,
  artist: 1,
  sleep: 2,
  feedback: 1,
  notifications: 1,
  storage: 2,
  about: 2,
  data: 1,
};

function renderSection({ item }: { item: SectionId }) {
  const SectionComponent = SECTION_COMPONENTS[item];
  // The first two sections are on screen immediately; the rest build once the screen has settled.
  if (item === 'account' || item === 'appearance' || item === 'playback') return <SectionComponent />;
  return (
    <Deferred placeholder={<SettingsSectionSkeleton rows={SKELETON_ROWS[item]} />}>
      <SectionComponent />
    </Deferred>
  );
}

function SectionSeparator() {
  return <View style={{ height: 26 }} />;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const refreshControl = usePullToRefresh(() => (USES_BACKEND ? Promise.all([syncAccount(), refreshStudio()]) : Promise.resolve()));

  return (
    <TabScreen>
      <FlatList
        data={SECTIONS}
        keyExtractor={(id) => id}
        renderItem={renderSection}
        ItemSeparatorComponent={SectionSeparator}
        ListHeaderComponent={
          // The hero spans the full width, so it sits outside the 20 px side padding of the sections.
          <View style={{ marginHorizontal: -20, marginBottom: 26 }}>
            <ProfileHero />
          </View>
        }
        ListFooterComponent={
          <View style={{ alignItems: 'center', gap: 2, paddingTop: 26 }}>
            <Text variant="caption" color="textTertiary">
              Blac · v{Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: topInset(insets.top) + 12,
          paddingHorizontal: 20,
          paddingBottom: 28,
        }}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        // Lazy rendering: sections are built as they come near the screen, so the cache size is
        // only measured when the Storage section is actually reached.
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews
      />
    </TabScreen>
  );
}
