import { ActivityIndicator, Alert, Share } from 'react-native';
import * as Linking from 'expo-linking';
import { ArrowDownCircle, CheckCircle2, Download, Share2 } from 'lucide-react-native';
import type { Track } from '@/domain/types';
import { cancelDownload, downloadBlockReason, downloadItem } from '@/offline/downloads';
import { useDownloadStore } from '@/store/downloadStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { ActionPill } from './DetailActions';

/**
 * Share button for an artist, album, playlist, song or podcast: opens the system share sheet with a message and a link that opens it in
 * Blac (`path` such as `/album/<id>`; the app's own link scheme is added).
 */
export function ShareLinkButton({ label, message, path }: { label: string; message: string; path: string }) {
  const { colors } = useTheme();
  const share = async () => {
    haptics.select();
    const url = Linking.createURL(path);
    try {
      await Share.share({ message: `${message}\n${url}`, url });
    } catch {
      // The share sheet failing to open is not worth an error.
    }
  };
  return (
    <ActionPill label="Share" hint={label} onPress={share} icon={<Share2 size={17} color={colors.text} />} />
  );
}

/**
 * Download for offline listening. Saves every track the artist allows to be downloaded. The button shows the state:
 * Download, the count while saving, or Downloaded once everything is on the phone (tap to remove).
 * `what` is how the collection is called in messages ("album", "playlist").
 */
export function DownloadAllButton({ tracks, what }: { tracks: Track[]; what: string }) {
  const { colors } = useTheme();
  const items = useDownloadStore((s) => s.items);
  const eligible = tracks.filter((t) => !downloadBlockReason(t));
  const entries = eligible.map((t) => items[t.id]);
  const done = entries.filter((e) => e?.state === 'done').length;
  const busy = entries.some((e) => e && (e.state === 'queued' || e.state === 'downloading'));
  const allDone = eligible.length > 0 && done === eligible.length;
  const blocked = tracks.length > 0 && eligible.length === 0;
  const skipped = tracks.length - eligible.length;

  const label = blocked
    ? `The artists have turned off downloads for this ${what}`
    : allDone
      ? 'Downloaded. Tap to remove'
      : busy
        ? `Downloading ${done} of ${eligible.length}. Tap to cancel`
        : `Download ${what} for offline listening`;

  const press = () => {
    if (blocked) {
      Alert.alert('Downloads are off', `Downloads are turned off for the songs in this ${what}.`);
      return;
    }
    if (allDone || busy) {
      haptics.warning();
      Alert.alert(
        allDone ? 'Remove this download?' : 'Stop downloading?',
        allDone ? `The ${what} stays in Blac, but it will need a connection to play.` : 'Songs already saved stay on your phone.',
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: allDone ? 'Remove' : 'Stop',
            style: 'destructive',
            // Stopping keeps the songs that already finished; removing deletes all of them.
            onPress: () => eligible.forEach((t) => (!allDone && items[t.id]?.state === 'done' ? undefined : cancelDownload(t.id))),
          },
        ],
      );
      return;
    }
    haptics.medium();
    eligible.forEach((t) => downloadItem(t));
    if (skipped > 0) {
      Alert.alert('Some songs skipped', `${skipped} ${skipped === 1 ? 'song' : 'songs'} can't be downloaded because downloads are turned off for them.`);
    }
  };

  const shown = blocked ? 'Downloads off' : allDone ? 'Downloaded' : busy ? `Saving ${done}/${eligible.length}` : 'Download';
  return (
    <ActionPill
      label={shown}
      hint={label}
      onPress={press}
      active={allDone || busy}
      icon={
        allDone ? (
          <CheckCircle2 size={18} color={colors.accent} />
        ) : busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : blocked ? (
          <ArrowDownCircle size={18} color={colors.textTertiary} />
        ) : (
          <Download size={17} color={colors.text} />
        )
      }
    />
  );
}
