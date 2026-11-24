import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { ApiError, authApi } from '@/api/blac';
import { useAuthStore } from '@/store/authStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { BottomSheet } from './BottomSheet';
import { FormField } from './FormField';
import { Text } from './Text';

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'password_required' || e.code === 'invalid_password') return "That password isn't right.";
    if (e.code === 'busy') return 'One of your files is still being processed. Try again in a minute.';
    return e.message;
  }
  return 'Something went wrong. Try again.';
}

function DeleteForm() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const needsPassword = user?.hasPassword === true;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = !busy && (!needsPassword || password.length > 0);

  const confirm = () => {
    haptics.warning();
    Alert.alert('Delete your account for good?', 'This cannot be undone.', [
      { text: 'Keep my account', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            await authApi.deleteAccount(needsPassword ? password : undefined);
            haptics.success();
            // The tokens are gone, so the app moves to the Get started screen by itself.
          } catch (e) {
            haptics.error();
            setError(errorText(e));
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ paddingHorizontal: 20, gap: 14 }}>
      <Text variant="title">Delete your account</Text>
      <Text variant="body" color="textSecondary">
        This removes your account and everything in it: your playlists, favourites, listening history and downloads. If you are an artist, it also removes your
        artist profile, your releases and songs, and your YouTube connection. Apple or Google sign-in is not affected.
      </Text>

      {needsPassword ? (
        <FormField
          label="Your password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password to confirm"
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          autoComplete="current-password"
        />
      ) : null}

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={confirm}
        disabled={!canDelete}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignItems: 'center',
          paddingVertical: 15,
          borderRadius: radius.pill,
          backgroundColor: colors.danger,
          opacity: !canDelete ? 0.4 : pressed ? 0.85 : 1,
        })}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text variant="bodyStrong" style={{ color: '#FFFFFF' }}>
            Delete my account
          </Text>
        )}
      </Pressable>
    </View>
  );
}

/** Sheet for deleting the account. Needed by the App Store: anyone who can make an account can delete it in the app. */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {() => <DeleteForm />}
    </BottomSheet>
  );
}
