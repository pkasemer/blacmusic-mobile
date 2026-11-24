import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, Clock, HardDrive, Upload } from 'lucide-react-native';
import { useQuota, useStudioItems } from '@/api/blac/queries';
import { USES_BACKEND, blacApi } from '@/api/blac';
import { Artwork } from '@/components/Artwork';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { ScreenHero } from '@/components/ScreenHero';
import { YouTubeCard } from '@/components/YouTubeCard';
import { Chip } from '@/components/Chip';
import { formatGoLive } from '@/components/DateTimeField';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { formatBytes } from '@/cache/imageCache';
import { remainingQuotaBytes, totalQuotaBytes, type StudioItem } from '@/domain/types';
import { useArtistStore } from '@/store/artistStore';
import { radius, useTheme } from '@/theme';
import { syncAccount } from '@/auth/session';
import { refreshStudio, usePullToRefresh } from '@/hooks/usePullToRefresh';
import { haptics } from '@/utils/haptics';
import { topInset } from '@/utils/platform';

function QuotaCard({ artistId }: { artistId: string }) {
  const { colors } = useTheme();
  const quota = useQuota(artistId);
  const data = quota.data;
  const total = data ? totalQuotaBytes(data) : 0;
  const fraction = data && total > 0 ? Math.min(1, data.usedBytes / total) : 0;
  const nearFull = fraction >= 0.9;

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <HardDrive size={18} color={colors.accent} />
        <Text variant="headline">Storage</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <View
          style={{
            width: `${fraction * 100}%`,
            height: 8,
            backgroundColor: nearFull ? colors.danger : colors.primary,
          }}
        />
      </View>
      <Text variant="caption" color="textSecondary">
        {data ? `${formatBytes(data.usedBytes)} of ${formatBytes(total)} used` : 'Checking your storage…'}
      </Text>
      {data ? (
        <Text variant="caption" color="textTertiary">
          {nearFull
            ? `Almost full: ${formatBytes(remainingQuotaBytes(data))} left. You can add more storage on the Blac website.`
            : 'Every artist gets 10 GB free. Need more? Add storage on the Blac website.'}
        </Text>
      ) : null}
    </Card>
  );
}

function VerificationCard() {
  const { colors } = useTheme();
  const profile = useArtistStore((s) => s.profile);
  const setVerification = useArtistStore((s) => s.setVerification);
  if (!profile) return null;
  const status = profile.verification;

  const request = async () => {
    haptics.medium();
    setVerification('pending');
    await blacApi.requestVerification(profile.id);
  };

  return (
    <Card style={{ padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {status === 'verified' ? <BadgeCheck size={18} color={colors.accent} /> : <Clock size={18} color={colors.textTertiary} />}
        <Text variant="headline">
          {status === 'verified'
            ? 'Verified artist'
            : status === 'pending'
              ? 'Verification pending'
              : status === 'rejected'
                ? 'Verification declined'
                : 'Not verified yet'}
        </Text>
      </View>
      <Text variant="caption" color="textSecondary">
        {status === 'verified'
          ? 'Your profile shows the verified badge.'
          : status === 'pending'
            ? 'We are reviewing your request. This usually takes a few days.'
            : 'You can upload now. A verified badge needs approval from the Blac team.'}
      </Text>
      {status === 'unverified' || status === 'rejected' ? (
        <Pressable
          onPress={request}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            marginTop: 4,
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text variant="caption" color="text">
            Request verification
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** A number with a small label under it, for the row of release counts in the hero. */
function StatTile({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: 12,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

type Tone = 'live' | 'scheduled' | 'draft' | 'busy' | 'failed';

/** What to tell the artist about a release: one word, a colour, and (for scheduled ones) when. */
function describe(item: StudioItem): { label: string; tone: Tone; detail?: string } {
  if (item.status === 'failed') return { label: 'Upload failed', tone: 'failed' };
  if (item.status === 'uploading') return { label: 'Uploading', tone: 'busy' };
  if (item.status === 'processing') return { label: 'Processing', tone: 'busy' };
  if (item.visibility === 'public') return { label: 'Live', tone: 'live' };
  if (item.visibility === 'scheduled') {
    return { label: 'Scheduled', tone: 'scheduled', detail: item.publishAt ? formatGoLive(new Date(item.publishAt)) : undefined };
  }
  return { label: 'Draft', tone: 'draft', detail: 'Only you can see it' };
}

function StatusPill({ item }: { item: StudioItem }) {
  const { colors } = useTheme();
  const { label, tone } = describe(item);
  const color =
    tone === 'live' ? colors.success : tone === 'scheduled' ? colors.accent : tone === 'failed' ? colors.danger : colors.textTertiary;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      {tone === 'busy' ? (
        <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.65 }], marginHorizontal: -4 }} />
      ) : (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      )}
      <Text variant="caption" color="text">
        {label}
      </Text>
    </View>
  );
}

function ItemRow({ item }: { item: StudioItem }) {
  const { colors } = useTheme();
  const { detail } = describe(item);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 20 }}>
      <Artwork id={item.id} logoUrl={item.artworkUrl} size={60} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text variant="headline" numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {item.type === 'album' || item.type === 'ep' ? 'Album' : 'Single'} · {item.trackCount}{' '}
          {item.trackCount === 1 ? 'track' : 'tracks'}
          {item.plays !== undefined ? ` · ${item.plays.toLocaleString()} plays` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill item={item} />
          {detail ? (
            <Text variant="caption" color="textTertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {detail}
            </Text>
          ) : null}
        </View>
        {item.status === 'failed' && item.problem ? (
          <Text variant="caption" style={{ color: colors.danger }} numberOfLines={2}>
            {item.problem}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type Filter = 'all' | 'live' | 'scheduled' | 'draft';

export default function StudioScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useArtistStore((s) => s.profile);
  const items = useStudioItems(profile?.id);
  const refreshControl = usePullToRefresh(() => Promise.all([syncAccount(), refreshStudio()]));
  const [filter, setFilter] = useState<Filter>('all');

  const all = useMemo(() => items.data ?? [], [items.data]);
  const counts = useMemo(
    () => ({
      all: all.length,
      live: all.filter((i) => i.visibility === 'public').length,
      scheduled: all.filter((i) => i.visibility === 'scheduled').length,
      draft: all.filter((i) => i.visibility === 'draft').length,
    }),
    [all],
  );
  const shown = useMemo(
    () =>
      filter === 'all'
        ? all
        : all.filter((i) => i.visibility === (filter === 'live' ? 'public' : filter === 'scheduled' ? 'scheduled' : 'draft')),
    [all, filter],
  );

  const header = (
    <View style={{ gap: 16, paddingBottom: 16 }}>
      <ScreenHero
        label="Studio"
        title={profile?.name ?? 'Your music'}
        subtitle={profile?.verification === 'verified' ? 'Verified artist' : 'Artist'}
        leading={profile ? <Avatar url={profile.avatarUrl} name={profile.name} size={72} /> : undefined}
      >
        {/* How your releases are doing, at a glance */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
          <StatTile value={counts.live} label="Live" />
          <StatTile value={counts.scheduled} label="Scheduled" />
          <StatTile value={counts.draft} label="Drafts" />
        </View>
        <Pressable
          onPress={() => {
            haptics.select();
            router.push('/release/new');
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Upload size={18} color={colors.onPrimary} />
          <Text variant="bodyStrong" color="onPrimary">
            Upload music
          </Text>
        </Pressable>
      </ScreenHero>

      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {USES_BACKEND ? <YouTubeCard /> : null}
        {profile ? <QuotaCard artistId={profile.id} /> : null}
        <VerificationCard />
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="title" style={{ paddingHorizontal: 20 }}>
          Your releases
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 }}>
          <Chip label={`All · ${counts.all}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={`Live · ${counts.live}`} selected={filter === 'live'} onPress={() => setFilter('live')} />
          <Chip label={`Scheduled · ${counts.scheduled}`} selected={filter === 'scheduled'} onPress={() => setFilter('scheduled')} />
          <Chip label={`Drafts · ${counts.draft}`} selected={filter === 'draft'} onPress={() => setFilter('draft')} />
        </View>
      </View>
    </View>
  );

  return (
    <TabScreen>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/release/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ItemRow item={item} />
          </Pressable>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          items.isPending ? undefined : (
            <Text variant="body" color="textSecondary" style={{ paddingHorizontal: 20 }}>
              {all.length === 0 ? 'Nothing uploaded yet.' : 'No releases in this group.'}
            </Text>
          )
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: topInset(insets.top) + 12, paddingBottom: 28 }}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      />
    </TabScreen>
  );
}
