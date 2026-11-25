import { useRouter } from 'expo-router';
import { Upload } from 'lucide-react-native';
import { useActiveTransfer } from '@/api/blac/youtubeQueries';
import type { Transfer } from '@/api/blac/youtube';
import { haptics } from '@/utils/haptics';
import { SettingsRow } from './SettingsList';

/** One line about where an open transfer is. */
function statusLine(t: Transfer): string {
  const counted = t.items.filter((i) => i.status !== 'skipped_duplicate' && i.status !== 'dropped').length;
  switch (t.status) {
    case 'collecting':
      return 'Choose the audio files to start';
    case 'queued':
      return t.queue ? `Number ${t.queue.position} in line` : 'Waiting in line';
    case 'retrying':
      return 'Trying again shortly';
    default:
      return `${t.progress.itemsDone} of ${counted} songs done`;
  }
}

/**
 * Studio's way into importing songs, as a row. When an import is going on it says where it is and reopens it (this
 * is how an artist gets back to it after closing the app); otherwise it opens the list of ways to import.
 */
export function ImportSongsRow() {
  const router = useRouter();
  const active = useActiveTransfer();
  const transfer = active.data;

  return (
    <SettingsRow
      icon={{ Icon: Upload }}
      title={transfer ? 'Import in progress' : 'Import songs'}
      subtitle={transfer ? statusLine(transfer) : 'Bring songs over from your files, with more ways coming.'}
      chevron
      onPress={() => {
        haptics.select();
        if (transfer) router.push({ pathname: '/youtube/transfer/[id]', params: { id: transfer.id } });
        else router.push('/youtube');
      }}
    />
  );
}
