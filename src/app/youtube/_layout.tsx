import { Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTheme } from '@/theme';

/** The YouTube import flow: connect, choose songs, then follow the transfer. One modal with its own back button. */
export default function YouTubeLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerRight: () => (
          <Pressable onPress={() => router.dismissAll()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Import from YouTube' }} />
      <Stack.Screen name="review" options={{ title: 'Choose songs' }} />
      <Stack.Screen name="transfer/[id]" options={{ title: 'Your transfer' }} />
    </Stack>
  );
}
