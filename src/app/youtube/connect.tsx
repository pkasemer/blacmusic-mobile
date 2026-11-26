import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpenCheck, CirclePlay, Music2, Upload } from 'lucide-react-native';
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
import { useDisconnectYouTube } from '@/studio/useDisconnectYouTube';
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
  const [connecting, setConnecting] = useState(false);
  const disconnect = useDisconnectYouTube();
  const busy = connecting || disconnect.busy;
  const [notice, setNotice] = useState<string | null>(null);
  const data = connection.data;

  const refreshConnection = async () => {
    void queryClient.invalidateQueries({ queryKey: youtubeKeys.videos });
    await connection.refetch();
  };

  const connect = async () => {
    haptics.select();
    setConnecting(true);
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
      setConnecting(false);
    }
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
              <PrimaryButton label={connecting ? 'Connecting…' : 'Connect again'} onPress={connect} disabled={busy} />
            </>
          ) : (
            <PrimaryButton label="Choose songs to import" onPress={() => router.push('/youtube/review')} disabled={busy} />
          )}

          <Pressable onPress={disconnect.confirm} disabled={busy} accessibilityRole="button" style={{ alignItems: 'center', padding: 6 }}>
            {disconnect.busy ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text variant="body" color="danger">
                Disconnect YouTube
              </Text>
            )}
          </Pressable>
        </Card>
      ) : (
        <PrimaryButton label={connecting ? 'Connecting…' : 'Connect YouTube'} onPress={connect} disabled={busy} />
      )}

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
