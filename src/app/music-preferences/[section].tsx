import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryAction } from '@/components/onboarding/parts';
import { ArtistStep, GenreStep, LanguageStep, RegionStep } from '@/components/onboarding/steps';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { missingFor, toPayload } from '@/domain/onboarding';
import { savePreferences, useMyPreferences } from '@/onboarding/preferences';
import { useOnboardingStore } from '@/store/onboardingStore';
import { showToast } from '@/store/toastStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const SECTIONS = {
  languages: { title: 'Languages', description: 'The languages you enjoy listening to, and the ones you understand.' },
  regions: { title: 'Regions and discovery', description: 'Where you would like your musical journey to take you.' },
  genres: { title: 'Genres', description: 'The genres you enjoy listening to.' },
  artists: { title: 'Favourite artists', description: 'Artists you enjoy. This does not change who you follow.' },
};

type Section = keyof typeof SECTIONS;

const answersNow = () => {
  const { preferred, understood, regions, discoveryMode, genres, artists } = useOnboardingStore.getState();
  return { preferred, understood, regions, discoveryMode, genres, artists };
};

/** One kind of choice, edited with the same controls as onboarding. Nothing changes until Save. */
function Editor({ section }: { section: Section }) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const state = useOnboardingStore();
  // How things were when the screen opened, to go back to if the changes are not saved.
  const [before] = useState(answersNow);
  const kept = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noArtists, setNoArtists] = useState(false);
  const onEmptyCatalogue = useCallback((empty: boolean) => setNoArtists(empty), []);
  const changed = JSON.stringify(toPayload(state)) !== JSON.stringify(toPayload(before));
  const missing = missingFor(section, state, noArtists);

  useEffect(
    () => () => {
      if (!kept.current) useOnboardingStore.getState().update(before);
    },
    [before],
  );

  usePreventRemove(changed && !saved, ({ data }) => {
    Alert.alert('Leave without saving?', 'Your changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  // Leave once the guard above is off.
  useEffect(() => {
    if (!saved) return;
    showToast('Preferences saved');
    router.back();
  }, [saved, router]);

  const save = async () => {
    setSaving(true);
    try {
      await savePreferences();
      kept.current = true;
      haptics.success();
      setSaved(true);
    } catch {
      haptics.error();
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 18, width: '100%', maxWidth: 560, alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text variant="body" color="textSecondary">
          {SECTIONS[section].description}
        </Text>
        {section === 'languages' ? (
          <LanguageStep />
        ) : section === 'regions' ? (
          <RegionStep />
        ) : section === 'genres' ? (
          <GenreStep />
        ) : (
          <ArtistStep onEmptyCatalogue={onEmptyCatalogue} />
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 4, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        {missing ? (
          <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', paddingBottom: 8 }} accessibilityLiveRegion="polite">
            {missing}
          </Text>
        ) : null}
        <PrimaryAction label="Save" busy={saving} disabled={!changed || !!missing || saved} onPress={() => void save()} />
      </View>
    </>
  );
}

export default function PreferenceSectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { colors } = useTheme();
  const loaded = useMyPreferences();

  if (!section || !(section in SECTIONS)) return <Redirect href="/music-preferences" />;
  const name = section as Section;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: SECTIONS[name].title }} />
      {loaded.isSuccess ? (
        <Editor section={name} />
      ) : loaded.isError ? (
        <ScreenState kind="error" title="Can't load your preferences" message="Check your connection and try again." actionLabel="Retry" onAction={() => void loaded.refetch()} />
      ) : (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your preferences" style={{ paddingVertical: 40 }} />
      )}
    </KeyboardAvoidingView>
  );
}
