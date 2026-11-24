/**
 * Persistent on-disk image cache.
 *
 * Cover images are downloaded once into the app's cache folder and then loaded from disk, so they
 * are not fetched again, even after the app is closed and reopened. `getCacheStats` reports the
 * exact size and `clearImageCache` empties it (both used by Settings → Storage).
 *
 * `expo-file-system` is loaded lazily inside a try/catch: if its native part is missing from the
 * installed build, every function here degrades to "no cache" and images load from the network.
 */
type FileSystemModule = typeof import('expo-file-system');

let fs: FileSystemModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fs = require('expo-file-system') as FileSystemModule;
} catch {
  fs = null;
}

const FOLDER = 'sofiz-image-cache';

/** url → local file uri, for files we've already confirmed exist (skips disk checks). */
const known = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function hash(input: string, seed: number): string {
  let h = seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function fileNameFor(url: string): string {
  const ext = url.match(/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? 'img';
  return `${hash(url, 0x811c9dc5)}${hash(url, 0x01234567)}.${ext}`;
}

function folder() {
  if (!fs) return null;
  return new fs.Directory(fs.Paths.cache, FOLDER);
}

/** Local file uri if the image is already cached (synchronous, cheap), else `null`. */
export function getCachedFileUri(url: string): string | null {
  const remembered = known.get(url);
  if (remembered) return remembered;
  try {
    const dir = folder();
    if (!fs || !dir?.exists) return null;
    const file = new fs.File(dir, fileNameFor(url));
    if (file.exists && (file.size ?? 0) > 0) {
      known.set(url, file.uri);
      return file.uri;
    }
  } catch {
    // fall through: treat as not cached
  }
  return null;
}

/** Downloads the image into the cache (once) and returns its local uri, or `null` on failure. */
export function cacheImage(url: string): Promise<string | null> {
  const hit = getCachedFileUri(url);
  if (hit) return Promise.resolve(hit);
  if (!fs) return Promise.resolve(null);

  let promise = inflight.get(url);
  if (!promise) {
    const { File: FsFile } = fs;
    promise = (async () => {
      try {
        const dir = folder()!;
        if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
        const file = await FsFile.downloadFileAsync(url, new FsFile(dir, fileNameFor(url)), { idempotent: true });
        known.set(url, file.uri);
        return file.uri;
      } catch {
        return null;
      }
    })().finally(() => inflight.delete(url));
    inflight.set(url, promise);
  }
  return promise;
}

/** The raw bytes of an image: from the cache when possible, otherwise from the network. */
export async function readImageBytes(url: string): Promise<ArrayBuffer> {
  const local = await cacheImage(url);
  if (local && fs) {
    try {
      return await new fs.File(local).arrayBuffer();
    } catch {
      // unreadable cache file: fall back to the network
    }
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image request failed (${response.status})`);
  return response.arrayBuffer();
}

export interface CacheStats {
  bytes: number;
  count: number;
}

/** Total size and number of cached images. */
export function getCacheStats(): CacheStats {
  try {
    const dir = folder();
    if (!fs || !dir?.exists) return { bytes: 0, count: 0 };
    let bytes = 0;
    let count = 0;
    for (const entry of dir.list()) {
      if (entry instanceof fs.File) {
        bytes += Number(entry.size ?? 0);
        count += 1;
      }
    }
    return { bytes, count };
  } catch {
    return { bytes: 0, count: 0 };
  }
}

/** Deletes every cached image. */
export function clearImageCache(): void {
  known.clear();
  try {
    const dir = folder();
    if (dir?.exists) dir.delete();
  } catch {
    // nothing sensible to do; the next stats read shows what is left
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
