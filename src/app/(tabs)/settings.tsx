import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, FileText, HardDrive, History, Info, Mail, Mic, Moon, MoonStar, ShieldCheck, SlidersHorizontal, Smartphone, Sun, Timer, Volume2, VolumeX, Waves, type LucideIcon, Image as ImageIcon, Music, Upload } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearImageCache, formatBytes, getCacheStats, type CacheStats } from '@/cache/imageCache';
import { formatCountdown, useSleepRemaining } from '@/audio/sleepTimer';
import { Avatar } from '@/components/Avatar';
import { DeleteAccountSheet } from '@/components/DeleteAccountSheet';
import { presetLabel } from '@/components/SleepTimerSheet';
import { SettingsGroup, SettingsRow, SettingsSwitchRow, chooseOne, useGroupedColors } from '@/components/SettingsList';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { USES_BACKEND, authApi, type StreamQuality } from '@/api/blac';
import { studioApi } from '@/api/blac/studio';
import { queryClient } from '@/api/queryClient';
import { signOut, syncAccount } from '@/auth/session';
import {
  getNotificationPrefs,
  getPushStatus,
  openSystemSettings,
  registerPushToken,
  requestPush,
  setNotificationPrefs,
  unregisterPushToken,
  type NotificationPrefs,
  type PushStatus,
} from '@/notifications/push';
import { refreshStudio, usePullToRefresh } from '@/hooks/usePullToRefresh';
import { chooseAvatar } from '@/uploads/pickCover';
import { useArtistStore } from '@/store/artistStore';
import { refreshArtist } from '@/studio/refreshArtist';
import { useAuthStore } from '@/store/authStore';
import { useHistoryStore } from '@/store/historyStore';
import { useSettingsStore, type ThemeMode } from '@/store/settingsStore';
import { SLEEP_PRESETS, useSleepStore } from '@/store/sleepStore';
import { clearPreloads } from '@/audio/music/preload';
import { clearUploadLeftovers, getPreloadStats, getUploadLeftoverStats } from '@/cache/otherCaches';
import { useUploadStore } from '@/store/uploadStore';
import { useTheme } from '@/theme';
import { applyScheme } from '@/theme/scheme';
import { clearColorCache } from '@/utils/dominantColor';
import { haptics } from '@/utils/haptics';
import { openLegal } from '@/utils/legal';
import { topInset } from '@/utils/platform';

const THEME_LABEL: Record<ThemeMode, string> = { system: 'Automatic', light: 'Light', dark: 'Dark' };

const QUALITY_LABEL: Record<StreamQuality, string> = { low: 'Low data', medium: 'Standard', high: 'High' };

/** Changes the theme in one step: the colour scheme and the saved choice together, so everything switches on one frame. */
function applyThemeMode(mode: ThemeMode) {
  applyScheme(mode);
  useSettingsStore.getState().setThemeMode(mode);
  haptics.select();
}

/** The big "Settings" title, like the iPhone's own Settings app. */
function LargeTitle() {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
      <Text variant="display" accessibilityRole="header">
        Settings
      </Text>
    </View>
  );
}

/** Your picture, name and email. Tap for the photo choices. The same picture is your artist picture. */
function ProfileCard() {
  const user = useAuthStore((s) => s.user);
  const { isDark } = useTheme();
  const g = useGroupedColors();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

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

  const removePhoto = async () => {
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
  };

  const openChoices = () => {
    haptics.select();
    chooseOne<'change' | 'remove'>({
      title: 'Profile picture',
      message: 'It is also shown on your artist profile.',
      options: [
        { value: 'change', label: user.avatarUrl ? 'Choose a new photo' : 'Choose a photo' },
        ...(user.avatarUrl ? [{ value: 'remove' as const, label: 'Remove photo', destructive: true }] : []),
      ],
      isDark,
      onSelect: (choice) => {
        if (choice === 'change') void changePhoto();
        else {
          haptics.warning();
          void removePhoto();
        }
      },
    });
  };

  return (
    <View style={{ marginHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: g.cell }}>
      <Pressable
        onPress={openChoices}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${user.displayName ?? user.email}. Change profile picture`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: pressed ? g.pressed : 'transparent' })}
      >
        <View>
          <Avatar url={user.avatarUrl} name={user.displayName ?? user.email} size={64} />
          {busy ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {user.displayName ?? 'Your account'}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {user.email}
          </Text>
          <Text variant="caption" color="accent">
            {user.avatarUrl ? 'Change photo' : 'Add photo'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

/** Studio for artists, an invitation for everyone else. */
function ArtistGroup() {
  const router = useRouter();
  const profile = useArtistStore((s) => s.profile);
  // The team can give or take away an artist profile, so ask again each time this screen is shown.
  useFocusEffect(
    useCallback(() => {
      void refreshArtist();
    }, []),
  );
  return (
    <SettingsGroup footer={profile ? undefined : 'Create an artist profile to upload songs and podcasts. 10 GB of storage is free.'}>
      <SettingsRow
        icon={{ Icon: Mic }}
        title={profile ? 'Studio' : 'Become an artist'}
        value={profile ? (profile.suspended ? 'Suspended' : profile.verification === 'verified' ? 'Verified' : profile.name) : undefined}
        chevron
        onPress={() => {
          haptics.select();
          if (profile) router.navigate('/studio');
          else router.push('/become-artist');
        }}
      />
    </SettingsGroup>
  );
}

/** What the listener likes to hear, changeable after onboarding. */
function TasteGroup() {
  const router = useRouter();
  return (
    <SettingsGroup footer="Languages, regions, genres and favourite artists.">
      <SettingsRow
        icon={{ Icon: SlidersHorizontal }}
        title="Music preferences"
        chevron
        onPress={() => {
          haptics.select();
          router.push('/music-preferences');
        }}
      />
    </SettingsGroup>
  );
}

/** Music quality, sleep timer, and the playback switches. */
function PlaybackGroup() {
  const { isDark } = useTheme();
  const s = useSettingsStore();
  const durationMin = useSleepStore((st) => st.durationMin);
  const start = useSleepStore((st) => st.start);
  const cancel = useSleepStore((st) => st.cancel);
  const remaining = useSleepRemaining();
  const active = remaining !== null;

  const pickQuality = () =>
    chooseOne<StreamQuality>({
      title: 'Music quality',
      message: 'Low data uses about 21 MB an hour, Standard about 58 MB and High about 115 MB. It applies to songs you play from now on.',
      options: (Object.keys(QUALITY_LABEL) as StreamQuality[]).map((value) => ({ value, label: QUALITY_LABEL[value] })),
      current: s.streamQuality,
      isDark,
      onSelect: s.setStreamQuality,
    });

  const pickSleep = () =>
    chooseOne<number>({
      title: 'Sleep timer',
      message: active ? `Playback stops in ${formatCountdown(remaining)}.` : 'Stop playing after…',
      options: [
        ...SLEEP_PRESETS.map((minutes) => ({ value: minutes, label: presetLabel(minutes) })),
        ...(active ? [{ value: 0, label: 'Turn off timer', destructive: true }] : []),
      ],
      current: active ? durationMin : null,
      isDark,
      onSelect: (minutes) => (minutes === 0 ? cancel() : start(minutes)),
    });

  return (
    <>
      <SettingsGroup title="Playback">
        <SettingsRow icon={{ Icon: Waves }} title="Music quality" value={QUALITY_LABEL[s.streamQuality]} chevron onPress={pickQuality} />
        <SettingsRow
          icon={{ Icon: Timer }}
          title="Sleep timer"
          value={active ? formatCountdown(remaining) : 'Off'}
          chevron
          onPress={pickSleep}
        />
        <SettingsSwitchRow icon={{ Icon: MoonStar }} title="Fade out at the end" subtitle="Lower the volume over 10 seconds before the sleep timer stops playback." value={s.sleepFadeOut} onChange={s.setSleepFadeOut} />
      </SettingsGroup>
      <SettingsGroup footer="Keep music going when you leave the app or lock your phone.">
        <SettingsSwitchRow icon={{ Icon: Volume2 }} title="Play in background" value={s.backgroundPlayback} onChange={s.setBackgroundPlayback} />
        {Platform.OS === 'ios' ? (
          <SettingsSwitchRow icon={{ Icon: VolumeX }} title="Play in silent mode" subtitle="Keep audio on when the ringer switch is muted." value={s.playInSilentMode} onChange={s.setPlayInSilentMode} />
        ) : null}
      </SettingsGroup>
    </>
  );
}

/** Appearance and haptics. */
function DisplayGroup() {
  const { isDark } = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const ThemeIcon: LucideIcon = isDark ? Moon : Sun;

  return (
    <SettingsGroup title="Display">
      <SettingsRow
        icon={{ Icon: ThemeIcon }}
        title="Appearance"
        value={THEME_LABEL[themeMode]}
        chevron
        onPress={() =>
          chooseOne<ThemeMode>({
            title: 'Appearance',
            message: 'Automatic follows your phone: light by day, dark by night if you use that setting.',
            options: (['system', 'light', 'dark'] as ThemeMode[]).map((mode) => ({ value: mode, label: THEME_LABEL[mode] })),
            current: themeMode,
            isDark,
            onSelect: applyThemeMode,
          })
        }
      />
      <SettingsSwitchRow icon={{ Icon: Smartphone }} title="Haptic feedback" subtitle="Subtle vibrations for taps, playback changes and errors." value={hapticsEnabled} onChange={setHapticsEnabled} />
    </SettingsGroup>
  );
}

/**
 * Push notifications and the release emails. Push needs the phone's permission (asked the first time you turn it
 * on) and can be switched off here without changing that permission; emails are separate.
 */
function NotificationsGroup() {
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
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    setNotificationPrefs({ [key]: value }).catch(() => {
      setPrefs((p) => (p ? { ...p, [key]: !value } : p));
      haptics.error();
    });
  };

  const change = async (next: boolean) => {
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
      Alert.alert('Notifications are off for Blac', "Turn them on in your phone's Settings to hear about finished imports and new releases.", [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: openSystemSettings },
      ]);
      return;
    }
    setOptOut(false);
    await registerPushToken();
  };

  return (
    <SettingsGroup
      title="Notifications"
      footer={
        status === 'denied'
          ? "Blac isn't allowed to send notifications. Switch it on to open your phone's Settings."
          : 'Hear when an import finishes, your audio is ready or a scheduled release goes live.'
      }
    >
      <SettingsSwitchRow icon={{ Icon: Bell }} title="Push notifications" value={on} onChange={(v) => void change(v)} />
      {on && prefs ? <SettingsSwitchRow title="Imports" value={prefs.transfers} onChange={(v) => flip('transfers', v)} /> : null}
      {on && prefs ? <SettingsSwitchRow title="Releases" value={prefs.releases} onChange={(v) => flip('releases', v)} /> : null}
      {prefs ? <SettingsSwitchRow icon={{ Icon: Mail }} title="Release emails" subtitle="When your audio is ready, when a release is verified or needs changes, and when it goes live." value={prefs.releaseEmails} onChange={(v) => flip('releaseEmails', v)} /> : null}
    </SettingsGroup>
  );
}

/** Image cache and listening history. */
function StorageGroup() {
  const historyCount = useHistoryStore((h) => h.entries.length);
  const clearHistory = useHistoryStore((h) => h.clear);
  // A file picked for upload must stay until it has been sent (or the artist gives up on it).
  const uploading = useUploadStore((u) => Object.values(u.jobs).some((job) => job.state !== 'ready' && job.state !== 'processing'));
  const [stats, setStats] = useState<{ images: CacheStats; songs: CacheStats; uploads: CacheStats } | null>(null);
  const refresh = useCallback(() => setStats({ images: getCacheStats(), songs: getPreloadStats(), uploads: getUploadLeftoverStats() }), []);

  // Re-measure each time the Settings tab is focused, since other tabs keep filling the caches.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(refresh, 0);
      return () => clearTimeout(timer);
    }, [refresh]),
  );

  const size = (cache: CacheStats | undefined) => (cache === undefined ? '…' : cache.count === 0 ? 'Empty' : formatBytes(cache.bytes));
  const clearImages = () => {
    clearImageCache();
    clearColorCache();
  };
  const clearAll = () => {
    clearImages();
    clearPreloads();
    if (!uploading) clearUploadLeftovers();
  };
  const ask = (title: string, message: string, clear: () => void) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clear();
          refresh();
          haptics.success();
        },
      },
    ]);

  const all = stats ? [stats.images, stats.songs, stats.uploads] : [];
  const total = stats ? { bytes: all.reduce((n, c) => n + c.bytes, 0), count: all.reduce((n, c) => n + c.count, 0) } : undefined;

  return (
    <SettingsGroup title="Storage" footer="These are temporary copies, made again when needed. Clearing them does not remove your downloads, likes or playlists.">
      <SettingsRow
        icon={{ Icon: ImageIcon }}
        title="Image cache"
        value={size(stats?.images)}
        disabled={!stats?.images.count}
        onPress={() => ask('Clear image cache?', 'Cover art will be downloaded again the next time it is shown.', clearImages)}
      />
      <SettingsRow
        icon={{ Icon: Music }}
        title="Preloaded songs"
        value={size(stats?.songs)}
        disabled={!stats?.songs.count}
        onPress={() => ask('Clear preloaded songs?', 'Songs saved ahead for smoother playback will be loaded again when needed.', () => clearPreloads())}
      />
      <SettingsRow
        icon={{ Icon: Upload }}
        title="Upload files"
        value={uploading ? 'In use' : size(stats?.uploads)}
        disabled={uploading || !stats?.uploads.count}
        onPress={() => ask('Clear upload files?', 'These are copies of files you chose to upload. Your original files are not touched.', clearUploadLeftovers)}
      />
      <SettingsRow
        icon={{ Icon: HardDrive }}
        title="Clear all cache"
        value={size(total)}
        disabled={!total?.count}
        onPress={() => ask('Clear all cache?', 'Cover art, preloaded songs and upload copies are removed. Downloads stay.', clearAll)}
      />
      <SettingsRow
        icon={{ Icon: History }}
        title="Clear listening history"
        value={historyCount === 0 ? 'Empty' : `${historyCount}`}
        disabled={historyCount === 0}
        onPress={() => {
          haptics.warning();
          Alert.alert('Clear listening history?', 'This removes all songs and episodes from your recently played list.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: clearHistory },
          ]);
        }}
      />
    </SettingsGroup>
  );
}

function AboutGroup() {
  return (
    <SettingsGroup title="About">
      <SettingsRow icon={{ Icon: ShieldCheck }} title="Privacy Policy" chevron onPress={() => openLegal('privacy')} />
      <SettingsRow icon={{ Icon: FileText }} title="Terms of Service" chevron onPress={() => openLegal('terms')} />
      <SettingsRow icon={{ Icon: Info }} title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
    </SettingsGroup>
  );
}

/** Sign out and delete account, at the very bottom like the iPhone's own Settings. */
function AccountGroup() {
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <SettingsGroup>
        <SettingsRow
          title="Sign out"
          destructive
          center
          onPress={() => {
            haptics.warning();
            Alert.alert('Sign out?', 'Your downloaded music is removed from this device when you sign out. You can download it again after signing in.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ]);
          }}
        />
        <SettingsRow
          title="Delete account"
          destructive
          center
          onPress={() => {
            haptics.select();
            setDeleting(true);
          }}
        />
      </SettingsGroup>
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />
    </>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGroupedColors();
  const refreshControl = usePullToRefresh(() => (USES_BACKEND ? Promise.all([syncAccount(), refreshStudio()]) : Promise.resolve()));

  return (
    <TabScreen>
      <ScrollView
        style={{ backgroundColor: g.page }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: topInset(insets.top) + 12, paddingBottom: 40, gap: 28 }}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 0 }}>
          <LargeTitle />
          {USES_BACKEND ? <ProfileCard /> : null}
        </View>
        {USES_BACKEND ? <ArtistGroup /> : null}
        {USES_BACKEND ? <TasteGroup /> : null}
        <PlaybackGroup />
        <DisplayGroup />
        {USES_BACKEND ? <NotificationsGroup /> : null}
        <StorageGroup />
        <AboutGroup />
        {USES_BACKEND ? <AccountGroup /> : null}
        <Text variant="caption" color="textTertiary" style={{ textAlign: 'center' }}>
          Blac Music
        </Text>
      </ScrollView>
    </TabScreen>
  );
}
