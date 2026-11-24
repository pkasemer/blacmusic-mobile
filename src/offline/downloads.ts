import { Directory, File, Paths } from 'expo-file-system';
import { blacApi } from '@/api/blac';
import type { DownloadItem, Playable } from '@/domain/types';
import { useDownloadStore } from '@/store/downloadStore';
import { haptics } from '@/utils/haptics';

/**
 * Offline downloads. Files go in the app's private document folder (never shared storage or the media
 * library) under an id-based name, so nothing else on the phone can see or list them.
 *
 * Still to do (see the artist-mode spec): encrypt the files with a per-item key kept in the Keystore /
 * Keychain, exclude the folder from device backups (a native config step), and renew licences with the
 * backend. Today a copy simply expires after `licenceExpiresAt`.
 */

const MAX_PARALLEL = 2;
const PROGRESS_STEP = 0.02;

const folder = () => new Directory(Paths.document, 'blac-downloads');

/** AVPlayer on iOS needs a recognisable extension, so keep the one from the stream URL. */
function extensionOf(url: string): string {
  const match = url.split('?')[0].match(/\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i);
  return match ? match[1].toLowerCase() : 'mp3';
}

const running = new Map<string, AbortController>();
const waiting: Playable[] = [];

const store = () => useDownloadStore.getState();

/** Reason an item cannot be downloaded, or `null` when it can. */
export function downloadBlockReason(item: Playable): string | null {
  if (item.kind === 'track' && item.preview) return 'Not published yet.';
  return item.downloadable ? null : 'The artist has turned off downloads for this item.';
}

/** Adds an item to the download queue. Does nothing if it is already downloaded or in progress. */
export function downloadItem(item: Playable) {
  const existing = store().items[item.id];
  if (existing && (existing.state === 'done' || existing.state === 'downloading' || existing.state === 'queued')) return;
  if (downloadBlockReason(item)) return;

  const record: DownloadItem = {
    id: item.id,
    item,
    state: 'queued',
    progress: 0,
    localUri: null,
    sizeBytes: null,
    expiresAt: null,
    addedAt: Date.now(),
  };
  store().upsert(record);
  waiting.push(item);
  haptics.light();
  pump();
}

function pump() {
  while (running.size < MAX_PARALLEL && waiting.length > 0) {
    const next = waiting.shift() as Playable;
    void run(next);
  }
}

async function run(item: Playable) {
  const controller = new AbortController();
  running.set(item.id, controller);
  store().patch(item.id, { state: 'downloading', progress: 0 });
  try {
    const info = await blacApi.getDownloadInfo(item.id);
    const dir = folder();
    dir.create({ intermediates: true, idempotent: true });
    const target = new File(dir, `${item.id}.${extensionOf(info.url)}`);

    let lastReported = 0;
    const file = await File.downloadFileAsync(info.url, target, {
      idempotent: true,
      signal: controller.signal,
      // On iOS these can arrive as BigInt even though the types say number; Number() works for both.
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = Number(totalBytes);
        if (total <= 0) return;
        const progress = Math.min(1, Number(bytesWritten) / total);
        if (progress - lastReported >= PROGRESS_STEP) {
          lastReported = progress;
          store().patch(item.id, { progress });
        }
      },
    });

    store().patch(item.id, {
      state: 'done',
      progress: 1,
      localUri: file.uri,
      sizeBytes: Number(file.size ?? info.sizeBytes ?? 0) || null,
      expiresAt: info.licenceExpiresAt,
    });
    haptics.success();
  } catch {
    // A cancelled download is removed by `cancelDownload`; anything else can be retried by the user.
    if (!controller.signal.aborted) store().patch(item.id, { state: 'failed' });
  } finally {
    running.delete(item.id);
    pump();
  }
}

/** Stops an unfinished download and forgets it. */
export function cancelDownload(id: string) {
  const index = waiting.findIndex((w) => w.id === id);
  if (index >= 0) waiting.splice(index, 1);
  running.get(id)?.abort();
  deleteFileFor(id);
  store().remove(id);
}

/** Deletes the offline copy of one item. */
export function removeDownload(id: string) {
  cancelDownload(id);
  haptics.light();
}

export function removeAllDownloads() {
  [...running.keys()].forEach((id) => running.get(id)?.abort());
  waiting.length = 0;
  try {
    const dir = folder();
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to clean up.
  }
  store().clear();
}

/** Total bytes used by finished downloads. */
export function downloadedBytes(): number {
  return Object.values(store().items).reduce((sum, d) => sum + (d.state === 'done' ? (d.sizeBytes ?? 0) : 0), 0);
}

function deleteFileFor(id: string) {
  const uri = store().items[id]?.localUri;
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

/**
 * Call once at start-up: downloads that were interrupted by the app closing cannot resume (the transfer is
 * gone), so mark them failed and let the user retry. Also drops records whose file has disappeared.
 */
export function reconcileDownloads() {
  const { items, patch, remove } = store();
  Object.values(items).forEach((d) => {
    if (d.state === 'queued' || d.state === 'downloading') {
      patch(d.id, { state: 'failed' });
    } else if (d.state === 'done' && d.localUri) {
      try {
        if (!new File(d.localUri).exists) remove(d.id);
      } catch {
        remove(d.id);
      }
    }
  });
}

/** Retries a failed download. */
export function retryDownload(id: string) {
  const record = store().items[id];
  if (!record) return;
  store().remove(id);
  downloadItem(record.item);
}
