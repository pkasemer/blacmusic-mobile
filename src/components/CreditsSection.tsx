import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { creditsByRole, type Credit } from '@/domain/credits';
import { useTheme } from '@/theme';
import { Card } from './Card';
import { Text } from './Text';

/** A person's name; it opens their artist page when they have a profile on Blac. */
function Person({ credit, last }: { credit: Credit; last: boolean }) {
  const router = useRouter();
  const comma = last ? '' : ', ';
  if (!credit.artistId) {
    return <Text variant="body">{credit.name + comma}</Text>;
  }
  return (
    <Text variant="body" color="accent" onPress={() => router.push({ pathname: '/artist/[id]', params: { id: credit.artistId as string } })} accessibilityRole="link">
      {credit.name + comma}
    </Text>
  );
}

/** One row for each role, with a thin line between rows, like the Details card. `last`: nothing follows the rows. */
function RoleRows({ credits, last }: { credits: Credit[]; last: boolean }) {
  const { colors } = useTheme();
  const rows = creditsByRole(credits);
  return (
    <View>
      {rows.map((g, row) => (
        <View key={g.role} style={{ gap: 3, paddingVertical: 12, borderBottomWidth: last && row === rows.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
          <Text variant="caption" color="textSecondary">
            {g.role}
          </Text>
          <Text variant="body">
            {g.people.map((p, i) => (
              <Person key={`${p.name}-${i}`} credit={p} last={i === g.people.length - 1} />
            ))}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The "Credits" block of a page. For a release of several songs (`perTrack`) it shows the credits for the whole release
 * first, then the ones for each song under that song's name; for one song, or a release of one, it simply lists
 * everything by role. Nothing is drawn when nobody is credited.
 */
export function CreditsSection({ credits, perTrack }: { credits: Credit[] | null | undefined; perTrack?: boolean }) {
  if (!credits || credits.length === 0) return null;
  const whole = credits.filter((c) => !c.trackId);
  const tracks = new Map<string, { title: string; items: Credit[] }>();
  if (perTrack) {
    for (const c of credits) {
      if (!c.trackId) continue;
      const entry = tracks.get(c.trackId) ?? { title: c.trackTitle ?? 'Song', items: [] };
      entry.items.push(c);
      tracks.set(c.trackId, entry);
    }
  }
  const flat = perTrack ? whole : credits;

  return (
    <View style={{ gap: 12, paddingHorizontal: 20 }}>
      <Text variant="title">Credits</Text>
      <Card style={{ paddingHorizontal: 16 }}>
        {flat.length > 0 ? <RoleRows credits={flat} last={tracks.size === 0} /> : null}
        {[...tracks.entries()].map(([id, t], i) => (
          <View key={id}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ paddingTop: 14 }}>
              {t.title}
            </Text>
            <RoleRows credits={t.items} last={i === tracks.size - 1} />
          </View>
        ))}
      </Card>
    </View>
  );
}
