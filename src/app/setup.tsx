import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { USES_BACKEND } from '@/api/blac';
import { onboardingApi } from '@/api/blac/onboarding';
import { REQUIRE_EMAIL_CODE } from '@/api/blac/config';
import { AuthSheet, type AuthMode } from '@/components/AuthSheet';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { PrimaryAction, SetupFrame } from '@/components/onboarding/parts';
import { ArtistStep, GenreStep, LanguageStep, RegionStep } from '@/components/onboarding/steps';
import { Text } from '@/components/Text';
import { finishOnboarding, saveProgress } from '@/onboarding/finish';
import { useAuthStore } from '@/store/authStore';
import { SETUP_STEPS, useOnboardingStore, type SetupStep } from '@/store/onboardingStore';
import { haptics } from '@/utils/haptics';

const COPY: Record<Exclude<SetupStep, 'done'>, { title: string; description: string }> = {
  languages: {
    title: 'What languages do you love listening to?',
    description: "Select the languages you enjoy. We'll use your choices to discover music that feels familiar and introduce you to new sounds.",
  },
  regions: { title: "There's more to Uganda's sound.", description: 'Where would you like your musical journey to take you?' },
  genres: { title: "What's your kind of sound?", description: 'Choose the genres you enjoy listening to.' },
  artists: { title: 'Who are your favourites?', description: "Choose a few artists you enjoy. We'll use them to find music you'll love." },
};

/**
 * Onboarding, steps 2 to 6. One screen that shows the step saved on the phone, so going back and forth keeps every
 * choice and closing the app resumes where it was. Reached from the welcome screen, and again after creating the
 * account if there are steps left.
 */
export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const step = useOnboardingStore((s) => s.step);
  const goTo = useOnboardingStore((s) => s.goTo);
  const finishing = useOnboardingStore((s) => s.finishing);
  const signedIn = useAuthStore((s) => !USES_BACKEND || s.refreshToken !== null);
  const needsCode = useAuthStore((s) => REQUIRE_EMAIL_CODE && s.refreshToken !== null && s.user?.emailVerified === false);
  const [sheet, setSheet] = useState<AuthMode | null>(null);
  const [lastMode, setLastMode] = useState<AuthMode>('signup');

  const openAccount = () => {
    setLastMode('signup');
    setSheet('signup');
  };

  const position = SETUP_STEPS.indexOf(step);
  const next = () => {
    saveProgress();
    goTo(SETUP_STEPS[Math.min(position + 1, SETUP_STEPS.length - 1)]);
  };
  // Before the first step is the welcome screen, which only exists while signed out.
  const canGoBack = position > 0 || !signedIn;
  const back = useCallback(() => {
    if (position > 0) goTo(SETUP_STEPS[position - 1]);
    else if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  }, [position, goTo, router]);

  useEffect(() => {
    if (!canGoBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, back]);

  // Signing in to an account that finished onboarding before: nothing to ask again.
  useEffect(() => {
    if (!signedIn || needsCode) return;
    onboardingApi
      .getSaved()
      .then((saved) => {
        if (saved?.completed) useOnboardingStore.getState().abandon();
      })
      .catch(() => {});
  }, [signedIn, needsCode]);

  // "Start Listening" was tapped before there was an account: finish now that there is one.
  useEffect(() => {
    if (finishing && signedIn && !needsCode) void finishOnboarding();
  }, [finishing, signedIn, needsCode]);

  const start = () => {
    haptics.success();
    useOnboardingStore.getState().update({ finishing: true });
    if (!signedIn) openAccount();
  };

  return (
    <>
      <BrandBackdrop>
        {step === 'done' ? (
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
              <PrimaryAction label="Start Listening" onPress={start} busy={finishing && signedIn} />
              <Text onPress={() => goTo('artists')} accessibilityRole="button" variant="body" color="textSecondary" style={{ textAlign: 'center', padding: 12 }}>
                Back
              </Text>
            </View>
          </View>
        ) : (
          <SetupFrame
            key={step}
            // The welcome screen was step 1.
            step={position + 2}
            title={COPY[step].title}
            description={COPY[step].description}
            onBack={canGoBack ? back : undefined}
            onSkip={next}
            onContinue={next}
          >
            {step === 'languages' ? <LanguageStep /> : step === 'regions' ? <RegionStep /> : step === 'genres' ? <GenreStep /> : <ArtistStep onNeedAccount={openAccount} />}
          </SetupFrame>
        )}
      </BrandBackdrop>

      <AuthSheet
        visible={sheet !== null}
        mode={sheet ?? lastMode}
        onClose={() => setSheet(null)}
        onEmail={(mode) => router.push({ pathname: '/sign-in', params: { mode } })}
        onSwitchMode={() => setSheet((m) => (m === 'signin' ? 'signup' : 'signin'))}
      />
    </>
  );
}
