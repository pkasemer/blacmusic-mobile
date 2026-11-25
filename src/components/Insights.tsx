import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { RANGE_LABEL, useArtistStats, type StatsRange } from '@/api/blac/stats';
import { Artwork } from '@/components/Artwork';
import { ChangeTag, MetricTile, PlaysChart } from '@/components/StatsParts';
import { ReleaseStatsSheet } from '@/components/ReleaseStatsSheet';
import { SettingsGroup, chooseOne, useGroupedColors } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import { formatCount } from '@/utils/format';
import { haptics } from '@/utils/haptics';

const RANGES: StatsRange[] = ['7d', '28d', '90d', 'all'];

/**
 * The short version for the Studio tab: monthly listeners, a small chart and a way in to every number. Tapping it
 * opens the Insights screen.
 */
export function InsightsSummary() {
  const router = useRouter();
  const g = useGroupedColors();
  const stats = useArtistStats('28d');
  const data = stats.data;

  return (
    <View style={{ gap: 8 }}>
      <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: 32, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        Insights
      </Text>
      <Pressable
        onPress={() => {
          haptics.select();
          router.push('/insights');
        }}
        accessibilityRole="button"
        accessibilityLabel="Open insights: all your numbers"
        style={({ pressed }) => ({ marginHorizontal: 16, padding: 16, gap: 12, borderRadius: 12, borderCurve: 'continuous', backgroundColor: g.cell, opacity: pressed ? 0.85 : 1 })}
      >
        {stats.isPending ? (
          <ActivityIndicator />
        ) : data ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text variant="caption" color="textSecondary">
                  Monthly listeners
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatCount(data.totals.monthlyListeners)}
                  </Text>
                  <ChangeTag value={data.totals.monthlyListenersChange} />
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text variant="caption" color="textSecondary">
                  Plays, last 28 days
                </Text>
                <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatCount(data.totals.plays)}
                </Text>
              </View>
            </View>
            <PlaysChart series={data.series} height={44} />
          </>
        ) : (
          <Text variant="body" color="textSecondary">
            Numbers are coming soon.
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="bodyStrong" color="accent">
            See all insights
          </Text>
          <ChevronRight size={18} color={g.chevron} strokeWidth={2.5} />
        </View>
      </Pressable>
    </View>
  );
}

/** "Nov 3" for an ISO day. */
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });

/** A rounded note card, for loading, errors and "nothing yet". */
function Note({ title, text, busy }: { title: string; text: string; busy?: boolean }) {
  const g = useGroupedColors();
  return (
    <View style={{ marginHorizontal: 16, padding: 18, gap: 6, borderRadius: 12, borderCurve: 'continuous', backgroundColor: g.cell, alignItems: 'center' }}>
      {busy ? <ActivityIndicator /> : null}
      <Text variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * How the artist's music is doing: monthly listeners, plays over time, the main numbers, the best songs and each
 * release. Needs a server that counts plays; on an older one it says the numbers are coming.
 */
export function Insights() {
  const { isDark, colors } = useTheme();
  const g = useGroupedColors();
  const router = useRouter();
  const [range, setRange] = useState<StatsRange>('28d');
  const [picked, setPicked] = useState<{ id: string; title: string; artworkUrl?: string | null } | null>(null);
  const stats = useArtistStats(range);
  const data = stats.data;

  const pickRange = () => {
    haptics.select();
    chooseOne<StatsRange>({
      title: 'Show numbers for',
      options: RANGES.map((value) => ({ value, label: RANGE_LABEL[value] })),
      current: range,
      isDark,
      onSelect: setRange,
    });
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32 }}>
      <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
        Insights
      </Text>
      <Pressable onPress={pickRange} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Period: ${RANGE_LABEL[range]}. Change`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Text variant="caption" color="accent">
          {RANGE_LABEL[range]}
        </Text>
        <ChevronDown size={14} color={colors.accent} />
      </Pressable>
    </View>
  );

  let body;
  if (stats.isPending) body = <Note busy title="Loading your numbers…" text="" />;
  else if (stats.isError) body = <Note title="Can't load your numbers" text="Check your connection and pull down to try again." />;
  else if (!data) body = <Note title="Numbers are coming soon" text="Soon you'll see your plays, listeners and how each release is doing right here." />;
  else {
    const { totals } = data;
    const empty = totals.plays === 0 && totals.monthlyListeners === 0;
    body = (
      <View style={{ gap: 12 }}>
        {/* Monthly listeners: the number artists look at first */}
        <View style={{ marginHorizontal: 16, padding: 16, gap: 4, borderRadius: 12, borderCurve: 'continuous', backgroundColor: g.cell }}>
          <Text variant="caption" color="textSecondary">
            Monthly listeners
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
              {formatCount(totals.monthlyListeners)}
            </Text>
            <ChangeTag value={totals.monthlyListenersChange} />
          </View>
          <Text variant="caption" color="textTertiary">
            People who listened in the last 30 days
          </Text>
        </View>

        {/* Plays over the period */}
        <View style={{ marginHorizontal: 16, padding: 16, gap: 10, borderRadius: 12, borderCurve: 'continuous', backgroundColor: g.cell }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text variant="caption" color="textSecondary">
              Plays
            </Text>
            <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
              {formatCount(totals.plays)}
            </Text>
          </View>
          <PlaysChart series={data.series} />
          {data.series.length > 1 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" color="textTertiary">
                {shortDay(data.series[0].date)}
              </Text>
              <Text variant="caption" color="textTertiary">
                {shortDay(data.series[data.series.length - 1].date)}
              </Text>
            </View>
          ) : null}
          {empty ? (
            <Text variant="caption" color="textSecondary">
              Numbers appear here once people start listening to your music.
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16 }}>
          <MetricTile label="Listeners" value={totals.listeners} />
          <MetricTile label="Followers" value={totals.followers} change={totals.followersChange} />
          <MetricTile label="Likes" value={totals.likes} change={totals.likesChange} />
          <MetricTile label="Added to playlists" value={totals.playlistAdds} />
        </View>

        {data.topTracks.length > 0 ? (
          <SettingsGroup title="Top songs" separatorInset={74}>
            {data.topTracks.map((t, i) => (
              <Pressable
                key={t.trackId}
                onPress={() => {
                  haptics.select();
                  router.push({ pathname: '/track/[id]', params: { id: t.trackId } });
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: pressed ? g.pressed : 'transparent' })}
              >
                <Text variant="bodyStrong" color="textTertiary" style={{ width: 16, fontVariant: ['tabular-nums'] }}>
                  {i + 1}
                </Text>
                <Artwork id={t.trackId} logoUrl={t.artworkUrl ?? null} size={44} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="body" numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {formatCount(t.listeners)} {t.listeners === 1 ? 'listener' : 'listeners'}
                  </Text>
                </View>
                <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatCount(t.plays)}
                </Text>
              </Pressable>
            ))}
          </SettingsGroup>
        ) : null}

        {data.releases.length > 0 ? (
          <SettingsGroup title="By release" separatorInset={74}>
            {data.releases.map((r) => (
              <Pressable
                key={r.releaseId}
                onPress={() => {
                  haptics.select();
                  setPicked({ id: r.releaseId, title: r.title, artworkUrl: r.artworkUrl });
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: pressed ? g.pressed : 'transparent' })}
              >
                <Artwork id={r.releaseId} logoUrl={r.artworkUrl ?? null} size={44} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="body" numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {formatCount(r.plays)} {r.plays === 1 ? 'play' : 'plays'} · {formatCount(r.listeners)} {r.listeners === 1 ? 'listener' : 'listeners'}
                  </Text>
                </View>
                <ChevronRight size={18} color={g.chevron} strokeWidth={2.5} />
              </Pressable>
            ))}
          </SettingsGroup>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {header}
      {body}
      <ReleaseStatsSheet
        release={picked}
        onClose={() => setPicked(null)}
        onOpen={picked ? () => router.push({ pathname: '/release/[id]', params: { id: picked.id } }) : undefined}
      />
    </View>
  );
}
