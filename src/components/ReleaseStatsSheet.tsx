import { useState } from 'react';
import { ActivityIndicator, ScrollView, View, useWindowDimensions } from 'react-native';
import { RANGE_LABEL, useReleaseStats, type StatsRange } from '@/api/blac/stats';
import { useTheme } from '@/theme';
import { formatCount } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { Artwork } from './Artwork';
import { BottomSheet } from './BottomSheet';
import { Chip } from './Chip';
import { PrimaryButton } from './FormField';
import { PlaysChart } from './StatsParts';
import { Text } from './Text';

const RANGES: StatsRange[] = ['7d', '28d', '90d', 'all'];

/** "3:07" for a length in seconds. */
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** One number in a soft tile. */
function Tile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: '45%', gap: 3, padding: 13, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.surfaceAlt }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="title" style={{ fontVariant: ['tabular-nums'], fontSize: 22, lineHeight: 28 }}>
        {value}
      </Text>
    </View>
  );
}

/** A small heading above a block. */
function Heading({ children }: { children: string }) {
  return (
    <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3, paddingTop: 6 }}>
      {children}
    </Text>
  );
}

function Body({ release, onOpen, dismiss }: { release: { id: string; title: string; artworkUrl?: string | null }; onOpen?: () => void; dismiss: (after?: () => void) => void }) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [range, setRange] = useState<StatsRange>('28d');
  const stats = useReleaseStats(release.id, range);
  const data = stats.data;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 }}>
        <Artwork id={release.id} logoUrl={release.artworkUrl ?? null} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {release.title}
          </Text>
          <Text variant="caption" color="textSecondary">
            {RANGE_LABEL[range]}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 }}>
        {RANGES.map((r) => (
          <Chip
            key={r}
            label={r === 'all' ? 'All time' : r === '7d' ? '7 days' : r === '28d' ? '28 days' : '90 days'}
            selected={range === r}
            onPress={() => {
              haptics.select();
              setRange(r);
            }}
          />
        ))}
      </View>

      <ScrollView style={{ maxHeight: height * 0.52 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 6 }} showsVerticalScrollIndicator={false}>
        {stats.isPending ? (
          <ActivityIndicator color={colors.accent} style={{ paddingVertical: 30 }} />
        ) : stats.isError ? (
          <Text variant="body" color="textSecondary" style={{ paddingVertical: 20 }}>
            Can&apos;t load the numbers. Check your connection and try again.
          </Text>
        ) : !data ? (
          <Text variant="body" color="textSecondary" style={{ paddingVertical: 20 }}>
            Numbers for each release are coming soon.
          </Text>
        ) : (
          <>
            <View style={{ gap: 8, padding: 14, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.surfaceAlt }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text variant="caption" color="textSecondary">
                  Plays
                </Text>
                <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatCount(data.totals.plays)}
                </Text>
              </View>
              <PlaysChart series={data.series} height={70} />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Tile label="Listeners" value={formatCount(data.totals.listeners)} />
              <Tile label="Likes" value={formatCount(data.totals.likes)} />
              <Tile label="Added to playlists" value={formatCount(data.totals.playlistAdds)} />
              {data.totals.avgListenSec ? <Tile label="Average listen" value={clock(data.totals.avgListenSec)} /> : null}
              {data.totals.completionRate !== undefined ? <Tile label="Listened to the end" value={`${Math.round(data.totals.completionRate * 100)}%`} /> : null}
            </View>

            {data.tracks.length > 1 ? (
              <View style={{ gap: 6 }}>
                <Heading>Plays by track</Heading>
                {data.tracks.map((t) => (
                  <View key={t.trackId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 }}>
                    <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                      {t.title}
                    </Text>
                    <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatCount(t.plays)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {data.sources.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Heading>Where people found it</Heading>
                {data.sources.map((s) => (
                  <View key={s.source} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 }}>
                    <Text variant="body" style={{ flex: 1 }}>
                      {s.source.charAt(0).toUpperCase() + s.source.slice(1)}
                    </Text>
                    <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatCount(s.plays)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {onOpen ? (
        <View style={{ paddingHorizontal: 20 }}>
          <PrimaryButton label="Open release" onPress={() => dismiss(onOpen)} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The numbers for one release, in a sheet that slides up: plays over time, listeners, likes, how people found it and
 * how each track does. `onOpen` adds an "Open release" button.
 */
export function ReleaseStatsSheet({
  release,
  onClose,
  onOpen,
}: {
  release: { id: string; title: string; artworkUrl?: string | null } | null;
  onClose: () => void;
  onOpen?: () => void;
}) {
  return <BottomSheet visible={release !== null} onClose={onClose}>{(dismiss) => (release ? <Body release={release} onOpen={onOpen} dismiss={dismiss} /> : null)}</BottomSheet>;
}
