/**
 * Blac's own data model (music, podcasts, artists). These are what the UI works with; the API layer
 * (`src/api/blac`) maps whatever the backend sends into these shapes, so the backend can change
 * without touching screens.
 */

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Artist {
  id: string;
  name: string;
  bio?: string;
  avatarUrl: string | null;
  /** A bigger version of the picture, for the hero of the page. Absent when there is none. */
  avatarLargeUrl?: string | null;
  verification: VerificationStatus;
  monthlyListeners?: number;
  followerCount?: number;
  /** Public releases. */
  releaseCount?: number;
  /** Whether the signed-in user follows this artist. */
  following?: boolean;
  /** The Blac team suspended this artist profile, so the Studio is off. Only ever told to its owner. */
  suspended?: boolean;
}

export type ReleaseType = 'single' | 'ep' | 'album' | 'podcast-episode';

/** A single playable piece of music. */
export interface Track {
  kind: 'track';
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  /** The artist has the verified badge. Absent when the backend did not say. */
  artistVerified?: boolean;
  /** The song has lyrics. Absent when the backend did not say (the player then tries to load them). */
  hasLyrics?: boolean;
  /** The artist's profile picture, when the backend sends it with the track. */
  artistImageUrl?: string | null;
  releaseId: string | null;
  albumTitle: string | null;
  artworkUrl: string | null;
  /** A bigger version of the cover, for the hero of a detail page. Absent when there is none. */
  artworkLargeUrl?: string | null;
  /** Length in seconds. */
  durationSec: number;
  /**
   * A direct stream URL, when the source gives one (the sample data does). With the Blac backend this
   * is null: the link is short-lived, so it is fetched when the track is about to play.
   */
  streamUrl: string | null;
  explicit: boolean;
  genre?: string;
  /** Artists can switch downloads off for their own tracks. */
  downloadable: boolean;
  /** Measured loudness, to match volume between tracks. */
  loudnessLufs?: number | null;
  /** When the release went public (ISO date). */
  releaseDate?: string;
  /**
   * An artist is checking their own unpublished track in Studio. It plays like any track, but it is not a
   * listen: it stays out of recently played, and cannot be favourited or downloaded.
   */
  preview?: boolean;
}

export interface Podcast {
  id: string;
  title: string;
  host: string;
  artworkUrl: string | null;
  description?: string;
}

export interface Episode {
  kind: 'episode';
  id: string;
  podcastId: string;
  podcastTitle: string;
  title: string;
  artworkUrl: string | null;
  durationSec: number;
  /** See `Track.streamUrl`. */
  streamUrl: string | null;
  publishedAt: string;
  downloadable: boolean;
  description?: string;
}

/** Anything the queue can play. */
export type Playable = Track | Episode;

/** A public album, EP or single, as listed on Home and on an artist page. */
export interface Album {
  id: string;
  type: ReleaseType;
  title: string;
  artworkUrl: string | null;
  /** A bigger version of the cover, for the hero of a detail page. Absent when there is none. */
  artworkLargeUrl?: string | null;
  artistId: string;
  artistName: string;
  /** The artist has the verified badge. */
  artistVerified?: boolean;
  /** ISO date. */
  releaseDate?: string;
  trackCount: number;
  genre?: string;
  description?: string;
}

/** An album with its tracks in order. */
export interface AlbumDetail {
  album: Album;
  tracks: Track[];
}

/** A playlist of songs, made by a person or by the Blac team. */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  /** Who made it, for "By Amani". */
  ownerName?: string;
  ownerId?: string;
  /** A cover chosen for the playlist, when there is one. */
  artworkUrl: string | null;
  /** A bigger version of the cover, for the hero of a detail page. Absent when there is none. */
  artworkLargeUrl?: string | null;
  /** Covers of its first songs, drawn as a 2 by 2 mosaic when there is no chosen cover. */
  artworkUrls: string[];
  trackCount: number;
  isPublic: boolean;
  /** Picked by the Blac team to show first. */
  isFeatured?: boolean;
  /** For the signed-in user's playlists: the track asked about is already in it. */
  containsTrack?: boolean;
}

/** A named group of editorial playlists, shown as one shelf on Home ("Workout", "Throwback"). Set up on the backend. */
export interface PlaylistGroup {
  id: string;
  title: string;
  description?: string;
  /** How many playlists the whole group has (the shelf may show only the first few). */
  playlistCount: number;
  playlists: Playlist[];
}

/** A playlist with its songs in order. */
export interface PlaylistDetail {
  playlist: Playlist;
  tracks: Track[];
  /** The playlist entry id of each track, in the same order as `tracks`. Needed to remove one (a song can be in twice). */
  itemIds: string[];
}

export interface Release {
  id: string;
  type: ReleaseType;
  title: string;
  artistId: string;
  artistName: string;
  artworkUrl: string | null;
  releaseDate: string;
  visibility: 'draft' | 'scheduled' | 'public';
  trackIds: string[];
}

/** Per-track processing state after an upload (shown in Studio). */
export type ProcessingStatus = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';

export interface StudioItem {
  id: string;
  title: string;
  type: ReleaseType;
  artworkUrl: string | null;
  status: ProcessingStatus;
  visibility: Release['visibility'];
  trackCount: number;
  /** Why the newest upload failed, when `status` is `failed`. */
  problem?: string;
  plays?: number;
  /** When a scheduled release goes live (epoch ms). */
  publishAt?: number | null;
}

/** Artist storage allowance: 10 GB free, extra storage is bought on the website. */
export interface StorageQuota {
  freeBytes: number;
  purchasedBytes: number;
  usedBytes: number;
}

export const FREE_STORAGE_BYTES = 10 * 1024 ** 3;

export const totalQuotaBytes = (q: StorageQuota) => q.freeBytes + q.purchasedBytes;
export const remainingQuotaBytes = (q: StorageQuota) => Math.max(0, totalQuotaBytes(q) - q.usedBytes);

/** Offline copy of a track or episode. */
export type DownloadState = 'queued' | 'downloading' | 'paused' | 'done' | 'failed';

export interface DownloadItem {
  id: string;
  item: Playable;
  state: DownloadState;
  /** 0 to 1 */
  progress: number;
  /** Local file URI inside the app's private storage, once finished. */
  localUri: string | null;
  sizeBytes: number | null;
  /** When the offline licence runs out (epoch ms); the app must go online to renew. */
  expiresAt: number | null;
  addedAt: number;
}
