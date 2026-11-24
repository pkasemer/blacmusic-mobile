import { File, Paths } from 'expo-file-system';

/**
 * Size of a picked file in bytes (always a plain number, even if the native side reports a BigInt), or 0 when the app cannot read it. The file system reports 0 for a file it
 * cannot stat (for example a link into another app's storage that was not copied into this one).
 */
export function sizeOf(file: File): number {
  try {
    const size = Number(file.size);
    if (size > 0) return size;
  } catch {
    // fall through to info()
  }
  try {
    return Number(file.info().size ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * A copy of the file that the app can read, so its size is known before anything is sent. A file that is
 * already readable is returned as it is. Returns `null` when the file cannot be read even after copying.
 */
export async function readable(file: File): Promise<File | null> {
  if (sizeOf(file) > 0) return file;
  try {
    const copy = new File(Paths.cache, `pick-${Date.now()}-${file.name || 'file'}`);
    await file.copy(copy);
    return sizeOf(copy) > 0 ? copy : null;
  } catch {
    return null;
  }
}
