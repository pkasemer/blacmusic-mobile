import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, ChevronRight, HardDrive, Upload } from 'lucide-react-native';
import { studioApi } from '@/api/blac/studio';
import { useQuota, useStudioItems } from '@/api/blac/queries';
import { USES_BACKEND, blacApi } from '@/api/blac';
import { Artwork } from '@/components/Artwork';
import { Avatar } from '@/components/Avatar';
import { InsightsSummary } from '@/components/Insights';
import { Chip } from '@/components/Chip';
import { formatGoLive } from '@/components/DateTimeField';
import { isBeingVerified, profileNote, standingOf, type StandingTone } from '@/domain/review';
import { SettingsGroup, SettingsRow, chooseOne, useGroupedColors } from '@/components/SettingsList';
import { SuspendedStudio } from '@/components/SuspendedStudio';
import { TabScreen } from '@/components/TabScreen';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Text } from '@/components/Text';
import { ImportSongsRow } from '@/components/YouTubeCard';
import { formatBytes } from '@/cache/imageCache';
import { remainingQuotaBytes, totalQuotaBytes, type StudioItem } from '@/domain/types';
import { useArtistStore, useStudioSuspended } from '@/store/artistStore';
import { refreshArtist } from '@/studio/refreshArtist';
import { useUploadStore } from '@/store/uploadStore';
import { useTheme } from '@/theme';
import { syncAccount } from '@/auth/session';
import { refreshStudio, usePullToRefresh } from '@/hooks/usePullToRefresh';
import { haptics } from '@/utils/haptics';
import { topInset } from '@/utils/platform';

/** Who you are in the Studio: your artist picture, name and whether you are verified. */
function ArtistCard() {
  const profile = useArtistStore((s) => s.profile);
  const { colors } = useTheme();
  const g = useGroupedColors();
  if (!profile) return null;
  const verified = profile.verification === 'verified';
  const note = profileNote(profile.review);
  // The artist sees what they sent; the note says what listeners see meanwhile.
  const name = profile.pending?.name ?? profile.name;
  const canWithdraw = profile.review?.status === 'pending' && profile.review.kind === 'update';

  const withdraw = () => {
    haptics.warning();
    Alert.alert('Withdraw your profile changes?', 'They are dropped. Listeners keep seeing your approved profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () =>
          void studioApi
            .withdrawProfileReview()
            // A withdrawn photo also puts the account's own picture back.
            .then(() => syncAccount())
            .catch((e: unknown) => Alert.alert("Couldn't withdraw them", e instanceof Error ? e.message : 'Try again.')),
      },
    ]);
  };

  return (
    <View style={{ marginHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', backgroundColor: g.cell, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar url={profile.pending?.avatarUrl ?? profile.avatarUrl} name={name} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
              {name}
            </Text>
            {verified ? <VerifiedBadge size={18} /> : null}
          </View>
          <Text variant="caption" color="textSecondary">
            {verified ? 'Verified artist' : 'Artist'}
          </Text>
        </View>
      </View>
      {note ? (
        <View style={{ gap: 3, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }} accessibilityLiveRegion="polite">
          <Text variant="bodyStrong" color={note.refused ? 'danger' : 'accent'}>
            {note.title}
          </Text>
          <Text variant="caption" color="textSecondary">
            {note.text}
          </Text>
          {canWithdraw ? (
            <Pressable onPress={withdraw} accessibilityRole="button" hitSlop={6} style={{ alignSelf: 'flex-start', paddingTop: 4 }}>
              <Text variant="bodyStrong" color="accent">
                Withdraw changes
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Live, scheduled and draft counts side by side in one card. */
function Overview({ live, scheduled, drafts }: { live: number; scheduled: number; drafts: number }) {
  const g = useGroupedColors();
  const cells = [
    { value: live, label: 'Live' },
    { value: scheduled, label: 'Scheduled' },
    { value: drafts, label: 'Drafts' },
  ];
  return (
    <View style={{ marginHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', backgroundColor: g.cell, flexDirection: 'row' }}>
      {cells.map((c, i) => (
        <View key={c.label} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderLeftWidth: i === 0 ? 0 : 0.5, borderLeftColor: g.separator }}>
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {c.value}
          </Text>
          <Text variant="caption" color="textSecondary">
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The big upload button. */
function UploadButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        router.push('/release/new');
      }}
      accessibilityRole="button"
      style={({ pressed }) => ({
        marginHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 50,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: colors.primary,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Upload size={18} color={colors.onPrimary} />
      <Text variant="bodyStrong" color="onPrimary">
        Upload music
      </Text>
    </Pressable>
  );
}

/** How much of the 10 GB is used, as a row with a bar under it. */
function StorageRow({ artistId }: { artistId: string }) {
  const { colors } = useTheme();
  const quota = useQuota(artistId);
  const data = quota.data;
  const total = data ? totalQuotaBytes(data) : 0;
  const fraction = data && total > 0 ? Math.min(1, data.usedBytes / total) : 0;
  const nearFull = fraction >= 0.9;
  return (
    <View style={{ gap: 9, paddingVertical: 12, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
          <HardDrive size={18} color={colors.text} strokeWidth={1.9} />
        </View>
        <Text variant="body" style={{ flex: 1 }}>
          Storage
        </Text>
        <Text variant="body" color="textSecondary">
          {data ? `${formatBytes(data.usedBytes)} of ${formatBytes(total)}` : '…'}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${fraction * 100}%`, height: 6, backgroundColor: nearFull ? colors.danger : colors.primary }} />
      </View>
      {nearFull && data ? (
        <Text variant="caption" color="danger">
          Almost full: {formatBytes(remainingQuotaBytes(data))} left. Add more storage on the Blac website.
        </Text>
      ) : null}
    </View>
  );
}

/** The verified badge: where you are, and a request when you are not verified. */
function VerificationRow() {
  const { isDark } = useTheme();
  const profile = useArtistStore((s) => s.profile);
  const setVerification = useArtistStore((s) => s.setVerification);
  if (!profile) return null;
  const status = profile.verification;
  const canRequest = status === 'unverified' || status === 'rejected';

  const request = async () => {
    haptics.medium();
    setVerification('pending');
    await blacApi.requestVerification(profile.id);
  };

  return (
    <SettingsRow
      icon={{ Icon: BadgeCheck }}
      title="Verified badge"
      value={status === 'verified' ? 'Verified' : status === 'pending' ? 'In review' : status === 'rejected' ? 'Declined' : 'Not verified'}
      chevron={canRequest}
      onPress={
        canRequest
          ? () =>
              chooseOne<'request'>({
                title: 'Request verification?',
                message: 'The Blac team reviews your profile, which usually takes a few days. You can upload while you wait.',
                options: [{ value: 'request', label: 'Request verification' }],
                isDark,
                onSelect: () => void request(),
              })
          : undefined
      }
    />
  );
}

type Tone = StandingTone | 'busy' | 'failed';

/** What to tell the artist about a release: one word, a colour, and (for scheduled ones) when. */
function describe(item: StudioItem): { label: string; tone: Tone; detail?: string } {
  if (item.status === 'failed') return { label: 'Upload failed', tone: 'failed' };
  if (item.status === 'uploading') return { label: 'Uploading', tone: 'busy' };
  if (item.status === 'processing') return { label: 'Processing', tone: 'busy' };
  return standingOf(item.visibility, item.review, item.publishAt ? formatGoLive(new Date(item.publishAt)) : undefined);
}

/** A small coloured dot and one word: where a release is. */
function StatusLabel({ item }: { item: StudioItem }) {
  const { colors } = useTheme();
  const { label, tone, detail } = describe(item);
  const color = tone === 'live' ? colors.success : tone === 'scheduled' || tone === 'review' ? colors.accent : tone === 'failed' || tone === 'refused' ? colors.danger : colors.textTertiary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {tone === 'busy' ? (
        <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.6 }], marginHorizontal: -5 }} />
      ) : (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      )}
      <Text variant="caption" style={{ flexShrink: 1, color: tone === 'failed' || tone === 'refused' ? colors.danger : colors.textSecondary }} numberOfLines={tone === 'refused' ? 2 : 1}>
        {label}
        {detail ? ` · ${detail}` : ''}
      </Text>
    </View>
  );
}

/** One release in the list: cover, title, what it is, and where it stands. */
function ReleaseRow({ item, onPress }: { item: StudioItem; onPress: () => void }) {
  const g = useGroupedColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: pressed ? g.pressed : 'transparent' })}
    >
      <Artwork id={item.id} logoUrl={item.artworkUrl} size={56} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="headline" numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {item.type === 'album' || item.type === 'ep' ? 'Album' : 'Single'} · {item.trackCount} {item.trackCount === 1 ? 'track' : 'tracks'}
          {item.plays !== undefined ? ` · ${item.plays.toLocaleString()} plays` : ''}
        </Text>
        <StatusLabel item={item} />
        {item.status === 'failed' && item.problem ? (
          <Text variant="caption" color="danger" numberOfLines={2}>
            {item.problem}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={g.chevron} strokeWidth={2.5} />
    </Pressable>
  );
}

/** Releases whose files are going up, being converted, or have failed: shown at the top so they are not missed. */
function InProgress({ items }: { items: StudioItem[] }) {
  const router = useRouter();
  const g = useGroupedColors();
  const { colors } = useTheme();
  const jobs = useUploadStore((s) => s.jobs);
  const busy = items.filter((i) => i.status === 'uploading' || i.status === 'processing' || i.status === 'failed');
  if (busy.length === 0) return null;

  return (
    <SettingsGroup title={`In progress · ${busy.length}`} separatorInset={74}>
      {busy.map((item) => {
        // How far the files sent from this phone are, when this phone is the one sending them.
        const mine = Object.values(jobs).filter((j) => j.releaseId === item.id && (j.state === 'waiting' || j.state === 'uploading'));
        const sent = mine.length > 0 ? mine.reduce((sum, j) => sum + j.progress, 0) / mine.length : null;
        const failed = item.status === 'failed';
        const text = failed
          ? (item.problem ?? 'Something went wrong with the upload')
          : item.status === 'uploading'
            ? sent !== null
              ? `Uploading ${Math.round(sent * 100)}%`
              : 'Uploading…'
            : 'Processing the audio…';
        return (
          <Pressable
            key={item.id}
            onPress={() => {
              haptics.select();
              router.push({ pathname: '/release/[id]', params: { id: item.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${text}`}
            style={({ pressed }) => ({ gap: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: pressed ? g.pressed : 'transparent' })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Artwork id={item.id} logoUrl={item.artworkUrl} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="headline" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text variant="caption" color={failed ? 'danger' : 'textSecondary'} numberOfLines={2}>
                  {text}
                </Text>
              </View>
              {failed ? null : <ActivityIndicator size="small" color={colors.accent} />}
            </View>
            {sent !== null ? (
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginLeft: 62 }}>
                <View style={{ width: `${Math.round(sent * 100)}%`, height: 4, backgroundColor: colors.primary }} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </SettingsGroup>
  );
}

type Filter = 'all' | 'live' | 'scheduled' | 'draft' | 'review';

/** The tab while the artist is suspended: the title, why the Studio is off, and a way to check again. */
function SuspendedTab() {
  const insets = useSafeAreaInsets();
  const g = useGroupedColors();
  const refreshControl = usePullToRefresh(refreshArtist);
  return (
    <TabScreen>
      <ScrollView
        style={{ backgroundColor: g.page }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: topInset(insets.top) + 12, paddingBottom: 40, gap: 24 }}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Text variant="display" accessibilityRole="header">
            Studio
          </Text>
        </View>
        <SuspendedStudio />
      </ScrollView>
    </TabScreen>
  );
}

export default function StudioScreen() {
  const suspended = useStudioSuspended();
  // Ask again each time the Studio is opened, so a suspension (or its end) shows without signing in again.
  useFocusEffect(
    useCallback(() => {
      void refreshArtist();
    }, []),
  );
  return suspended ? <SuspendedTab /> : <StudioHome />;
}

function StudioHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const g = useGroupedColors();
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
      draft: all.filter((i) => i.visibility === 'draft' && !isBeingVerified(i.review)).length,
      review: all.filter((i) => i.review?.status === 'pending').length,
    }),
    [all],
  );
  const shown = useMemo(
    () => {
      if (filter === 'all') return all;
      if (filter === 'review') return all.filter((i) => i.review?.status === 'pending');
      if (filter === 'draft') return all.filter((i) => i.visibility === 'draft' && !isBeingVerified(i.review));
      return all.filter((i) => i.visibility === (filter === 'live' ? 'public' : 'scheduled'));
    },
    [all, filter],
  );

  return (
    <TabScreen>
      <ScrollView
        style={{ backgroundColor: g.page }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: topInset(insets.top) + 12, paddingBottom: 40, gap: 24 }}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 14 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <Text variant="display" accessibilityRole="header">
              Studio
            </Text>
          </View>
          <ArtistCard />
        </View>

        <View style={{ gap: 12 }}>
          <Overview live={counts.live} scheduled={counts.scheduled} drafts={counts.draft} />
          <UploadButton />
        </View>

        <InProgress items={all} />

        {profile ? <InsightsSummary /> : null}

        <SettingsGroup title="Tools" separatorInset={58}>
          {USES_BACKEND ? <ImportSongsRow key="import" /> : null}
          {profile ? (
            <View key="storage">
              <StorageRow artistId={profile.id} />
            </View>
          ) : null}
          <VerificationRow key="verification" />
        </SettingsGroup>

        <View style={{ gap: 10 }}>
          <View style={{ paddingHorizontal: 32, gap: 10 }}>
            <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Your releases
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
            <Chip label={`All · ${counts.all}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
            {counts.review > 0 || filter === 'review' ? (
              <Chip label={`Pending verification · ${counts.review}`} selected={filter === 'review'} onPress={() => setFilter('review')} />
            ) : null}
            <Chip label={`Live · ${counts.live}`} selected={filter === 'live'} onPress={() => setFilter('live')} />
            <Chip label={`Scheduled · ${counts.scheduled}`} selected={filter === 'scheduled'} onPress={() => setFilter('scheduled')} />
            <Chip label={`Drafts · ${counts.draft}`} selected={filter === 'draft'} onPress={() => setFilter('draft')} />
          </View>
          {items.isPending && all.length === 0 ? (
            <ActivityIndicator style={{ padding: 24 }} />
          ) : shown.length === 0 ? (
            <Text variant="body" color="textSecondary" style={{ paddingHorizontal: 32 }}>
              {all.length === 0 ? 'Nothing uploaded yet. Tap Upload music to add your first release.' : 'No releases in this group.'}
            </Text>
          ) : (
            <SettingsGroup separatorInset={86}>
              {shown.map((item) => (
                <ReleaseRow key={item.id} item={item} onPress={() => router.push({ pathname: '/release/[id]', params: { id: item.id } })} />
              ))}
            </SettingsGroup>
          )}
        </View>
      </ScrollView>
    </TabScreen>
  );
}
