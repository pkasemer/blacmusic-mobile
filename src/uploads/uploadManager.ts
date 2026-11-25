import { File, FileMode, UploadType } from 'expo-file-system';
import { ApiError } from '@/api/blac/http';
import { studioApi } from '@/api/blac/studio';
import { queryClient } from '@/api/queryClient';
import { useUploadStore, type UploadJob } from '@/store/uploadStore';
import { haptics } from '@/utils/haptics';
import { sizeOf } from './fileSize';

/**
 * Sends picked audio files to the backend.
 *
 * Small files (up to 16 MiB) go up in one request. Larger files are cut into 8 MiB parts that are sent
 * three at a time, and any part that fails is tried again; if the connection drops, "Try again" asks the
 * backend which parts it already has and sends only the rest. Once the file is in, the backend converts
 * it (a minute or less), and this file watches that until the track is ready.
 *
 * Jobs live in memory: if the app is closed mid-upload the backend discards the half-sent file after
 * about 90 minutes, and the artist adds the track again.
 */

const PART_PARALLEL = 3;
const PART_ATTEMPTS = 3;
const FILE_PARALLEL = 2;
const POLL_EVERY_MS = 2000;
const POLL_FOR_MS = 15 * 60 * 1000;

interface Handle {
  file: File;
  uploadId: string | null;
  multipart: { partSize: number; partCount: number } | null;
  title: string;
  genre?: string;
  trackNumber?: number;
  explicit: boolean;
  afterCreate?: (uploadId: string) => Promise<void>;
  handoff: boolean;
  /** Swap the audio of this finished track (in a draft release) instead of adding a new track. */
  replaceTrackId?: string;
}

const handles = new Map<string, Handle>();
const waiting: string[] = [];
let running = 0;

const store = () => useUploadStore.getState();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface TrackToUpload {
  file: File;
  title: string;
  explicit: boolean;
  trackNumber?: number;
  /**
   * Runs once the backend has created the upload, before the file is sent. The YouTube transfer uses it to tell
   * the transfer which song this audio is for.
   */
  afterCreate?: (uploadId: string) => Promise<void>;
  /**
   * For a YouTube transfer: the transfer converts the audio itself later, so the job counts as finished as soon as
   * the file is in, instead of waiting for processing.
   */
  handoff?: boolean;
  /** Replace the audio of this finished track of a draft release; it keeps its title, genre, number and explicit flag. */
  replaceTrackId?: string;
}

/** Queues files for a release. They start right away, two at a time. */
export function uploadTracks(releaseId: string, tracks: TrackToUpload[], genre?: string): string[] {
  return tracks.map((t) => {
    const key = `${releaseId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;
    const job: UploadJob = {
      key,
      releaseId,
      uploadId: null,
      title: t.title,
      filename: t.file.name || 'track',
      sizeBytes: sizeOf(t.file),
      state: 'waiting',
      progress: 0,
      error: null,
    };
    handles.set(key, {
      file: t.file,
      uploadId: null,
      multipart: null,
      title: t.title,
      genre,
      trackNumber: t.trackNumber,
      explicit: t.explicit,
      afterCreate: t.afterCreate,
      handoff: t.handoff === true,
      replaceTrackId: t.replaceTrackId,
    });
    store().add(job);
    waiting.push(key);
    pump();
    return key;
  });
}

/** Tries a failed job again. */
export function retryUpload(key: string) {
  const job = store().jobs[key];
  if (!job || job.state !== 'failed') return;
  store().patch(key, { state: 'waiting', error: null });
  waiting.push(key);
  pump();
}

/** Stops showing a finished or failed job; a half-sent upload is cancelled on the server too. */
export function dismissUpload(key: string) {
  const handle = handles.get(key);
  const job = store().jobs[key];
  if (handle?.uploadId && job && job.state !== 'ready' && job.state !== 'processing') {
    void studioApi.cancelUpload(handle.uploadId).catch(() => {});
  }
  handles.delete(key);
  const index = waiting.indexOf(key);
  if (index >= 0) waiting.splice(index, 1);
  store().remove(key);
}

function pump() {
  while (running < FILE_PARALLEL && waiting.length > 0) {
    const key = waiting.shift() as string;
    running++;
    void runJob(key).finally(() => {
      running--;
      pump();
    });
  }
}

const refreshStudio = () => {
  void queryClient.invalidateQueries({ queryKey: ['studio'] });
};

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'quota_exceeded') return 'Your storage is full. Add more storage on the Blac website, or delete something.';
    if (error.code === 'daily_limit') return "You've reached today's upload limit. Try again tomorrow, or ask for verification to raise it.";
    if (error.code === 'not_draft') return 'Only tracks in a draft can have their audio replaced. Take the release back to draft first.';
    if (error.code === 'limit_reached') return 'You have too many unfinished uploads. Finish or remove some first.';
    return error.message;
  }
  return error instanceof Error && error.message ? error.message : 'The upload did not finish.';
}

async function runJob(key: string) {
  const handle = handles.get(key);
  if (!handle) return;
  const job = store().jobs[key];
  if (!job) return;
  store().patch(key, { state: 'uploading', error: null });

  try {
    if (!handle.uploadId) {
      // The backend needs the size up front (it reserves that much of the artist's storage).
      if (job.sizeBytes <= 0) throw new Error('This file could not be read. Choose it again.');
      const created = handle.replaceTrackId
        ? await studioApi.replaceTrackAudio({ trackId: handle.replaceTrackId, filename: job.filename, sizeBytes: job.sizeBytes })
        : await studioApi.createUpload({
            releaseId: job.releaseId,
            title: handle.title,
            filename: job.filename,
            sizeBytes: job.sizeBytes,
            genre: handle.genre,
            trackNumber: handle.trackNumber,
            explicit: handle.explicit,
          });
      // The old track is gone now; if this upload has to start over, it starts as a plain new upload.
      handle.replaceTrackId = undefined;
      handle.uploadId = created.id;
      store().patch(key, { uploadId: created.id });
      await handle.afterCreate?.(created.id);
      refreshStudio();
      if (created.target.type === 'single') {
        await sendSingle(key, handle.file, created.target.url);
      } else {
        handle.multipart = { partSize: created.target.partSize, partCount: created.target.partCount };
        await sendParts(key, handle, created.target.parts);
      }
    } else if (handle.multipart) {
      // Resuming: ask which parts the server is still missing.
      let missing: { number: number; url: string }[];
      try {
        missing = await studioApi.getMissingParts(handle.uploadId);
      } catch (error) {
        // The server already moved on (queued, failed or discarded it): start over with a new upload.
        if (!(error instanceof ApiError) || (error.code !== 'not_pending' && error.code !== 'expired')) throw error;
        await studioApi.cancelUpload(handle.uploadId).catch(() => {});
        handle.uploadId = null;
        handle.multipart = null;
        return runJob(key);
      }
      await sendParts(key, handle, missing);
    } else {
      // A single-request upload cannot resume: start again with a new upload.
      await studioApi.cancelUpload(handle.uploadId).catch(() => {});
      handle.uploadId = null;
      return runJob(key);
    }

    await finish(key, handle);
    if (handle.handoff) {
      store().patch(key, { state: 'ready', progress: 1 });
      return;
    }
    store().patch(key, { state: 'processing', progress: 1 });
    await waitUntilReady(key, handle.uploadId as string);
  } catch (error) {
    store().patch(key, { state: 'failed', error: messageFor(error) });
    haptics.error();
  } finally {
    refreshStudio();
  }
}

async function sendSingle(key: string, file: File, url: string) {
  const result = await file.upload(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    sessionType: 'foreground',
    // On iOS these arrive as BigInt even though the types say number; Number() makes the maths work either way.
    onProgress: ({ bytesSent, totalBytes }) => {
      const total = Number(totalBytes);
      if (total > 0) store().patch(key, { progress: Math.min(0.99, Number(bytesSent) / total) });
    },
  });
  if (result.status < 200 || result.status >= 300) throw new Error('The file could not be sent. Check your connection.');
}

async function putPart(file: File, start: number, length: number, url: string) {
  const handle = file.open(FileMode.ReadOnly);
  let bytes: Uint8Array;
  try {
    handle.offset = start;
    bytes = await handle.readBytes(length);
  } finally {
    handle.close();
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { method: 'PUT', body: bytes as unknown as BodyInit });
      if (response.ok) return;
      throw new Error(`part rejected (${response.status})`);
    } catch {
      if (attempt >= PART_ATTEMPTS) throw new Error('A part of the file could not be sent. Check your connection and try again.');
      await sleep(800 * attempt);
    }
  }
}

/** Sends the given parts, three at a time, and keeps the progress bar moving as each one lands. */
async function sendParts(key: string, handle: Handle, parts: { number: number; url: string }[]) {
  const { partSize, partCount } = handle.multipart as { partSize: number; partCount: number };
  const total = sizeOf(handle.file);
  const alreadySent = Math.max(0, partCount - parts.length) / partCount;
  let sentBytes = 0;
  const queue = [...parts];

  const worker = async () => {
    for (let part = queue.shift(); part; part = queue.shift()) {
      const start = (part.number - 1) * partSize;
      const length = Math.min(partSize, total - start);
      await putPart(handle.file, start, length, part.url);
      sentBytes += length;
      store().patch(key, { progress: Math.min(0.99, alreadySent + sentBytes / Math.max(1, total)) });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PART_PARALLEL, parts.length) }, worker));
}

/** Tells the backend the file is in. If it says parts are missing, sends them and asks again. */
async function finish(key: string, handle: Handle) {
  const uploadId = handle.uploadId as string;
  let tries = 0;
  for (let round = 0; ; round++) {
    try {
      await studioApi.completeUpload(uploadId);
      return;
    } catch (error) {
      // A dropped connection can lose the answer even though the server got the request: ask again a couple of times,
      // and if the server says the upload is already finished, that is what we wanted.
      if (error instanceof ApiError && error.code === 'network' && ++tries <= 2) {
        await sleep(1000 * tries);
        round--;
        continue;
      }
      if (tries > 0 && error instanceof ApiError && error.status === 409) return;
      const missing = error instanceof ApiError && error.code === 'parts_missing';
      if (!missing || !handle.multipart || round >= 2) throw error;
      await sendParts(key, handle, await studioApi.getMissingParts(uploadId));
    }
  }
}

async function waitUntilReady(key: string, uploadId: string) {
  const deadline = Date.now() + POLL_FOR_MS;
  let missedChecks = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_EVERY_MS);
    if (!store().jobs[key]) return; // dismissed
    let status: Awaited<ReturnType<typeof studioApi.getUploadStatus>>;
    try {
      status = await studioApi.getUploadStatus(uploadId);
      missedChecks = 0;
    } catch (error) {
      // The file is already with the server, which carries on without us, so a missed check is not a failed upload.
      // When the server no longer knows the upload it has been turned into a track.
      if (error instanceof ApiError && error.status === 404) {
        store().patch(key, { state: 'ready' });
        return;
      }
      if (++missedChecks >= 6) throw error;
      continue;
    }
    if (status.status === 'ready') {
      store().patch(key, { state: 'ready' });
      haptics.success();
      return;
    }
    if (status.status === 'failed') throw new Error(status.error ?? 'The file could not be processed.');
  }
  throw new Error('Processing is taking longer than expected. It may still finish; check the Studio later.');
}
