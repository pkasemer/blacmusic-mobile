import { shuffled } from '@/audio/music/queue';
import { toReview, type WireReview } from '@/domain/review';
import type { MoreItem, MorePage } from '@/domain/more';
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
  ProcessingStatus,
  ReleaseType,
  StorageQuota,
  StudioItem,
  Track,
  VerificationStatus,
} from '@/domain/types';
import { ApiError, apiRequest } from './http';
import { reachable } from './config';
import { albumsFromTracks, artistsFromTracks } from './derive';
import type { BlacApi, CreateArtistInput, StreamQuality } from './api';

/**
 * The real backend. Everything here turns the backend's JSON into the app's own types
 * (`src/domain/types.ts`), so screens never see the wire format.
 */

// ---- Wire shapes (only the fields the app reads) ---------------------------------------------------

interface WireTrack {
  id: string;
  title: string;
  artistId?: string;
  artistName: string;
  artistVerified?: boolean;
  featuredArtists?: WireFeature[] | null;
  hasLyrics?: boolean;
  albumId?: string | null;
  albumTitle?: string | null;
  durationMs?: number;
  artworkUrl?: string | null;
  artworkLargeUrl?: string | null;
  explicit?: boolean;
  genre?: string;
  downloadable?: boolean;
  loudnessLufs?: number | null;
  artistImageUrl?: string | null;
  releaseDate?: string;
  publishedAt?: string;
}

interface WireArtist {
  id: string;
  name: string;
  bio?: string;
  imageUrl?: string | null;
  imageLargeUrl?: string | null;
  verified?: boolean;
  verification?: VerificationStatus;
  followerCount?: number;
  releaseCount?: number;
  following?: boolean;
  /** Only on your own profile, and only when it is suspended. */
  banned?: boolean;
  /** Only on your own profile. */
  reviewRequired?: boolean;
  review?: WireReview | null;
  pending?: { name?: string | null; bio?: string | null; imageUrl?: string | null } | null;
}

interface WireUploadSummary {
  id: string;
  title: string;
  status: string;
  error?: string;
}

interface WireFeature {
  artistId?: string;
  name: string;
  imageUrl?: string | null;
  verified?: boolean;
}

interface WireRelease {
  review?: WireReview | null;
  featuredArtists?: WireFeature[] | null;
  id: string;
  type: string;
  /** What it is called to listeners: single, ep or album (an album of up to 6 tracks is an EP). */
  kind?: string;
  title: string;
  artworkUrl?: string | null;
  artworkLargeUrl?: string | null;
  visibility: 'draft' | 'scheduled' | 'public';
  publishAt?: string;
  releaseDate?: string;
  publishedAt?: string;
  genre?: string;
  description?: string;
  artist?: { id: string; name: string; verified?: boolean; imageUrl?: string | null; imageLargeUrl?: string | null };
  trackCount?: number;
  tracks?: unknown[];
  uploads?: WireUploadSummary[];
}

interface WireShow {
  id: string;
  title: string;
  author?: string;
  description?: string;
  imageUrl?: string | null;
}

interface WireEpisode {
  id: string;
  showId: string;
  showTitle?: string;
  title: string;
  description?: string;
  publishedAt?: string;
  durationMs?: number;
  imageUrl?: string | null;
}

// ---- Mapping ---------------------------------------------------------------------------------------

const toFeatured = (list: WireFeature[] | null | undefined) =>
  list?.map((a) => ({ id: a.artistId || null, name: a.name, imageUrl: reachable(a.imageUrl), verified: a.verified }));

const toTrack = (t: WireTrack): Track => ({
  kind: 'track',
  id: t.id,
  title: t.title,
  artistId: t.artistId ?? '',
  artistName: t.artistName,
  artistVerified: t.artistVerified,
  featuredArtists: toFeatured(t.featuredArtists),
  hasLyrics: t.hasLyrics,
  releaseId: t.albumId ?? null,
  albumTitle: t.albumTitle ?? null,
  artworkUrl: reachable(t.artworkUrl),
  artworkLargeUrl: reachable(t.artworkLargeUrl),
  durationSec: Math.round((t.durationMs ?? 0) / 1000),
  streamUrl: null,
  explicit: t.explicit ?? false,
  genre: t.genre,
  downloadable: t.downloadable ?? true,
  loudnessLufs: t.loudnessLufs ?? null,
  artistImageUrl: reachable(t.artistImageUrl),
  releaseDate: t.releaseDate ?? t.publishedAt,
});

const toArtist = (a: WireArtist): Artist => ({
  id: a.id,
  name: a.name,
  bio: a.bio,
  avatarUrl: reachable(a.imageUrl),
  avatarLargeUrl: reachable(a.imageLargeUrl),
  verification: a.verification ?? (a.verified ? 'verified' : 'unverified'),
  followerCount: a.followerCount,
  releaseCount: a.releaseCount,
  following: a.following,
  suspended: a.banned === true ? true : undefined,
  reviewRequired: a.reviewRequired === true ? true : undefined,
  review: toReview(a.review),
  pending: a.pending ? { name: a.pending.name ?? undefined, bio: a.pending.bio ?? undefined, avatarUrl: reachable(a.pending.imageUrl) } : undefined,
});

const toPodcast = (s: WireShow): Podcast => ({
  id: s.id,
  title: s.title,
  host: s.author ?? '',
  artworkUrl: reachable(s.imageUrl),
  description: s.description,
});

const toEpisode = (e: WireEpisode): Episode => ({
  kind: 'episode',
  id: e.id,
  podcastId: e.showId,
  podcastTitle: e.showTitle ?? '',
  title: e.title,
  artworkUrl: reachable(e.imageUrl),
  durationSec: Math.round((e.durationMs ?? 0) / 1000),
  streamUrl: null,
  publishedAt: e.publishedAt ?? new Date(0).toISOString(),
  downloadable: true,
  description: e.description,
});

function releaseStatus(r: WireRelease): { status: ProcessingStatus; problem?: string } {
  const uploads = r.uploads ?? [];
  const failed = uploads.find((u) => u.status === 'failed');
  if (failed) return { status: 'failed', problem: failed.error };
  if (uploads.some((u) => u.status === 'processing' || u.status === 'queued')) return { status: 'processing' };
  if (uploads.some((u) => u.status === 'pending')) return { status: 'uploading' };
  return { status: 'ready' };
}

const toStudioItem = (r: WireRelease): StudioItem => ({
  id: r.id,
  title: r.title,
  type: (r.type === 'album' || r.type === 'single' || r.type === 'ep' ? r.type : 'single') as ReleaseType,
  artworkUrl: reachable(r.artworkUrl),
  visibility: r.visibility,
  publishAt: r.publishAt ? Date.parse(r.publishAt) : null,
  trackCount: r.trackCount ?? r.tracks?.length ?? 0,
  review: toReview(r.review),
  ...releaseStatus(r),
});

interface WirePlaylist {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  owner?: { id: string; displayName?: string; name?: string };
  containsTrack?: boolean;
  isPublic?: boolean;
  isFeatured?: boolean;
  trackCount?: number;
  artworkUrl?: string | null;
  artworkLargeUrl?: string | null;
  artworkUrls?: string[];
}

const toPlaylist = (p: WirePlaylist): Playlist => ({
  id: p.id,
  name: p.name,
  description: p.description || undefined,
  ownerName: p.owner?.displayName ?? p.owner?.name,
  ownerId: p.owner?.id ?? p.ownerId,
  artworkUrl: reachable(p.artworkUrl),
  artworkLargeUrl: reachable(p.artworkLargeUrl),
  artworkUrls: (p.artworkUrls ?? []).flatMap((u) => {
    const url = reachable(u);
    return url ? [url] : [];
  }),
  trackCount: p.trackCount ?? 0,
  isPublic: p.isPublic ?? false,
  isFeatured: p.isFeatured,
  containsTrack: p.containsTrack,
});

interface WirePlaylistGroup {
  id: string;
  title: string;
  description?: string;
  playlistCount?: number;
  playlists?: WirePlaylist[];
}

const toPlaylistGroup = (g: WirePlaylistGroup): PlaylistGroup => ({
  id: g.id,
  title: g.title,
  description: g.description || undefined,
  playlistCount: g.playlistCount ?? g.playlists?.length ?? 0,
  playlists: (g.playlists ?? []).map(toPlaylist),
});

const releaseKind = (r: WireRelease): ReleaseType => {
  const kind = r.kind ?? r.type;
  return (kind === 'album' || kind === 'single' || kind === 'ep' ? kind : 'single') as ReleaseType;
};

const toAlbum = (r: WireRelease, fallbackArtist?: { id: string; name: string }): Album => ({
  id: r.id,
  type: releaseKind(r),
  title: r.title,
  artworkUrl: reachable(r.artworkUrl),
  artworkLargeUrl: reachable(r.artworkLargeUrl),
  artistId: r.artist?.id ?? fallbackArtist?.id ?? '',
  artistName: r.artist?.name ?? fallbackArtist?.name ?? '',
  artistVerified: r.artist?.verified,
  featuredArtists: toFeatured(r.featuredArtists),
  releaseDate: r.releaseDate ?? r.publishedAt,
  trackCount: r.trackCount ?? r.tracks?.length ?? 0,
  genre: r.genre,
  description: r.description,
});

// ---- Helpers ---------------------------------------------------------------------------------------

/** Settles every promise and keeps only the ones that worked. */
async function settled<T>(promises: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(promises);
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;
/** A server older than this app answers 404 or 405 for a call it does not have yet. */
const isMissing = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405);

const PAGE = 24;
/** For new releases from followed artists: how many of the most recently followed are read, and how many each. */
const FOLLOWED_LOOKED_AT = 30;
const NEW_PER_ARTIST = 3;
const MORE_PER_ARTIST = 20;

/** The home shelves: `new` is newest releases first; `popular` is most saved (real play counts come later). */
async function browseTracks(sort: 'new' | 'popular', limit: number): Promise<Track[]> {
  const data = await apiRequest<{ tracks: WireTrack[] }>('/v1/browse/tracks', { query: { sort, limit } });
  return data.tracks.map(toTrack);
}

/**
 * The albums and EPs the Blac team features, in the team's order; empty when they feature none. A server that cannot
 * feature releases yet refuses the request, and its popular albums stand in.
 */
async function featuredReleases(page: { limit: number; offset?: number }): Promise<{ releases: WireRelease[] }> {
  try {
    return await apiRequest('/v1/browse/albums', { query: { sort: 'featured', ...page } });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 400) throw error;
    return apiRequest('/v1/browse/albums', { query: { sort: 'popular', type: 'album', ...page } });
  }
}

/** The server has no "new from artists you follow" list, so it is put together from each followed artist's newest. */
async function followedReleases(perArtist: number): Promise<Album[]> {
  const { artists } = await apiRequest<{ artists: { id: string; name: string; verified?: boolean }[] }>('/v1/me/library/artists', {
    query: { limit: FOLLOWED_LOOKED_AT },
  });
  const lists = await Promise.allSettled(
    artists.map(async (artist) => {
      const data = await apiRequest<{ releases: WireRelease[] }>(`/v1/artists/${encodeURIComponent(artist.id)}/releases`, {
        query: { limit: perArtist },
      });
      return data.releases.map((r) => ({ ...toAlbum(r, artist), artistVerified: r.artist?.verified ?? artist.verified }));
    }),
  );
  // One artist that cannot be read does not hide the others; if none can, say so.
  if (artists.length > 0 && lists.every((l) => l.status === 'rejected')) throw (lists[0] as PromiseRejectedResult).reason;
  const releasedAt = (a: Album) => Date.parse(a.releaseDate ?? '') || 0;
  return lists.flatMap((l) => (l.status === 'fulfilled' ? l.value : [])).sort((a, b) => releasedAt(b) - releasedAt(a));
}

export const httpApi: BlacApi = {
  // ---- Listening ----
  // Only what is really trending: nothing else stands in, so a server that cannot tell (400) gives an empty list.
  getTrending: async () => {
    try {
      return (await apiRequest<{ tracks: WireTrack[] }>('/v1/browse/tracks', { query: { sort: 'trending', limit: 6 } })).tracks.map(toTrack);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) return [];
      throw error;
    }
  },
  getNewReleases: () => browseTracks('new', PAGE),

  searchTracks: async (query) => {
    const q = query.trim();
    if (!q) return [];
    const data = await apiRequest<{ tracks: WireTrack[] }>('/v1/search', { query: { q, limit: 50 } });
    return data.tracks.map(toTrack);
  },

  getTracksByGenre: async (genre) => {
    const data = await apiRequest<{ tracks: WireTrack[] }>('/v1/browse/tracks', { query: { sort: 'popular', genre, limit: 50 } });
    return data.tracks.map(toTrack);
  },

  getTrack: async (id) => {
    try {
      return toTrack(await apiRequest<WireTrack>(`/v1/tracks/${encodeURIComponent(id)}`));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  getArtistTracks: async (artistId) => {
    // Releases first, then each release's tracks.
    const releases = await apiRequest<{ releases: { id: string }[] }>(`/v1/artists/${encodeURIComponent(artistId)}/releases`, {
      query: { limit: 20 },
    });
    const full = await settled(
      releases.releases.map((r) => apiRequest<{ tracks: WireTrack[]; artist?: { id: string; name: string; verified?: boolean } }>(`/v1/releases/${r.id}`)),
    );
    return full.flatMap((r) =>
      r.tracks.map((t) => toTrack({ ...t, artistId, artistName: t.artistName ?? r.artist?.name ?? '', artistVerified: t.artistVerified ?? r.artist?.verified })),
    );
  },

  // ---- Browsing ----
  getFeaturedArtists: async () => {
    try {
      const data = await apiRequest<{ artists: WireArtist[] }>('/v1/browse/artists', { query: { sort: 'featured', limit: PAGE } });
      return data.artists.map(toArtist).filter((x) => x.verification === 'verified');
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // The backend has no artist list yet: use the artists behind the popular songs.
      return artistsFromTracks(await browseTracks('popular', 50)).filter((x) => x.verification === 'verified');
    }
  },

  getAlbums: async () => {
    try {
      const data = await featuredReleases({ limit: PAGE });
      return data.releases.map((r) => toAlbum(r));
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // The backend has no album list yet: use the multi-track releases behind the popular songs.
      return albumsFromTracks(await browseTracks('popular', 50)).filter((a) => a.type === 'album').slice(0, PAGE);
    }
  },

  getNewReleaseAlbums: async () => {
    try {
      const data = await apiRequest<{ releases: WireRelease[] }>('/v1/browse/albums', {
        query: { sort: 'new', type: 'all', limit: PAGE },
      });
      return data.releases.map((r) => toAlbum(r));
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // The backend has no album list yet: use the releases behind the newest songs, one entry each.
      return albumsFromTracks(await browseTracks('new', 50)).slice(0, PAGE);
    }
  },

  getArtist: async (id) => {
    try {
      return toArtist(await apiRequest<WireArtist>(`/v1/artists/${encodeURIComponent(id)}`));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  getRelatedArtists: async (artistId) => {
    try {
      const data = await apiRequest<{ artists: WireArtist[] }>(`/v1/artists/${encodeURIComponent(artistId)}/related`, { query: { limit: 12 } });
      return data.artists.map(toArtist);
    } catch (error) {
      if (!isMissing(error)) throw error;
      // The server has no "related" yet: other featured artists.
      return (await httpApi.getFeaturedArtists()).filter((a) => a.id !== artistId).slice(0, 12);
    }
  },

  getRelatedAlbums: async (album) => {
    try {
      const data = await apiRequest<{ releases: WireRelease[] }>(`/v1/releases/${encodeURIComponent(album.id)}/related`, { query: { limit: 12 } });
      return data.releases.map((r) => toAlbum(r));
    } catch (error) {
      if (!isMissing(error)) throw error;
      // The server has no "related" yet: releases found through songs of the same genre, then the newest ones.
      const sameGenre = album.genre ? albumsFromTracks(await httpApi.getTracksByGenre(album.genre).catch(() => [])) : [];
      const newest = await httpApi.getNewReleaseAlbums().catch(() => []);
      const seen = new Set<string>([album.id]);
      return [...sameGenre, ...newest].filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).slice(0, 12);
    }
  },

  getArtistAlbums: async (artistId) => {
    // A server that can rank whole releases says so with `sort`; an older one ignores the request and lists newest first.
    const data = await apiRequest<{ releases: WireRelease[]; sort?: string }>(`/v1/artists/${encodeURIComponent(artistId)}/releases`, {
      query: { sort: 'popular', limit: 50 },
    });
    return data.releases.map((r) => ({ ...toAlbum(r, { id: artistId, name: '' }), rankedByPopularity: data.sort === 'popular' }));
  },

  getArtistPopularTracks: async (artistId) => {
    try {
      const data = await apiRequest<{ tracks: WireTrack[] }>(`/v1/artists/${encodeURIComponent(artistId)}/tracks`, {
        query: { sort: 'popular', limit: 10 },
      });
      return data.tracks.map(toTrack);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // No per-artist track list yet: take the tracks from the artist's releases.
      return (await httpApi.getArtistTracks(artistId)).slice(0, 10);
    }
  },

  getAlbum: async (id) => {
    try {
      const r = await apiRequest<Omit<WireRelease, 'tracks'> & { tracks: WireTrack[] }>(`/v1/releases/${encodeURIComponent(id)}`);
      const album = toAlbum({ ...r, tracks: r.tracks });
      const tracks = r.tracks.map((t) =>
        toTrack({
          ...t,
          artistId: t.artistId ?? album.artistId,
          artistName: t.artistName ?? album.artistName,
          artistVerified: t.artistVerified ?? album.artistVerified,
          albumId: id,
          albumTitle: album.title,
          artworkUrl: t.artworkUrl ?? r.artworkUrl,
          artistImageUrl: t.artistImageUrl ?? r.artist?.imageUrl,
          releaseDate: t.releaseDate ?? album.releaseDate,
        }),
      );
      return { album, tracks } satisfies AlbumDetail;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  getPlaylists: async () => {
    try {
      const data = await apiRequest<{ playlists: WirePlaylist[] }>('/v1/browse/playlists', { query: { sort: 'featured', limit: PAGE } });
      return data.playlists.map(toPlaylist);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // The backend cannot list public playlists yet: show the user's own.
      return httpApi.getMyPlaylists();
    }
  },

  getPlaylistGroups: async () => {
    try {
      const data = await apiRequest<{ groups: WirePlaylistGroup[] }>('/v1/browse/playlist-groups', {
        query: { playlistsPerGroup: 10, limit: 20 },
      });
      return data.groups.map(toPlaylistGroup).filter((g) => g.playlists.length > 0);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      return []; // the backend has no groups yet: Home shows its plain Playlists row instead
    }
  },

  getPlaylistGroup: async (id) => {
    try {
      return toPlaylistGroup(
        await apiRequest<WirePlaylistGroup>(`/v1/browse/playlist-groups/${encodeURIComponent(id)}`, { query: { limit: 50 } }),
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  getMyPlaylists: async () => {
    const data = await apiRequest<{ playlists: WirePlaylist[] }>('/v1/me/playlists', { query: { limit: 100 } });
    return data.playlists.map(toPlaylist);
  },

  getPlaylist: async (id) => {
    try {
      const data = await apiRequest<WirePlaylist & { items?: { id: string; track: WireTrack }[] }>(`/v1/playlists/${encodeURIComponent(id)}`, {
        query: { limit: 200 },
      });
      const tracks = (data.items ?? []).map((i) => toTrack(i.track));
      const itemIds = (data.items ?? []).map((i) => i.id);
      const playlist = toPlaylist(data);
      // Until the backend sends covers, borrow the first songs' covers for the mosaic.
      if (!playlist.artworkUrl && playlist.artworkUrls.length === 0) {
        playlist.artworkUrls = tracks.flatMap((t) => (t.artworkUrl ? [t.artworkUrl] : [])).slice(0, 4);
      }
      playlist.trackCount = playlist.trackCount || tracks.length;
      return { playlist, tracks, itemIds } satisfies PlaylistDetail;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  getMyPlaylistsFor: async (trackId) => {
    const data = await apiRequest<{ playlists: WirePlaylist[] }>('/v1/me/playlists', { query: { limit: 100, trackId } });
    return data.playlists.map(toPlaylist);
  },

  createPlaylist: async (input) =>
    toPlaylist(
      await apiRequest<WirePlaylist>('/v1/playlists', {
        method: 'POST',
        body: {
          name: input.name.trim(),
          ...(input.description?.trim() ? { description: input.description.trim() } : {}),
          isPublic: input.isPublic === true,
        },
      }),
    ),

  updatePlaylist: async (id, patch) =>
    toPlaylist(
      await apiRequest<WirePlaylist>(`/v1/playlists/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: {
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
          ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
        },
      }),
    ),

  deletePlaylist: async (id) => {
    await apiRequest<void>(`/v1/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  addToPlaylist: async (playlistId, trackId) => {
    await apiRequest<unknown>(`/v1/playlists/${encodeURIComponent(playlistId)}/items`, { method: 'POST', body: { trackId } });
  },

  removeFromPlaylist: async (playlistId, itemId) => {
    await apiRequest<void>(`/v1/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  },

  searchPlaylists: async (query) => {
    const q = query.trim();
    if (!q) return [];
    try {
      const data = await apiRequest<{ playlists: WirePlaylist[] }>('/v1/search/playlists', { query: { q, limit: 20 } });
      return data.playlists.map(toPlaylist);
    } catch (error) {
      if (isNotFound(error)) return []; // the backend does not search playlists yet
      throw error;
    }
  },

  searchArtists: async (query) => {
    const q = query.trim();
    if (!q) return [];
    try {
      const data = await apiRequest<{ artists: WireArtist[] }>('/v1/search/artists', { query: { q, limit: 12 } });
      return data.artists.map(toArtist);
    } catch (error) {
      if (!isMissing(error)) throw error;
      // The server cannot search artists yet: use the artists behind the matching songs.
      return artistsFromTracks(await httpApi.searchTracks(q));
    }
  },

  searchAlbums: async (query) => {
    const q = query.trim();
    if (!q) return [];
    try {
      const data = await apiRequest<{ releases: WireRelease[] }>('/v1/search/albums', { query: { q, type: 'all', limit: 20 } });
      return data.releases.map((r) => toAlbum(r));
    } catch (error) {
      if (!isMissing(error)) throw error;
      // The server cannot search releases yet: use the releases behind the matching songs.
      return albumsFromTracks(await httpApi.searchTracks(q));
    }
  },

  getSimilarTracks: async (track) => {
    const byGenre = track.genre
      ? await apiRequest<{ tracks: WireTrack[] }>('/v1/browse/tracks', { query: { sort: 'popular', genre: track.genre, limit: 40 } })
          .then((d) => d.tracks.map(toTrack))
          .catch(() => [] as Track[])
      : [];
    const byArtist = track.artistId ? await httpApi.getArtistPopularTracks(track.artistId).catch(() => [] as Track[]) : [];
    const seen = new Set<string>([track.id]);
    const out: Track[] = [];
    for (const t of [...byGenre, ...byArtist]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    // A small catalogue may have nothing similar: fall back to what is popular.
    return out.length > 0 ? out : (await browseTracks('popular', 40)).filter((t) => t.id !== track.id);
  },

  getFollowedReleases: async () => (await followedReleases(NEW_PER_ARTIST)).slice(0, PAGE),

  getMorePage: async (list, ref, offset) => {
    const id = encodeURIComponent(ref ?? '');
    const page = { limit: PAGE, offset };
    /** A full page means there may be another. */
    const paged = <T>(rows: T[], toItem: (row: T) => MoreItem): MorePage => ({ items: rows.map(toItem), next: rows.length >= PAGE ? offset + rows.length : null });
    const albums = async (path: string, query: Record<string, string | number>) =>
      paged((await apiRequest<{ releases: WireRelease[] }>(path, { query })).releases, (r) => ({ kind: 'album', album: toAlbum(r) }));
    const playlists = async (path: string, query: Record<string, string | number> = page) =>
      paged((await apiRequest<{ playlists: WirePlaylist[] }>(path, { query })).playlists, (p) => ({ kind: 'playlist', playlist: toPlaylist(p) }));

    switch (list) {
      case 'featured-albums':
        return paged((await featuredReleases(page)).releases, (r) => ({ kind: 'album', album: toAlbum(r) }));
      case 'latest-releases':
        return albums('/v1/browse/albums', { sort: 'new', type: 'all', ...page });
      case 'artist-releases':
        return albums(`/v1/artists/${id}/releases`, { sort: 'popular', ...page });
      case 'playlists':
        return playlists('/v1/browse/playlists', { sort: 'featured', ...page });
      case 'group':
        return playlists(`/v1/browse/playlist-groups/${id}`);
      case 'podcasts': {
        const data = await apiRequest<{ shows: WireShow[] }>('/v1/me/shows', { query: page });
        return paged(data.shows, (show) => ({ kind: 'podcast', podcast: toPodcast(show) }));
      }
      case 'featured-artists': {
        const data = await apiRequest<{ artists: WireArtist[] }>('/v1/browse/artists', { query: { sort: 'featured', ...page } });
        const verified = data.artists.map(toArtist).filter((a) => a.verification === 'verified');
        // Verified artists are listed first, so the first page with anyone else on it is the last one needed.
        return {
          items: verified.map((artist) => ({ kind: 'artist', artist })),
          next: verified.length === data.artists.length && data.artists.length >= PAGE ? offset + data.artists.length : null,
        };
      }
      // The rest come all at once from the server.
      case 'new-releases':
        return { items: (await followedReleases(MORE_PER_ARTIST)).map((album) => ({ kind: 'album', album })), next: null };
      case 'related-artists': {
        const data = await apiRequest<{ artists: WireArtist[] }>(`/v1/artists/${id}/related`, { query: { limit: 50 } });
        return { items: data.artists.map((a) => ({ kind: 'artist', artist: toArtist(a) })), next: null };
      }
      case 'related-albums': {
        const data = await apiRequest<{ releases: WireRelease[] }>(`/v1/releases/${id}/related`, { query: { limit: 50 } });
        return { items: data.releases.map((r) => ({ kind: 'album', album: toAlbum(r) })), next: null };
      }
    }
  },

  getMix: async ({ reference, userId, reason, excludeIds, limit }) => {
    try {
      const data = await apiRequest<{ tracks: WireTrack[] }>('/v1/mixes', {
        method: 'POST',
        body: { trackId: reference.id, userId, reason, excludeTrackIds: excludeIds.slice(-200), limit },
      });
      return data.tracks.map(toTrack);
    } catch (error) {
      if (!isMissing(error)) throw error;
      // A server without mixes yet: other songs of the same genre, in a different order each time.
      if (!reference.genre) return [];
      const skip = new Set([reference.id, ...excludeIds]);
      const same = await httpApi.getTracksByGenre(reference.genre);
      return shuffled(same.filter((t) => !skip.has(t.id))).slice(0, limit);
    }
  },

  setFollowing: async (artistId, follow) => {
    await apiRequest<void>(`/v1/artists/${encodeURIComponent(artistId)}/follow`, { method: follow ? 'POST' : 'DELETE' });
  },

  getPodcasts: async () => {
    const data = await apiRequest<{ shows: WireShow[] }>('/v1/me/shows', { query: { limit: 50 } });
    return data.shows.map(toPodcast);
  },

  getEpisodes: async (podcastId) => {
    const data = await apiRequest<{ episodes: WireEpisode[] }>(`/v1/shows/${encodeURIComponent(podcastId)}/episodes`, {
      query: { limit: 100 },
    });
    return data.episodes.map(toEpisode);
  },

  getPlayables: async (ids) => {
    const items = await settled(
      ids.map(async (id): Promise<Playable | null> => {
        try {
          if (id.startsWith('trk_')) return toTrack(await apiRequest<WireTrack>(`/v1/tracks/${encodeURIComponent(id)}`));
          if (id.startsWith('epi_')) return toEpisode(await apiRequest<WireEpisode>(`/v1/episodes/${encodeURIComponent(id)}`));
        } catch (error) {
          if (!isNotFound(error)) throw error;
        }
        return null; // not music (for example a radio station id)
      }),
    );
    return items.filter((x): x is Playable => x !== null);
  },

  getPlayback: async (id, quality: StreamQuality = 'medium') => {
    const data = await apiRequest<{ playback: { url: string; expiresAt?: string } }>(
      `/v1/playback/${encodeURIComponent(id)}`,
      { query: { quality } },
    );
    return {
      url: reachable(data.playback.url) ?? data.playback.url,
      expiresAt: data.playback.expiresAt ? Date.parse(data.playback.expiresAt) : null,
    };
  },

  // The backend has no offline endpoint yet: this hands out the normal stream link with a 30 day licence.
  getDownloadInfo: async (id) => {
    const link = await httpApi.getPlayback(id, 'medium');
    return { url: link.url, licenceExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  },

  // ---- Artist mode ----
  getMyArtist: async () => {
    try {
      return toArtist(await apiRequest<WireArtist>('/v1/me/artist'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'no_artist') return null;
      throw error;
    }
  },

  createArtistProfile: async (input: CreateArtistInput) =>
    toArtist(
      await apiRequest<WireArtist>('/v1/artists', {
        method: 'POST',
        body: { name: input.name.trim(), ...(input.bio?.trim() ? { bio: input.bio.trim() } : {}) },
      }),
    ),

  requestVerification: async (artistId) =>
    toArtist(await apiRequest<WireArtist>(`/v1/artists/${encodeURIComponent(artistId)}/verification-request`, { method: 'POST', body: {} })),

  getStudioItems: async () => {
    const data = await apiRequest<{ releases: WireRelease[] }>('/v1/me/releases');
    return data.releases.map(toStudioItem);
  },

  getQuota: async (artistId) => {
    const q = await apiRequest<{ freeStorageBytes: number; purchasedStorageBytes: number; usedStorageBytes: number }>(
      `/v1/artists/${encodeURIComponent(artistId)}/quota`,
    );
    const quota: StorageQuota = {
      freeBytes: q.freeStorageBytes,
      purchasedBytes: q.purchasedStorageBytes,
      usedBytes: q.usedStorageBytes,
    };
    return quota;
  },
};
