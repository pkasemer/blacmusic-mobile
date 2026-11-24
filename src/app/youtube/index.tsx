import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpenCheck, ChevronRight, CirclePlay, ListPlus, Music2, Upload } from 'lucide-react-native';
import { USES_BACKEND } from '@/api/blac';
import { YOUTUBE_REDIRECT, youtubeApi } from '@/api/blac/youtube';
import { youtubeErrorText, youtubeKeys, useYouTubeConnection } from '@/api/blac/youtubeQueries';
import { queryClient } from '@/api/queryClient';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/FormField';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { useArtistStore } from '@/store/artistStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

/** What the backend tells us when Google sign-in did not work, as a sentence. */
function reasonText(reason: string): string {
  switch (reason) {
    case 'access_denied':
      return "You didn't allow access, so nothing was connected. You can try again whenever you like.";
    case 'missing_permission':
      return 'Blac needs permission to read your channel. Tick the YouTube permission on the Google screen and try again.';
    case 'no_channel':
      return "That Google account doesn't have a YouTube channel. Choose the account your music is on.";
    case 'state_expired':
      return 'That took too long and the sign-in expired. Please try again.';
    case 'unavailable':
      return "YouTube import isn't switched on yet. It will be available soon.";
    default:
      return "Google couldn't finish connecting. Please try again.";
  }
}

function Point({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {text}
        </Text>
      </View>
    </View>
  );
}

/** Step 1: connect (or disconnect) the artist's YouTube channel. */
export default function YouTubeConnectScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useArtistStore((s) => s.profile);
  const connection = useYouTubeConnection();
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = connection.data;

  const refreshConnection = async () => {
    void queryClient.invalidateQueries({ queryKey: youtubeKeys.videos });
    await connection.refetch();
  };

  const connect = async () => {
    haptics.select();
    setBusy('connect');
    setNotice(null);
    try {
      const { authUrl } = await youtubeApi.startConnect();
      // With the sample data there is no Google page to show.
      if (USES_BACKEND) {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, YOUTUBE_REDIRECT);
        if (result.type === 'success') {
          const query = Linking.parse(result.url).queryParams;
          if (query?.status === 'error') setNotice(reasonText(String(query.reason ?? '')));
        }
      }
      // Whatever happened in the browser, the server knows the truth.
      await refreshConnection();
    } catch (e) {
      setNotice(youtubeErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmDisconnect = () => {
    haptics.warning();
    Alert.alert(
      'Disconnect YouTube?',
      "Blac stops having access to your channel and forgets what it read. Songs you already imported stay on Blac. An unfinished transfer is cancelled.",
      [
        { text: 'Keep connected', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setBusy('disconnect');
            try {
              await youtubeApi.disconnect();
              void queryClient.invalidateQueries({ queryKey: youtubeKeys.transfers });
              await refreshConnection();
            } catch (e) {
              Alert.alert("Couldn't disconnect", youtubeErrorText(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  // Importing songs needs an artist profile to put them under.
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="empty"
          title="Create your artist profile first"
          message="Imported songs are added to your artist profile."
          actionLabel="Become an artist"
          onAction={() => router.replace('/become-artist')}
        />
      </View>
    );
  }

  if (connection.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (connection.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title="Can't reach YouTube import"
          message={youtubeErrorText(connection.error)}
          actionLabel="Try again"
          onAction={() => void connection.refetch()}
        />
        {/* YouTube being unavailable does not stop songs added by hand */}
        <Pressable onPress={() => router.push('/youtube/manual')} accessibilityRole="button" style={{ alignItems: 'center', padding: 16, paddingBottom: insets.bottom + 24 }}>
          <Text variant="bodyStrong" color="accent">
            Add songs by hand instead
          </Text>
        </Pressable>
      </View>
    );
  }

  const connected = data?.connected === true;
  const needsReconnect = connected && data?.needsReconnect === true;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 8 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
          <CirclePlay size={36} color={colors.accent} />
        </View>
        <Text variant="display" style={{ textAlign: 'center' }}>
          Bring your music from YouTube
        </Text>
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          Connect your channel and we&apos;ll set up your songs on Blac for you.
        </Text>
      </View>

      {notice ? (
        <Card style={{ padding: 14, borderColor: colors.danger }}>
          <Text variant="body" color="danger">
            {notice}
          </Text>
        </Card>
      ) : null}

      {connected ? (
        <Card style={{ padding: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar url={data?.channel?.thumbnailUrl} name={data?.channel?.title ?? 'Channel'} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" color={needsReconnect ? 'danger' : 'accent'}>
                {needsReconnect ? 'Access stopped' : 'Connected'}
              </Text>
              <Text variant="headline" numberOfLines={1}>
                {data?.channel?.title ?? 'Your channel'}
              </Text>
              {data?.lastSyncedAt ? (
                <Text variant="caption" color="textSecondary">
                  Last read {new Date(data.lastSyncedAt).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
          </View>

          {needsReconnect ? (
            <>
              <Text variant="caption" color="textSecondary">
                Google no longer lets Blac read this channel, which happens when access is removed in your Google account. Connect again to carry on.
              </Text>
              <PrimaryButton label={busy === 'connect' ? 'Connecting…' : 'Connect again'} onPress={connect} disabled={busy !== null} />
            </>
          ) : (
            <PrimaryButton label="Choose songs to import" onPress={() => router.push('/youtube/review')} disabled={busy !== null} />
          )}

          <Pressable onPress={confirmDisconnect} disabled={busy !== null} accessibilityRole="button" style={{ alignItems: 'center', padding: 6 }}>
            {busy === 'disconnect' ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text variant="body" color="danger">
                Disconnect YouTube
              </Text>
            )}
          </Pressable>
        </Card>
      ) : (
        <PrimaryButton label={busy === 'connect' ? 'Connecting…' : 'Connect YouTube'} onPress={connect} disabled={busy !== null} />
      )}

      {/* Songs that are not on YouTube do not need a connected channel */}
      <Pressable
        onPress={() => {
          haptics.select();
          router.push('/youtube/manual');
        }}
        accessibilityRole="button"
        accessibilityLabel="Add songs by hand"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
            <ListPlus size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline">Not on YouTube?</Text>
            <Text variant="caption" color="textSecondary">
              Add songs by hand: name them and choose a file for each.
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </Card>
      </Pressable>

      <View style={{ gap: 18 }}>
        <Text variant="label" color="textTertiary">
          How it works
        </Text>
        <Point
          icon={<BookOpenCheck size={22} color={colors.accent} />}
          title="We only read your channel"
          text="Song titles, dates and thumbnails. We can't change anything on YouTube."
        />
        <Point
          icon={<Upload size={22} color={colors.accent} />}
          title="You add the audio"
          text="Choose a file for each song, so the sound quality stays yours. A video file from YouTube Studio's Download button works too."
        />
        <Point
          icon={<Music2 size={22} color={colors.accent} />}
          title="We do the rest"
          text="Songs wait in a short queue, then we convert, add the cover and publish them while you watch."
        />
      </View>

      <Text variant="caption" color="textTertiary" style={{ textAlign: 'center', paddingHorizontal: 10 }}>
        Only import music you own or have the rights to share. You can disconnect at any time.
      </Text>
      <View style={{ height: radius.card }} />
    </ScrollView>
  );
}
