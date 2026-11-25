import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { roleName, type Credit } from '@/domain/credits';
import { Card } from './Card';
import { Text } from './Text';

/** Groups credits by what they did: "Producer" with everyone who produced, in the order roles first appear. */
function byRole(credits: Credit[]): { role: string; people: Credit[] }[] {
  const groups = new Map<string, Credit[]>();
  for (const c of credits) {
    const key = roleName(c);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()].map(([role, people]) => ({ role, people }));
}

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

function RoleRows({ credits }: { credits: Credit[] }) {
  return (
    <View style={{ gap: 12 }}>
      {byRole(credits).map((g) => (
        <View key={g.role} style={{ gap: 2 }}>
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
 * The "Credits" block of a page. For a release it shows the credits for the whole release first, then the ones for
 * each song under that song's name; for a single song it simply lists everything by role. Nothing is drawn when
 * nobody is credited.
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
      <Card style={{ padding: 16, gap: 18 }}>
        {flat.length > 0 ? <RoleRows credits={flat} /> : null}
        {[...tracks.entries()].map(([id, t]) => (
          <View key={id} style={{ gap: 10 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {t.title}
            </Text>
            <RoleRows credits={t.items} />
          </View>
        ))}
      </Card>
    </View>
  );
}
