import { USES_BACKEND, reachable } from './config';
import { apiRequest } from './http';

/**
 * YouTube import for artists: connect a channel, pick songs, add the audio, and watch a queued transfer.
 * The backend only reads titles, dates and thumbnails from YouTube; the artist supplies the audio files.
 */

/**
 * Where the backend sends the browser when Google sign-in is over. On iPhone the in-app sign-in sheet closes
 * itself when it reaches this address, so the app does not need to own the address's scheme. It must match the
 * backend's `YOUTUBE_APP_REDIRECT`.
 */
export const YOUTUBE_REDIRECT = process.env.EXPO_PUBLIC_YOUTUBE_REDIRECT ?? 'blacmusic://youtube/connected';

// ---- Types ------------------------------------------------------------------------------------------

export interface YouTubeConnection {
  connected: boolean;
  channel?: { id: string; title: string; thumbnailUrl?: string | null };
  connectedAt?: string;
  lastSyncedAt?: string;
  /** Google no longer accepts our access (the user revoked it): connect again. */
  needsReconnect: boolean;
  /** The server can fetch the audio of the artist's own videos itself. Absent or false: the artist adds every file. */
  audioImport?: boolean;
}

/** One song found on the channel. Lyric videos, visualizers and shorts of one song are grouped into it. */
export interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSec: number;
  thumbnailUrl?: string | null;
  kind: string;
  groupId: string;
  /** Other videos of the same song folded into this entry. */
  variants: string[];
  suggested: { title: string; releaseDate?: string; releaseType: 'single' | 'album' };
  /** A track with this title is already in the artist's catalogue. */
  alreadyImported: boolean;
}

export type TransferStatus = 'collecting' | 'queued' | 'in_progress' | 'retrying' | 'completed' | 'failed' | 'cancelled';

export type TransferItemStatus =
  | 'awaiting_audio'
  /** The server is getting the audio from YouTube (or waiting to try again; `error` may say so). */
  | 'fetching'
  | 'uploading'
  | 'waiting'
  | 'processing'
  | 'cover'
  | 'publishing'
  | 'done'
  | 'failed'
  | 'skipped_duplicate'
  | 'dropped';

export interface TransferItem {
  id: string;
  videoId: string;
  title: string;
  status: TransferItemStatus;
  percent: number;
  thumbnailUrl?: string | null;
  releaseType: 'single' | 'album';
  albumTitle: string;
  releaseId?: string;
  uploadId?: string | null;
  trackId?: string | null;
  error?: string | null;
  /** Where this song's audio comes from: the server fetches it from YouTube, or the artist uploads a file. */
  audioSource?: 'youtube' | 'upload';
  duplicateOf?: string;
  /** Present while the song needs (new) audio: what to send to the upload API. */
  upload?: { releaseId: string; title: string; genre?: string; trackNumber?: number; explicit: boolean };
}

export interface Transfer {
  id: string;
  status: TransferStatus;
  /** Only while `queued` or `retrying`. Position 1 is next. */
  queue: { position: number; length: number } | null;
  progress: { itemsTotal: number; itemsDone: number; itemsFailed: number; itemsSkipped: number; percent: number };
  attempt: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  error: string | null;
  reason: 'items_failed' | 'attempts_exhausted' | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  items: TransferItem[];
}

export interface NewTransferItem {
  /** Left out for a song that is not on YouTube (added by hand): then a `title` is required and the artist adds the file. */
  videoId?: string;
  /** "youtube": the server fetches the audio. "upload": the artist adds a file. Only sent when `audioImport` is on. */
  audio?: 'youtube' | 'upload';
  title?: string;
  releaseType?: 'single' | 'album';
  albumTitle?: string;
  genre?: string;
  releaseDate?: string;
  explicit?: boolean;
}

/** A transfer that is still going on (not finished, failed or cancelled). */
export const isOpenTransfer = (t: Pick<Transfer, 'status'>) =>
  t.status === 'collecting' || t.status === 'queued' || t.status === 'in_progress' || t.status === 'retrying';

export interface YouTubeApi {
  getConnection(): Promise<YouTubeConnection>;
  /** The page to open in the system browser to sign in with Google. */
  startConnect(): Promise<{ authUrl: string }>;
  disconnect(): Promise<void>;
  getVideos(options?: { refresh?: boolean }): Promise<{ videos: YouTubeVideo[]; syncedAt?: string }>;
  /** `rights` is the artist's confirmation that they own the songs; the server requires it when it fetches any audio. */
  createTransfer(items: NewTransferItem[], idempotencyKey: string, rights?: { termsVersion: string }): Promise<Transfer>;
  attachAudio(transferId: string, itemId: string, uploadId: string): Promise<Transfer>;
  /** Takes the file out of a song (while the transfer is still collecting): it goes back to waiting for audio. */
  removeAudio(transferId: string, itemId: string): Promise<Transfer>;
  dropItem(transferId: string, itemId: string): Promise<void>;
  submit(transferId: string): Promise<Transfer>;
  getTransfer(id: string): Promise<Transfer>;
  /** Newest first. */
  listTransfers(): Promise<Transfer[]>;
  cancel(transferId: string): Promise<Transfer>;
  retry(transferId: string): Promise<Transfer>;
}

// ---- The real backend -------------------------------------------------------------------------------

interface WireVideo extends Omit<YouTubeVideo, 'variants'> {
  variants?: string[];
  primary?: boolean;
}

const httpYouTube: YouTubeApi = {
  getConnection: () => apiRequest<YouTubeConnection>('/v1/integrations/youtube'),

  startConnect: async () => {
    const data = await apiRequest<{ authUrl: string }>('/v1/integrations/youtube/connect', { method: 'POST', body: {} });
    // On a local test server the sign-in page is on "localhost", which the phone cannot reach: point it at this computer.
    return { authUrl: reachable(data.authUrl) ?? data.authUrl };
  },

  disconnect: async () => {
    await apiRequest<void>('/v1/integrations/youtube', { method: 'DELETE' });
  },

  getVideos: async (options) => {
    const data = await apiRequest<{ videos: WireVideo[]; syncedAt?: string }>('/v1/integrations/youtube/videos', {
      query: { limit: 200, music: 1, ...(options?.refresh ? { refresh: 1 } : {}) },
    });
    return { videos: data.videos.map((v) => ({ ...v, variants: v.variants ?? [] })), syncedAt: data.syncedAt };
  },

  createTransfer: (items, idempotencyKey, rights) =>
    apiRequest<Transfer>('/v1/transfers', {
      method: 'POST',
      body: { items, ...(rights ? { rightsAccepted: true, termsVersion: rights.termsVersion } : {}) },
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  attachAudio: (transferId, itemId, uploadId) =>
    apiRequest<Transfer>(`/v1/transfers/${encodeURIComponent(transferId)}/items/${encodeURIComponent(itemId)}/audio`, {
      method: 'POST',
      body: { uploadId },
    }),

  removeAudio: (transferId, itemId) =>
    apiRequest<Transfer>(`/v1/transfers/${encodeURIComponent(transferId)}/items/${encodeURIComponent(itemId)}/audio`, { method: 'DELETE' }),

  dropItem: async (transferId, itemId) => {
    await apiRequest<void>(`/v1/transfers/${encodeURIComponent(transferId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  },

  submit: (transferId) => apiRequest<Transfer>(`/v1/transfers/${encodeURIComponent(transferId)}/submit`, { method: 'POST', body: {} }),

  getTransfer: (id) => apiRequest<Transfer>(`/v1/transfers/${encodeURIComponent(id)}`),

  listTransfers: async () => {
    const data = await apiRequest<{ transfers: Transfer[] }>('/v1/transfers', { query: { limit: 10 } });
    return data.transfers;
  },

  cancel: (transferId) => apiRequest<Transfer>(`/v1/transfers/${encodeURIComponent(transferId)}/cancel`, { method: 'POST', body: {} }),

  retry: (transferId) => apiRequest<Transfer>(`/v1/transfers/${encodeURIComponent(transferId)}/retry`, { method: 'POST', body: {} }),
};

// ---- Sample data (no backend) -----------------------------------------------------------------------

const wait = <T,>(value: T, ms = 300) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

let mockConnected = false;
let mockTransfer: Transfer | null = null;
let mockStartedAt = 0;

const MOCK_VIDEOS: YouTubeVideo[] = ['Mukene', 'Better', 'Blessed', 'Wanted'].map((title, i) => ({
  videoId: `demo-${i}`,
  title: `${title} (Official Audio)`,
  publishedAt: new Date(Date.UTC(2025, 6 - i, 11)).toISOString(),
  durationSec: 160 + i * 17,
  thumbnailUrl: null,
  kind: 'song',
  groupId: title.toLowerCase(),
  variants: i === 0 ? ['demo-0-lyr', 'demo-0-short'] : [],
  suggested: { title, releaseDate: `2025-0${7 - i}-11`, releaseType: 'single' },
  alreadyImported: i === 3,
}));

/** A made-up transfer that moves along by itself, so the screens can be tried without a backend. */
function mockProgress(): Transfer | null {
  const t = mockTransfer;
  if (!t) return null;
  if (t.status === 'queued' || t.status === 'in_progress' || t.status === 'completed') {
    const seconds = (Date.now() - mockStartedAt) / 1000;
    const counted = t.items.filter((i) => i.status !== 'skipped_duplicate' && i.status !== 'dropped');
    if (seconds < 6) {
      t.status = 'queued';
      t.queue = { position: seconds < 3 ? 2 : 1, length: 3 };
    } else {
      t.queue = null;
      const per = (seconds - 6) / 4; // each song takes about 4 seconds
      counted.forEach((item, index) => {
        const p = Math.max(0, Math.min(1, per - index * 0.6));
        item.percent = Math.round(p * 100);
        item.status = p >= 1 ? 'done' : p > 0.8 ? 'publishing' : p > 0.5 ? 'cover' : p > 0 ? 'processing' : 'waiting';
      });
      const done = counted.filter((i) => i.status === 'done').length;
      t.progress = { ...t.progress, itemsDone: done, percent: Math.round(counted.reduce((s, i) => s + i.percent, 0) / Math.max(1, counted.length)) };
      t.status = done === counted.length ? 'completed' : 'in_progress';
    }
  }
  return { ...t, items: t.items.map((i) => ({ ...i })) };
}

const mockYouTube: YouTubeApi = {
  getConnection: () =>
    wait<YouTubeConnection>(
      mockConnected
        ? { connected: true, channel: { id: 'demo', title: 'Akeine (demo channel)', thumbnailUrl: null }, connectedAt: new Date().toISOString(), needsReconnect: false }
        : { connected: false, needsReconnect: false },
    ),
  startConnect: async () => {
    mockConnected = true;
    return { authUrl: 'about:blank' };
  },
  disconnect: async () => {
    mockConnected = false;
    return wait(undefined, 150);
  },
  getVideos: () => wait({ videos: MOCK_VIDEOS, syncedAt: new Date().toISOString() }, 700),
  createTransfer: (items) => {
    mockTransfer = {
      id: 'tr_mock',
      status: 'collecting',
      queue: null,
      progress: { itemsTotal: items.length, itemsDone: 0, itemsFailed: 0, itemsSkipped: 0, percent: 0 },
      attempt: 1,
      maxAttempts: 5,
      nextAttemptAt: null,
      error: null,
      reason: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      items: items.map((it, i) => ({
        id: `item-${i}`,
        videoId: it.videoId ?? `manual:${i + 1}`,
        title: it.title ?? it.videoId ?? 'Song',
        status: 'awaiting_audio',
        percent: 0,
        releaseType: it.releaseType ?? 'single',
        albumTitle: it.albumTitle ?? '',
        upload: { releaseId: `rel-${i}`, title: it.title ?? it.videoId ?? 'Song', genre: it.genre, trackNumber: i + 1, explicit: it.explicit ?? false },
      })),
    };
    return wait({ ...mockTransfer });
  },
  attachAudio: async (_t, itemId) => {
    const item = mockTransfer?.items.find((i) => i.id === itemId);
    if (item) item.status = 'waiting';
    return wait({ ...(mockTransfer as Transfer) }, 200);
  },
  removeAudio: async (_t, itemId) => {
    const item = mockTransfer?.items.find((i) => i.id === itemId);
    if (item) item.status = 'awaiting_audio';
    return wait({ ...(mockTransfer as Transfer) }, 200);
  },
  dropItem: async (_t, itemId) => {
    const item = mockTransfer?.items.find((i) => i.id === itemId);
    if (item) item.status = 'dropped';
    return wait(undefined, 150);
  },
  submit: async () => {
    if (mockTransfer) {
      mockTransfer.status = 'queued';
      mockStartedAt = Date.now();
    }
    return wait({ ...(mockTransfer as Transfer) }, 300);
  },
  getTransfer: () => wait(mockProgress() as Transfer, 150),
  listTransfers: () => wait(mockTransfer ? [mockProgress() as Transfer] : [], 150),
  cancel: async () => {
    if (mockTransfer) mockTransfer.status = 'cancelled';
    return wait({ ...(mockTransfer as Transfer) }, 200);
  },
  retry: async () => wait({ ...(mockTransfer as Transfer) }, 200),
};

/** The real backend when the app has a server address, otherwise the made-up one. */
export const youtubeApi: YouTubeApi = USES_BACKEND ? httpYouTube : mockYouTube;
