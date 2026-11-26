import type { MoreList, MorePage } from '@/domain/more';
import type {
  Album,
  Playlist,
  PlaylistGroup,
  PlaylistDetail,
  AlbumDetail,
  Artist,
  Episode,
  Playable,
  Podcast,
  StorageQuota,
  StudioItem,
  Track,
} from '@/domain/types';

/** What the backend returns for an offline download: a short-lived URL and how long the offline licence lasts. */
export interface DownloadInfo {
  url: string;
  /** Epoch ms when the offline copy stops being playable until the app renews it online. */
  licenceExpiresAt: number;
  sizeBytes?: number;
}

/** Streaming quality: low data (48 kbps), standard (128) or high (256). */
export type StreamQuality = 'low' | 'medium' | 'high';

export interface PlaybackLink {
  url: string;
  /** Epoch ms when the link stops working, or null when it does not expire. */
  expiresAt: number | null;
}

export interface CreateArtistInput {
  name: string;
  bio?: string;
}

/**
 * Everything the app needs from the Blac backend. A mock implementation backs it today; when the
 * backend is ready, add an HTTP implementation of this interface and switch it in `index.ts`.
 * Screens never call fetch directly, only this interface (through the hooks in `queries.ts`).
 */
export interface BlacApi {
  // Listening
  getTrending(): Promise<Track[]>;
  getNewReleases(): Promise<Track[]>;
  searchTracks(query: string): Promise<Track[]>;
  getTrack(id: string): Promise<Track | null>;
  /** Popular public songs of one genre (a name from the genre list). */
  getTracksByGenre(genre: string): Promise<Track[]>;
  getArtistTracks(artistId: string): Promise<Track[]>;

  // Browsing (Home sections and the detail pages)
  /** Artists to show first on Home. */
  getFeaturedArtists(): Promise<Artist[]>;
  /** Popular albums and EPs (not singles) for the Home "Albums" section. */
  getAlbums(): Promise<Album[]>;
  /** The newest releases, one entry per album or single (never one per track), newest first. */
  getNewReleaseAlbums(): Promise<Album[]>;
  getArtist(id: string): Promise<Artist | null>;
  getArtistAlbums(artistId: string): Promise<Album[]>;
  /** Artists like this one, never the artist itself. */
  getRelatedArtists(artistId: string): Promise<Artist[]>;
  /** Releases like this one (same genre first), never the release itself. `genre` and `artistId` help when the server cannot say. */
  getRelatedAlbums(album: Album): Promise<Album[]>;
  /** The artist's most popular tracks, best first. */
  getArtistPopularTracks(artistId: string): Promise<Track[]>;
  getAlbum(id: string): Promise<AlbumDetail | null>;
  /** Playlists for the Home screen: the featured and most popular public ones. */
  getPlaylists(): Promise<Playlist[]>;
  /** The editorial groups for Home, in the order the backend gives them. Empty when the backend has none. */
  getPlaylistGroups(): Promise<PlaylistGroup[]>;
  /** One group with all its playlists, for its "See all" page. */
  getPlaylistGroup(id: string): Promise<PlaylistGroup | null>;
  /** The signed-in user's own playlists, recently changed first. */
  getMyPlaylists(): Promise<Playlist[]>;
  getPlaylist(id: string): Promise<PlaylistDetail | null>;
  /** The user's playlists; with `trackId`, each says whether that song is already in it. */
  getMyPlaylistsFor(trackId: string): Promise<Playlist[]>;
  /** Makes a playlist. It is private unless `isPublic` is true. */
  createPlaylist(input: { name: string; description?: string; isPublic?: boolean }): Promise<Playlist>;
  /** Changes a playlist the user owns. Only the fields given change; empty text clears the description. */
  updatePlaylist(id: string, patch: { name?: string; description?: string; isPublic?: boolean }): Promise<Playlist>;
  deletePlaylist(id: string): Promise<void>;
  addToPlaylist(playlistId: string, trackId: string): Promise<void>;
  removeFromPlaylist(playlistId: string, itemId: string): Promise<void>;
  /** Public playlists (editorial and user made) whose name, description or owner match the text. */
  searchPlaylists(query: string): Promise<Playlist[]>;
  /** Artists whose name matches. */
  searchArtists(query: string): Promise<Artist[]>;
  /** Albums, EPs and singles whose title (or artist) matches. */
  searchAlbums(query: string): Promise<Album[]>;
  /** Songs that sound like `track` (same genre or same artist), for "Start radio". The song itself is not included. */
  getSimilarTracks(track: Track): Promise<Track[]>;
  /** One page of a section's whole list, starting at `offset`. `ref` is the artist, album or group it belongs to. */
  getMorePage(list: MoreList, ref: string | undefined, offset: number): Promise<MorePage>;
  /** The newest releases of the artists the listener follows. Empty when they follow nobody. */
  getFollowedReleases(): Promise<Album[]>;
  /** Follows or unfollows an artist. */
  setFollowing(artistId: string, follow: boolean): Promise<void>;
  getPodcasts(): Promise<Podcast[]>;
  getEpisodes(podcastId: string): Promise<Episode[]>;
  /** Resolves a list of ids (for example from favourites or downloads) to playable items. */
  getPlayables(ids: string[]): Promise<Playable[]>;

  /**
   * Gets a link to stream an item. Links are short-lived (about an hour), so ask right before playing
   * and again when `expiresAt` is close.
   */
  getPlayback(id: string, quality?: StreamQuality): Promise<PlaybackLink>;

  /** Asks for permission and a signed URL to download an item. Rejects if downloads are not allowed. */
  getDownloadInfo(id: string): Promise<DownloadInfo>;

  // Artist mode
  /** The signed-in user's artist profile, or null when they have none. */
  getMyArtist(): Promise<Artist | null>;
  createArtistProfile(input: CreateArtistInput): Promise<Artist>;
  requestVerification(artistId: string): Promise<Artist>;
  getStudioItems(artistId: string): Promise<StudioItem[]>;
  getQuota(artistId: string): Promise<StorageQuota>;
}
