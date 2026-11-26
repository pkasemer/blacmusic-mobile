import { Directory, File, Paths } from 'expo-file-system';
import type { CacheStats } from './imageCache';

/**
 * The app's other temporary files, beside cover art: songs preloaded for playback, and the copies made of files picked
 * for upload (audio and pictures). Only these folders and files are ever looked at; downloads are not cache.
 */

const preloadFolder = () => new Directory(Paths.cache, 'blac-preload');

/** What the system's file and photo pickers leave behind, and the app's own copies (`pick-…`). */
function uploadLeftovers(): (File | Directory)[] {
  const cache = new Directory(Paths.cache);
  if (!cache.exists) return [];
  const pickers = ['DocumentPicker', 'ImagePicker'].map((name) => new Directory(Paths.cache, name)).filter((d) => d.exists);
  const copies = cache.list().filter((entry) => entry instanceof File && entry.name.startsWith('pick-'));
  return [...pickers, ...copies];
}

function measure(entries: (File | Directory)[]): CacheStats {
  const total = { bytes: 0, count: 0 };
  for (const entry of entries) {
    if (entry instanceof Directory) {
      const inside = measure(entry.list());
      total.bytes += inside.bytes;
      total.count += inside.count;
    } else {
      total.bytes += Number(entry.size ?? 0);
      total.count += 1;
    }
  }
  return total;
}

const safely = (read: () => CacheStats): CacheStats => {
  try {
    return read();
  } catch {
    return { bytes: 0, count: 0 };
  }
};

export const getPreloadStats = () => safely(() => measure(preloadFolder().exists ? [preloadFolder()] : []));

export const getUploadLeftoverStats = () => safely(() => measure(uploadLeftovers()));

/** Not to be called while something is uploading: those copies are what is being sent. */
export function clearUploadLeftovers(): void {
  try {
    for (const entry of uploadLeftovers()) entry.delete();
  } catch {
    // The next reading shows what is left.
  }
}
