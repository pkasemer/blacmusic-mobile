import { Alert } from 'react-native';
import { File } from 'expo-file-system';
import { readable } from './fileSize';

/** An audio file the artist chose, with the details they can still change before it is uploaded. */
export interface PickedTrack {
  key: string;
  file: File;
  title: string;
  explicit: boolean;
}

/** "my_new-song.mp3" becomes "my new song": a starting title the artist can edit. */
export const titleFromFilename = (name: string) =>
  name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';

/**
 * Opens the phone's file picker for audio and returns the readable files as tracks to review. Several files can be
 * chosen when `multiple` is set. Files that cannot be read (for example still in iCloud) are reported and left out.
 */
export async function pickAudioFiles(multiple: boolean): Promise<PickedTrack[]> {
  let files: File[];
  if (multiple) {
    const picked = await File.pickFileAsync({ mimeTypes: ['audio/*'], multipleFiles: true });
    if (picked.canceled) return [];
    files = picked.result;
  } else {
    const picked = await File.pickFileAsync({ mimeTypes: ['audio/*'] });
    if (picked.canceled) return [];
    files = [picked.result];
  }
  // Make sure every file can be read (and so has a size) before it goes in the list.
  const checked = await Promise.all(files.map(readable));
  const unreadable = checked.filter((f) => f === null).length;
  if (unreadable > 0) {
    Alert.alert(
      unreadable === 1 ? "Can't read that file" : "Can't read some files",
      'Download it to your phone first (for example from iCloud), then choose it again.',
    );
  }
  return checked
    .filter((f): f is File => f !== null)
    .map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, title: titleFromFilename(file.name), explicit: false }));
}
