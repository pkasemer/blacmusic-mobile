import { Stack } from 'expo-router';

/** Always start on the welcome screen when nobody is signed in. */
export const unstable_settings = { anchor: 'welcome' };

/**
 * The signed-out screens: welcome, the feature tour and the email form. They are transparent: the brand backdrop is
 * drawn once at the root of the app, so moving between them never redraws it.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="onboarding" />
      {/* The email form draws its own back button. */}
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
