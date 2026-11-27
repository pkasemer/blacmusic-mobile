import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AudioLines, Languages, MapPinned, Mic } from 'lucide-react-native';
import { ScreenState } from '@/components/ScreenState';
import { SettingsGroup, SettingsRow, useGroupedColors } from '@/components/SettingsList';
import { DISCOVERY_MODES } from '@/domain/onboarding';
import { useMyPreferences } from '@/onboarding/preferences';
import { useOnboardingConfig } from '@/onboarding/useConfig';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** A few names, then how many more. */
const names = (all: string[]) => (all.length === 0 ? 'None chosen' : all.length > 3 ? `${all.slice(0, 3).join(', ')} +${all.length - 3} more` : all.join(', '));

/** The choices made during onboarding, each of which can be changed on its own. */
export default function MusicPreferencesScreen() {
  const router = useRouter();
  const g = useGroupedColors();
  const { colors } = useTheme();
  const loaded = useMyPreferences();
  const config = useOnboardingConfig();
  const chosen = useOnboardingStore();

  if (!loaded.isSuccess) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: g.page }}>
        {loaded.isError ? (
          <ScreenState kind="error" title="Can't load your preferences" message="Check your connection and try again." actionLabel="Retry" onAction={() => void loaded.refetch()} />
        ) : (
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your preferences" style={{ paddingVertical: 40 }} />
        )}
      </View>
    );
  }

  const open = (section: string) => {
    haptics.select();
    router.push({ pathname: '/music-preferences/[section]', params: { section } });
  };
  const languages = [
    chosen.preferred.length > 0 ? `${chosen.preferred.length} you enjoy` : null,
    chosen.understood.length > 0 ? `${chosen.understood.length} you understand` : null,
  ].filter(Boolean);
  const mode = DISCOVERY_MODES.find((m) => m.id === chosen.discoveryMode)?.label;
  const genres = chosen.genres.flatMap((id) => config.genres.find((x) => x.id === id)?.label ?? []);

  return (
    <ScrollView style={{ backgroundColor: g.page }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, gap: 28 }}>
      <SettingsGroup footer="Genres and favourite artists help choose the new songs in Your sound. Changes show gradually, from its next daily update, and songs you added stay. Languages and regions are saved, but don't change your music yet.">
        <SettingsRow icon={{ Icon: Languages }} title="Languages" subtitle={languages.join(' · ') || 'None chosen'} chevron onPress={() => open('languages')} />
        <SettingsRow
          icon={{ Icon: MapPinned }}
          title="Regions and discovery"
          subtitle={[count(chosen.regions.length, 'region'), mode].filter(Boolean).join(' · ')}
          chevron
          onPress={() => open('regions')}
        />
        <SettingsRow icon={{ Icon: AudioLines }} title="Genres" subtitle={names(genres)} chevron onPress={() => open('genres')} />
        <SettingsRow icon={{ Icon: Mic }} title="Favourite artists" subtitle={names(chosen.artists.map((a) => a.name))} chevron onPress={() => open('artists')} />
      </SettingsGroup>
    </ScrollView>
  );
}
