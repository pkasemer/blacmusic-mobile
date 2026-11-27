import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/api/blac/onboarding';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/Text';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { DISCOVERY_MODES, hasAll, searchLanguages, type LanguageGroup } from '@/domain/onboarding';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useOnboardingConfig } from '@/onboarding/useConfig';
import { useOnboardingStore, type PickedArtist } from '@/store/onboardingStore';
import { haptics } from '@/utils/haptics';
import { ChoiceCard, SearchField, TogglePill, useChoiceColors } from './parts';

// ---- Step 2: languages ------------------------------------------------------------------------------

function LanguageGroupCard({ group, open, onOpen }: { group: LanguageGroup; open: boolean; onOpen: () => void }) {
  const c = useChoiceColors();
  const preferred = useOnboardingStore((s) => s.preferred);
  const understood = useOnboardingStore((s) => s.understood);
  const toggle = useOnboardingStore((s) => s.toggleLanguage);
  const toggleMany = useOnboardingStore((s) => s.toggleLanguages);
  const ids = group.languages.map((l) => l.id);
  const enjoyed = ids.filter((id) => preferred.includes(id)).length;
  const known = ids.filter((id) => understood.includes(id)).length;
  const chosen = [enjoyed ? `${enjoyed} enjoyed` : null, known ? `${known} understood` : null].filter(Boolean).join(' · ');

  return (
    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: chosen ? c.accent : c.line, backgroundColor: c.card }}>
      <Pressable
        onPress={() => {
          haptics.select();
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${group.label}. ${group.description} ${chosen}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 14 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline">{group.label}</Text>
          <Text variant="caption" color="textSecondary">
            {group.description}
          </Text>
          {chosen ? (
            <Text variant="caption" color="accent">
              {chosen}
            </Text>
          ) : null}
        </View>
        {open ? <ChevronUp size={20} color={c.quiet} /> : <ChevronDown size={20} color={c.quiet} />}
      </Pressable>

      {open ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TogglePill role="button" label={hasAll(preferred, ids) ? 'Clear enjoy' : 'Enjoy all'} on={false} onPress={() => toggleMany('preferred', ids)} hint={`${hasAll(preferred, ids) ? 'Deselect' : 'Select'} all ${group.label} languages you enjoy`} />
            <TogglePill role="button" label={hasAll(understood, ids) ? 'Clear understand' : 'Understand all'} on={false} onPress={() => toggleMany('understood', ids)} hint={`${hasAll(understood, ids) ? 'Deselect' : 'Select'} all ${group.label} languages you understand`} />
          </View>
          {group.languages.map((language) => (
            <View key={language.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }}>
              <Text variant="bodyStrong" style={{ flexGrow: 1, flexBasis: 90 }}>
                {language.label}
              </Text>
              <TogglePill label="Enjoy" on={preferred.includes(language.id)} onPress={() => toggle('preferred', language.id)} hint={`I enjoy listening to ${language.label}`} />
              <TogglePill label="Understand" on={understood.includes(language.id)} onPress={() => toggle('understood', language.id)} hint={`I understand ${language.label}`} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function LanguageStep() {
  const { languageGroups } = useOnboardingConfig();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string[]>([]);
  const shown = searchLanguages(languageGroups, search);
  const searching = search.trim().length > 0;

  return (
    <View style={{ gap: 10 }}>
      <Text variant="caption" color="textSecondary">
        <Text variant="caption">Enjoy</Text> shapes what we play. <Text variant="caption">Understand</Text> tells us which lyrics you can follow. Pick either or both.
      </Text>
      <SearchField value={search} onChange={setSearch} placeholder="Search languages" />
      {shown.map((group) => (
        <LanguageGroupCard
          key={group.id}
          group={group}
          // Matches are shown opened up.
          open={searching || open.includes(group.id)}
          onOpen={() => setOpen((ids) => (ids.includes(group.id) ? ids.filter((id) => id !== group.id) : [...ids, group.id]))}
        />
      ))}
      {shown.length === 0 ? (
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center', paddingVertical: 20 }}>
          No language matches “{search.trim()}”.
        </Text>
      ) : null}
    </View>
  );
}

// ---- Step 3: regions --------------------------------------------------------------------------------

export function RegionStep() {
  const { regions } = useOnboardingConfig();
  const chosen = useOnboardingStore((s) => s.regions);
  const toggle = useOnboardingStore((s) => s.toggleRegion);
  const mode = useOnboardingStore((s) => s.discoveryMode);
  const setMode = useOnboardingStore((s) => s.setDiscovery);

  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 10 }}>
        {regions.map((region) => (
          <ChoiceCard key={region.id} title={region.label} detail={region.areas.join(' · ')} on={chosen.includes(region.id)} onPress={() => toggle(region.id)} />
        ))}
      </View>
      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        <Text variant="title" accessibilityRole="header">
          How far shall we go?
        </Text>
        {DISCOVERY_MODES.map((m) => (
          <ChoiceCard key={m.id} one title={m.label} detail={m.description} on={mode === m.id} onPress={() => setMode(m.id)} />
        ))}
      </View>
    </View>
  );
}

// ---- Step 4: genres ---------------------------------------------------------------------------------

export function GenreStep() {
  const { genres } = useOnboardingConfig();
  const chosen = useOnboardingStore((s) => s.genres);
  const toggle = useOnboardingStore((s) => s.toggleGenre);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {genres.map((genre) => (
        <TogglePill key={genre.id} label={genre.label} on={chosen.includes(genre.id)} onPress={() => toggle(genre.id)} />
      ))}
    </View>
  );
}

// ---- Step 5: artists --------------------------------------------------------------------------------

function ArtistRow({ artist, on, onPress }: { artist: PickedArtist; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={artist.name}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, opacity: pressed ? 0.7 : 1 })}
    >
      <Avatar url={artist.avatarUrl} name={artist.name} size={48} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
          {artist.name}
        </Text>
        {artist.verified ? <VerifiedBadge size={15} /> : null}
      </View>
      <TogglePill role="button" label={on ? 'Added' : 'Add'} on={on} onPress={onPress} hint={`${on ? 'Remove' : 'Add'} ${artist.name}`} />
    </Pressable>
  );
}

export function ArtistStep({ onEmptyCatalogue }: { onEmptyCatalogue: (empty: boolean) => void }) {
  const c = useChoiceColors();
  const [search, setSearch] = useState('');
  const wanted = useDebouncedValue(search.trim(), 300);
  const picked = useOnboardingStore((s) => s.artists);
  const toggle = useOnboardingStore((s) => s.toggleArtist);
  const artists = useQuery({
    queryKey: ['onboarding', 'artists', wanted] as const,
    queryFn: () => onboardingApi.getArtists(wanted),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
  // With no artists to offer at all, the step cannot ask for one.
  const emptyCatalogue = !wanted && artists.data?.length === 0;
  useEffect(() => onEmptyCatalogue(emptyCatalogue), [emptyCatalogue, onEmptyCatalogue]);

  const message = (title: string, text: string, action?: { label: string; onPress: () => void }) => (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 12 }}>
      <Text variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        {text}
      </Text>
      {action ? <TogglePill role="button" label={action.label} on onPress={action.onPress} /> : null}
    </View>
  );

  return (
    <View style={{ gap: 14 }}>
      {picked.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption" color="textSecondary">
            {picked.length} chosen
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {picked.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => toggle(a)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${a.name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: c.chosen }}
              >
                <Text variant="caption">{a.name}</Text>
                <X size={13} color={c.text} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <>
          <SearchField value={search} onChange={setSearch} placeholder="Search artists" />
          {artists.isPending ? (
            <ActivityIndicator color={c.accent} style={{ paddingVertical: 28 }} />
          ) : artists.isError ? (
            message("Can't load artists", 'Check your connection and try again.', { label: 'Try again', onPress: () => void artists.refetch() })
          ) : artists.data.length === 0 ? (
            message(wanted ? 'No artist found' : 'No artists yet', wanted ? 'Try another name.' : 'You can carry on and follow artists later.')
          ) : (
            <View>
              {artists.data.map((artist) => (
                <ArtistRow key={artist.id} artist={artist} on={picked.some((a) => a.id === artist.id)} onPress={() => toggle(artist)} />
              ))}
            </View>
          )}
      </>
    </View>
  );
}
