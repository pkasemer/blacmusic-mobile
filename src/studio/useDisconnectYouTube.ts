import { useState } from 'react';
import { Alert } from 'react-native';
import { youtubeApi } from '@/api/blac/youtube';
import { youtubeErrorText, youtubeKeys } from '@/api/blac/youtubeQueries';
import { queryClient } from '@/api/queryClient';
import { haptics } from '@/utils/haptics';

/** Asks first, then takes Blac's access to the YouTube channel away. */
export function useDisconnectYouTube() {
  const [busy, setBusy] = useState(false);

  const disconnect = async () => {
    setBusy(true);
    try {
      await youtubeApi.disconnect();
      void queryClient.invalidateQueries({ queryKey: youtubeKeys.transfers });
      void queryClient.invalidateQueries({ queryKey: youtubeKeys.videos });
      await queryClient.refetchQueries({ queryKey: youtubeKeys.connection });
    } catch (e) {
      Alert.alert("Couldn't disconnect", youtubeErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    haptics.warning();
    Alert.alert(
      'Disconnect YouTube?',
      "Blac stops having access to your channel and forgets what it read. Songs you already imported stay on Blac. An unfinished transfer is cancelled.",
      [
        { text: 'Keep connected', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => void disconnect() },
      ],
    );
  };

  return { confirm, busy };
}
