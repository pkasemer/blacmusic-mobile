import { Directory, File, FileMode, Paths } from 'expo-file-system';

/**
 * Preloading: while a song plays, the next one is saved to a temporary file, so it starts at once and plays through
 * even if the connection drops. These files live in the app's private cache, only the last few are kept, and they are
 * all deleted when the player stops (which includes signing out). They are not downloads: nothing lists them.
 */

/** How many preloaded songs stay on the phone (the one playing, the next, and a few to go back to). */
const KEEP = 6;
/** After a failed preload, the same song is not tried again for this long. */
const RETRY_AFTER_MS = 60_000;

const folder = () => new Directory(Paths.cache, 'blac-preload');

interface Saved {
  id: string;
  uri: string;
}

/** Finished preloads, oldest first, by song and quality. */
const saved = new Map<string, Saved>();
const failedAt = new Map<string, number>();
let running: { key: string; id: string; stop: AbortController } | null = null;
let leftoversCleared = false;

const keyOf = (id: string, quality: string) => `${id}@${quality}`;

export function fileIsThere(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** True for a file this module made. */
export const isPreloadFile = (uri: string) => uri.includes('/blac-preload/');

function remove(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

/** The preloaded file of a song at this quality, if it is there. The phone may clear the cache at any time. */
export function preloadedUri(id: string, quality: string): string | null {
  const key = keyOf(id, quality);
  const entry = saved.get(key);
  if (!entry) return null;
  if (fileIsThere(entry.uri)) return entry.uri;
  saved.delete(key);
  return null;
}

/**
 * The right ending for a downloaded audio file, read from its first bytes: iPhone goes by the ending when it plays a
 * file. `null` for anything that is not an audio file it can play from the phone (an error page, a stream playlist).
 */
export function audioExtension(head: ArrayLike<number>): string | null {
  const text = (from: number, to: number) => String.fromCharCode(...Array.from(head).slice(from, to));
  if (text(4, 8) === 'ftyp') return 'm4a';
  if (text(0, 3) === 'ID3') return 'mp3';
  if (text(0, 4) === 'fLaC') return 'flac';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WAVE') return 'wav';
  if (head[0] === 0xff && (head[1] & 0xf6) === 0xf0) return 'aac';
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return 'mp3';
  return null;
}

async function firstBytes(file: File): Promise<Uint8Array> {
  const handle = file.open(FileMode.ReadOnly);
  try {
    return await handle.readBytes(12);
  } finally {
    handle.close();
  }
}

/** Stops the preload under way, if any. Finished ones stay. */
export function cancelPreload() {
  running?.stop.abort();
  running = null;
}

/**
 * Starts saving a song, unless it is saved or on its way already. Only one is saved at a time: asking for another
 * gives up the one under way. `keep` names the songs whose files must stay (the one playing and the next).
 */
export function startPreload(id: string, quality: string, link: () => Promise<string>, keep: ReadonlySet<string>) {
  const key = keyOf(id, quality);
  if (running?.key === key || preloadedUri(id, quality)) return;
  if (Date.now() - (failedAt.get(key) ?? 0) < RETRY_AFTER_MS) return;
  cancelPreload();
  const job = { key, id, stop: new AbortController() };
  running = job;
  void save(job, quality, link, keep);
}

async function save(job: { key: string; id: string; stop: AbortController }, quality: string, link: () => Promise<string>, keep: ReadonlySet<string>) {
  let part: File | null = null;
  try {
    const url = await link();
    if (job.stop.signal.aborted) return;
    const dir = folder();
    // Files from the last time the app ran are no longer tracked: clear them before the first new one.
    if (!leftoversCleared) {
      leftoversCleared = true;
      if (dir.exists) dir.delete();
    }
    dir.create({ intermediates: true, idempotent: true });
    const name = `${job.id.replace(/[^\w-]/g, '_')}-${quality}`;
    part = new File(dir, `${name}.part`);
    await File.downloadFileAsync(url, part, { idempotent: true, signal: job.stop.signal });
    if (job.stop.signal.aborted) return;

    const extension = audioExtension(await firstBytes(part));
    if (!extension) throw new Error('not an audio file');
    const finished = new File(dir, `${name}.${extension}`);
    if (job.stop.signal.aborted) return;
    remove(finished.uri);
    part.rename(`${name}.${extension}`);
    part = null;
    saved.delete(job.key);
    saved.set(job.key, { id: job.id, uri: finished.uri });
    trim(keep);
  } catch {
    // A preload is only a head start: the song streams as usual if it cannot be saved.
    if (!job.stop.signal.aborted) failedAt.set(job.key, Date.now());
  } finally {
    if (part) remove(part.uri);
    if (running === job) running = null;
  }
}

function trim(keep: ReadonlySet<string>) {
  for (const [key, entry] of saved) {
    if (saved.size <= KEEP) return;
    if (keep.has(entry.id)) continue;
    remove(entry.uri);
    saved.delete(key);
  }
}

/** Deletes preloaded songs: those named (a song that is no longer on Blac), or all of them. */
export function clearPreloads(ids?: ReadonlySet<string>) {
  if (!ids || (running && ids.has(running.id))) cancelPreload();
  for (const [key, entry] of saved) {
    if (ids && !ids.has(entry.id)) continue;
    remove(entry.uri);
    saved.delete(key);
  }
  if (ids) return;
  failedAt.clear();
  try {
    const dir = folder();
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to clean up.
  }
}
