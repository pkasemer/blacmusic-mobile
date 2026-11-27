import { ActivityIndicator, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { ArrowDownCircle, CheckCircle2, Download, Share2 } from 'lucide-react-native';
import type { Track } from '@/domain/types';
import { cancelDownload, downloadBlockReason, downloadItem } from '@/offline/downloads';
import { useDownloadStore } from '@/store/downloadStore';
import { haptics } from '@/utils/haptics';
import { shareLink } from '@/utils/share';
import { ActionButton, useSecondaryButton } from './DetailActions';

/**
 * Share button for an artist, album, playlist, song or podcast: opens the system share sheet with a message and a link that opens it in
 * Blac (`path` such as `/album/<id>`; the app's own link scheme is added).
 */
export function ShareLinkButton({ label, message, path }: { label: string; message: string; path: string }) {
  const button = useSecondaryButton();
  const share = () => {
    haptics.select();
    void shareLink(message, Linking.createURL(path));
  };
  return (
    <ActionButton label="Share" hint={label} onPress={share} icon={<Share2 size={17} color={button.ink} />} />
  );
}

/**
 * Download for offline listening. Saves every track the artist allows to be downloaded. The button shows the state:
 * Download, the count while saving, or Downloaded once everything is on the phone (tap to remove).
 * `what` is how the collection is called in messages ("album", "playlist").
 */
export function DownloadAllButton({ tracks, what }: { tracks: Track[]; what: string }) {
  const button = useSecondaryButton();
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
    <ActionButton
      label={shown}
      hint={label}
      onPress={press}
      active={allDone || busy}
      icon={
        allDone ? (
          <CheckCircle2 size={18} color={button.accent} />
        ) : busy ? (
          <ActivityIndicator size="small" color={button.accent} />
        ) : blocked ? (
          <ArrowDownCircle size={18} color={button.muted} />
        ) : (
          <Download size={17} color={button.ink} />
        )
      }
    />
  );
}
