import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, authApi, USES_BACKEND } from '@/api/blac';
import { onboardingApi } from '@/api/blac/onboarding';
import { signOut } from '@/auth/session';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { ON_BRAND, PrimaryAction, SetupFrame } from '@/components/onboarding/parts';
import { ArtistStep, GenreStep, LanguageStep, RegionStep } from '@/components/onboarding/steps';
import { Text } from '@/components/Text';
import { missingFor } from '@/domain/onboarding';
import { finishOnboarding, saveProgress } from '@/onboarding/finish';
import { useAuthStore } from '@/store/authStore';
import { SETUP_STEPS, useOnboardingStore, type SetupStep } from '@/store/onboardingStore';
import { radius } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';

const COPY: Record<Exclude<SetupStep, 'done'>, { title: string; description: string }> = {
  profile: { title: 'What should we call you?', description: 'This is the name on your Blac profile. You can change it later in Settings.' },
  languages: {
    title: 'What languages do you love listening to?',
    description: "Select the languages you enjoy. We'll use your choices to discover music that feels familiar and introduce you to new sounds.",
  },
  regions: { title: "There's more to Uganda's sound.", description: 'Where would you like your musical journey to take you?' },
  genres: { title: "What's your kind of sound?", description: 'Choose the genres you enjoy listening to.' },
  artists: { title: 'Who are your favourites?', description: "Choose a few artists you enjoy. We'll use them to find music you'll love." },
};

const confirmSignOut = () =>
  Alert.alert('Sign out?', 'Your choices so far are not kept.', [
    { text: 'Stay', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
  ]);

/**
 * Setting up a new account: a name (for Apple and Google accounts), then the listener's tastes. It shows the step saved
 * on the phone, so going back keeps every choice and closing the app resumes where it was. It cannot be skipped: the
 * app opens when every step is done.
 */
export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const state = useOnboardingStore();
  const { step, goTo, finishing } = state;
  const userId = useAuthStore((s) => s.user?.id);
  const accountName = useAuthStore((s) => s.user?.displayName ?? '');
  // Apple and Google accounts have no password; an email account typed its name when signing up.
  const choosesName = useAuthStore((s) => s.user?.hasPassword === false);
  const [name, setName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [noArtists, setNoArtists] = useState(false);
  const [checked, setChecked] = useState(!USES_BACKEND);

  const steps = SETUP_STEPS.filter((s) => s !== 'profile' || choosesName);
  const current: SetupStep = steps.includes(step) ? step : steps[0];
  const position = steps.indexOf(current);

  // An account that finished onboarding before (signing in again) is not asked twice.
  useEffect(() => {
    if (!USES_BACKEND || !userId) return;
    onboardingApi
      .getSaved()
      .then((saved) => {
        if (saved?.completed) useOnboardingStore.getState().update({ status: 'done', ownerId: userId });
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [userId]);

  // Interrupted after "Start Listening": carry on finishing.
  useEffect(() => {
    if (finishing) void finishOnboarding();
  }, [finishing]);

  const back = useCallback(() => {
    if (position > 0) goTo(steps[position - 1]);
  }, [position, goTo, steps]);

  // Android's back button moves between steps; it never leaves onboarding.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const advance = () => {
    saveProgress();
    goTo(steps[Math.min(position + 1, steps.length - 1)]);
  };

  const typed = name ?? accountName;
  const saveName = async () => {
    const wanted = typed.trim();
    setNameError(null);
    if (wanted === accountName) {
      advance();
      return;
    }
    setSavingName(true);
    try {
      await authApi.updateProfile({ displayName: wanted });
      advance();
    } catch (e) {
      haptics.error();
      setNameError(e instanceof ApiError ? e.message : "Couldn't save your name. Check your connection and try again.");
    } finally {
      setSavingName(false);
    }
  };

  const onEmptyCatalogue = useCallback((empty: boolean) => setNoArtists(empty), []);

  if (!checked) {
    return (
      <BrandBackdrop>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ON_BRAND.accent} />
        </View>
      </BrandBackdrop>
    );
  }

  return (
    <BrandBackdrop>
      {current === 'done' ? (
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) + 8, paddingHorizontal: 28 }}>
          <Animated.View entering={FadeIn.duration(450)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
            <Image source={require('../../assets/splash-icon.png')} style={{ width: 96, height: 96 }} resizeMode="contain" />
            <Text variant="display" accessibilityRole="header" style={{ textAlign: 'center', fontSize: 34, lineHeight: 40 }}>
              {"We've got your sound."}
            </Text>
            <Text variant="body" color="textSecondary" style={{ textAlign: 'center', fontSize: 17, lineHeight: 24, maxWidth: 340 }}>
              Your music journey starts here. Discover familiar favourites, new artists and the sounds of Uganda.
            </Text>
          </Animated.View>
          <View style={{ gap: 6, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
            <PrimaryAction
              label="Start Listening"
              busy={finishing}
              onPress={() => {
                haptics.success();
                state.update({ finishing: true });
              }}
            />
            <Text onPress={() => goTo('artists')} accessibilityRole="button" variant="body" color="textSecondary" style={{ textAlign: 'center', padding: 12 }}>
              Back
            </Text>
          </View>
        </View>
      ) : (
        <SetupFrame
          key={current}
          step={position + 1}
          total={steps.length}
          title={COPY[current].title}
          description={COPY[current].description}
          onBack={position > 0 ? back : undefined}
          corner={position === 0 ? { label: 'Sign out', onPress: confirmSignOut } : undefined}
          missing={current === 'profile' ? (typed.trim().length >= 2 ? null : 'Enter at least two letters.') : missingFor(current, state, noArtists)}
          busy={savingName}
          onContinue={current === 'profile' ? () => void saveName() : advance}
        >
          {current === 'profile' ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={typed}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={ON_BRAND.quiet}
                accessibilityLabel="Your name"
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                maxLength={50}
                keyboardAppearance="dark"
                style={{ ...fontStyle('rounded', '500'), fontSize: 18, color: ON_BRAND.text, height: 56, paddingHorizontal: 20, borderRadius: radius.pill, borderWidth: 1, borderColor: ON_BRAND.line, backgroundColor: ON_BRAND.card }}
              />
              {nameError ? (
                <Text variant="caption" color="textSecondary">
                  {nameError}
                </Text>
              ) : null}
            </View>
          ) : current === 'languages' ? (
            <LanguageStep />
          ) : current === 'regions' ? (
            <RegionStep />
          ) : current === 'genres' ? (
            <GenreStep />
          ) : (
            <ArtistStep onEmptyCatalogue={onEmptyCatalogue} />
          )}
        </SetupFrame>
      )}
    </BrandBackdrop>
  );
}
