import type { File } from 'expo-file-system';
import { toReview, type Review, type WireReview } from '@/domain/review';
import type { ReleaseType } from '@/domain/types';
import { reachable } from './config';
import { sizeOf } from '@/uploads/fileSize';
import { apiRequest } from './http';

/**
 * The artist's side of the backend: releases, cover art and track uploads. These only exist on the real
 * backend, so they are not part of `BlacApi` (which the sample data also implements).
 */

/** Version of the upload terms the artist agreed to. Stored by the backend next to the rights confirmation. */
export const TERMS_VERSION = '1';

export type ReleaseVisibility = 'draft' | 'scheduled' | 'public';

export interface ReleaseTrack {
  id: string;
  title: string;
  trackNumber?: number;
  durationSec: number;
  explicit: boolean;
}

/** A file that is still uploading, being processed, or failed. */
export interface PendingUpload {
  id: string;
  title: string;
  status: 'pending' | 'queued' | 'processing' | 'ready' | 'failed';
  error?: string;
  trackNumber?: number;
}

export interface ReleaseDetail {
  id: string;
  type: ReleaseType;
  title: string;
  description?: string;
  artistId: string;
  artistName: string;
  genre?: string;
  artworkUrl: string | null;
  visibility: ReleaseVisibility;
  /** When a scheduled release goes live (epoch ms). */
  publishAt: number | null;
  tracks: ReleaseTrack[];
  uploads: PendingUpload[];
  /** Publishing and changes need the Blac team's verification. */
  reviewRequired: boolean;
  /** What is waiting for verification, or was refused. */
  review?: Review;
}

interface WireReleaseDetail {
  reviewRequired?: boolean;
  review?: WireReview | null;
  id: string;
  type: string;
  title: string;
  description?: string;
  artist?: { id: string; name: string };
  genre?: string;
  artworkUrl?: string | null;
  visibility: ReleaseVisibility;
  publishAt?: string;
  tracks?: { id: string; title: string; trackNumber?: number; durationMs?: number; explicit?: boolean }[];
  uploads?: PendingUpload[];
}

const toDetail = (r: WireReleaseDetail): ReleaseDetail => ({
  id: r.id,
  type: r.type === 'album' ? 'album' : 'single',
  title: r.title,
  description: r.description,
  artistId: r.artist?.id ?? '',
  artistName: r.artist?.name ?? '',
  genre: r.genre,
  artworkUrl: reachable(r.artworkUrl),
  visibility: r.visibility,
  publishAt: r.publishAt ? Date.parse(r.publishAt) : null,
  tracks: (r.tracks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    trackNumber: t.trackNumber,
    durationSec: Math.round((t.durationMs ?? 0) / 1000),
    explicit: t.explicit ?? false,
  })),
  uploads: r.uploads ?? [],
  reviewRequired: r.reviewRequired === true,
  review: toReview(r.review),
});

/** The upload target the backend hands out: one PUT for small files, numbered parts for large ones. */
export type UploadTarget =
  | { type: 'single'; url: string }
  | { type: 'multipart'; partSize: number; partCount: number; parts: { number: number; url: string }[] };

export interface CreatedUpload {
  id: string;
  releaseId: string;
  target: UploadTarget;
}

interface WireTarget {
  type: 'single' | 'multipart';
  url?: string;
  partSize?: number;
  partCount?: number;
  parts?: { number: number; url: string }[];
}

const fixUrl = (url: string) => reachable(url) ?? url;

function toTarget(t: WireTarget): UploadTarget {
  if (t.type === 'multipart') {
    return {
      type: 'multipart',
      partSize: t.partSize as number,
      partCount: t.partCount as number,
      parts: (t.parts ?? []).map((p) => ({ number: p.number, url: fixUrl(p.url) })),
    };
  }
  return { type: 'single', url: fixUrl(t.url as string) };
}

export const studioApi = {
  // ---- Genres ----
  /** The standard genre list, most popular first. */
  async getGenres(): Promise<{ id: string; name: string }[]> {
    const data = await apiRequest<{ genres: { id: string; name: string }[] }>('/v1/genres');
    return data.genres;
  },

  // ---- Releases ----
  async createRelease(input: {
    type: 'single' | 'album';
    title: string;
    description?: string;
    genre?: string;
    coverImageId?: string;
  }): Promise<string> {
    const data = await apiRequest<{ id: string }>('/v1/releases', {
      method: 'POST',
      body: {
        type: input.type,
        title: input.title.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.genre?.trim() ? { genre: input.genre.trim() } : {}),
        ...(input.coverImageId ? { coverImageId: input.coverImageId } : {}),
      },
    });
    return data.id;
  },

  async getRelease(id: string): Promise<ReleaseDetail> {
    return toDetail(await apiRequest<WireReleaseDetail>(`/v1/releases/${encodeURIComponent(id)}`));
  },

  /** Changes a release's details. Empty text clears description and genre. Only fields that are present change. */
  async updateRelease(
    id: string,
    patch: { title?: string; description?: string; genre?: string; coverImageId?: string },
  ): Promise<void> {
    await apiRequest<unknown>(`/v1/releases/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
        ...(patch.genre !== undefined ? { genre: patch.genre.trim() } : {}),
        ...(patch.coverImageId ? { coverImageId: patch.coverImageId } : {}),
      },
    });
  },

  async updateTrack(id: string, patch: { title?: string }): Promise<void> {
    await apiRequest<unknown>(`/v1/tracks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { ...(patch.title !== undefined ? { title: patch.title.trim() } : {}) },
    });
  },

  /**
   * Makes a release public now, or schedules it for `publishAt` (epoch ms). Where verification is needed, this sends it
   * to the Blac team instead: it stays private until they approve it.
   */
  async publish(id: string, publishAt?: number): Promise<void> {
    await apiRequest<unknown>(`/v1/releases/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: publishAt ? { publishAt: new Date(publishAt).toISOString() } : {},
    });
  },

  async unpublish(id: string): Promise<void> {
    await apiRequest<unknown>(`/v1/releases/${encodeURIComponent(id)}/unpublish`, { method: 'POST', body: {} });
  },

  /** Takes back what is waiting for verification: a new release is a plain draft again, waiting changes are dropped. */
  async withdrawReview(id: string): Promise<void> {
    await apiRequest<unknown>(`/v1/releases/${encodeURIComponent(id)}/review/withdraw`, { method: 'POST', body: {} });
  },

  async deleteRelease(id: string): Promise<void> {
    await apiRequest<void>(`/v1/releases/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async deleteTrack(id: string): Promise<void> {
    await apiRequest<void>(`/v1/tracks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ---- Cover art ----
  /** Uploads a picture and returns its id, ready to attach to a release (cover) or to the profile (avatar). */
  async uploadImage(file: File, purpose: 'cover' | 'avatar'): Promise<string> {
    const size = sizeOf(file);
    if (size <= 0) throw new Error('The picture could not be read. Choose it again.');
    const created = await apiRequest<{ id: string; upload: { url: string } }>('/v1/images', {
      method: 'POST',
      body: { purpose, sizeBytes: size },
    });
    const put = await file.upload(fixUrl(created.upload.url), { httpMethod: 'PUT', sessionType: 'foreground' });
    if (put.status < 200 || put.status >= 300) {
      // Say what storage answered, so a bad link, a signature problem and a full disk are told apart.
      const reason = /<Code>([^<]+)<\/Code>/.exec(put.body ?? '')?.[1];
      throw new Error(`The picture could not be uploaded (${put.status}${reason ? `, ${reason}` : ''}).`);
    }
    await apiRequest<unknown>(`/v1/images/${created.id}/complete`, { method: 'POST', body: {} });
    return created.id;
  },

  /** Uploads a picture as cover art and returns its id, ready to attach to a release. */
  uploadCover(file: File): Promise<string> {
    return studioApi.uploadImage(file, 'cover');
  },

  // ---- Tracks ----
  async createUpload(input: {
    releaseId: string;
    title: string;
    filename: string;
    sizeBytes: number;
    genre?: string;
    trackNumber?: number;
    explicit?: boolean;
  }): Promise<CreatedUpload> {
    const data = await apiRequest<{ id: string; releaseId: string; upload: WireTarget }>('/v1/uploads', {
      method: 'POST',
      body: {
        releaseId: input.releaseId,
        title: input.title.trim(),
        filename: input.filename,
        sizeBytes: input.sizeBytes,
        explicit: input.explicit ?? false,
        ...(input.genre?.trim() ? { genre: input.genre.trim() } : {}),
        ...(input.trackNumber ? { trackNumber: input.trackNumber } : {}),
        rightsAccepted: true,
        termsVersion: TERMS_VERSION,
      },
    });
    return { id: data.id, releaseId: data.releaseId, target: toTarget(data.upload) };
  },

  /**
   * Swaps the audio of a track in a draft release: reserves a new upload with the old track's title, genre, track
   * number and explicit flag, then removes the old track. If the new file is refused, nothing changes.
   */
  async replaceTrackAudio(input: { trackId: string; filename: string; sizeBytes: number }): Promise<CreatedUpload> {
    const data = await apiRequest<{ id: string; releaseId: string; upload: WireTarget }>(`/v1/tracks/${encodeURIComponent(input.trackId)}/replace-audio`, {
      method: 'POST',
      body: { filename: input.filename, sizeBytes: input.sizeBytes, rightsAccepted: true, termsVersion: TERMS_VERSION },
    });
    return { id: data.id, releaseId: data.releaseId, target: toTarget(data.upload) };
  },

  /** For a resumed multipart upload: fresh links for only the parts storage does not have yet. */
  async getMissingParts(uploadId: string): Promise<{ number: number; url: string }[]> {
    const data = await apiRequest<{ parts: { number: number; url: string }[] }>(`/v1/uploads/${uploadId}/parts`);
    return data.parts.map((p) => ({ number: p.number, url: fixUrl(p.url) }));
  },

  async completeUpload(uploadId: string): Promise<void> {
    await apiRequest<unknown>(`/v1/uploads/${uploadId}/complete`, { method: 'POST', body: {} });
  },

  async getUploadStatus(uploadId: string): Promise<{ status: PendingUpload['status']; error?: string; trackId?: string }> {
    return apiRequest(`/v1/uploads/${uploadId}`);
  },

  async cancelUpload(uploadId: string): Promise<void> {
    await apiRequest<void>(`/v1/uploads/${uploadId}`, { method: 'DELETE' });
  },
};
