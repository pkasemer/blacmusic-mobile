import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, CirclePlay } from 'lucide-react-native';
import { useActiveTransfer } from '@/api/blac/youtubeQueries';
import type { Transfer } from '@/api/blac/youtube';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

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
 * Studio's way into the YouTube import. When a transfer is going on it shows where it is and reopens it (this is
 * how an artist gets back to it after closing the app); otherwise it invites the artist to start one.
 */
export function YouTubeCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const active = useActiveTransfer();
  const transfer = active.data;

  return (
    <Pressable
      onPress={() => {
        haptics.select();
        if (transfer) router.push({ pathname: '/youtube/transfer/[id]', params: { id: transfer.id } });
        else router.push('/youtube');
      }}
      accessibilityRole="button"
      accessibilityLabel={transfer ? `Import in progress. ${statusLine(transfer)}` : 'Import songs'}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Card style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
            <CirclePlay size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline">{transfer ? 'Import in progress' : 'Import songs'}</Text>
            <Text variant="caption" color="textSecondary">
              {transfer ? statusLine(transfer) : 'Bring songs over from YouTube, or add them by hand.'}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </View>
        {transfer && transfer.status === 'in_progress' ? <ProgressBar value={transfer.progress.percent / 100} /> : null}
      </Card>
    </Pressable>
  );
}
