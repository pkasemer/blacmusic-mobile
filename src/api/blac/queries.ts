import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { blacApi } from './index';
import type { Album } from '@/domain/types';
import { FALLBACK_GENRES } from '@/domain/genres';
import { studioApi } from './studio';

const FIVE_MINUTES = 5 * 60 * 1000;

export const musicKeys = {
  trending: ['music', 'trending'] as const,
  newReleases: ['music', 'new'] as const,
  search: (q: string) => ['music', 'search', q] as const,
  podcasts: ['music', 'podcasts'] as const,
  episodes: (podcastId: string) => ['music', 'episodes', podcastId] as const,
  featuredArtists: ['music', 'featured-artists'] as const,
  albums: ['music', 'albums'] as const,
  newReleaseAlbums: ['music', 'new-release-albums'] as const,
  artist: (id: string) => ['music', 'artist', id] as const,
  artistAlbums: (id: string) => ['music', 'artist', id, 'albums'] as const,
  artistTracks: (id: string) => ['music', 'artist', id, 'tracks'] as const,
  album: (id: string) => ['music', 'album', id] as const,
  track: (id: string) => ['music', 'track', id] as const,
  followedReleases: ['music', 'followed-releases'] as const,
  playlists: ['music', 'playlists'] as const,
  playlistGroups: ['music', 'playlist-groups'] as const,
  playlistGroup: (id: string) => ['music', 'playlist-group', id] as const,
  myPlaylists: ['music', 'my-playlists'] as const,
  playlist: (id: string) => ['music', 'playlist', id] as const,
  playables: (ids: string[]) => ['music', 'playables', ids.join(',')] as const,
  studio: (artistId: string) => ['studio', artistId] as const,
  quota: (artistId: string) => ['studio', artistId, 'quota'] as const,
};

export const useFollowedReleases = () =>
  useQuery({ queryKey: musicKeys.followedReleases, queryFn: () => blacApi.getFollowedReleases(), staleTime: FIVE_MINUTES });

export const useTrending = () =>
  useQuery({ queryKey: musicKeys.trending, queryFn: () => blacApi.getTrending(), staleTime: FIVE_MINUTES });

export const useNewReleases = () =>
  useQuery({ queryKey: musicKeys.newReleases, queryFn: () => blacApi.getNewReleases(), staleTime: FIVE_MINUTES });

export const useTrackSearch = (query: string) =>
  useQuery({
    queryKey: musicKeys.search(query),
    queryFn: () => blacApi.searchTracks(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });

export const usePodcasts = () =>
  useQuery({ queryKey: musicKeys.podcasts, queryFn: () => blacApi.getPodcasts(), staleTime: FIVE_MINUTES });

export const useEpisodes = (podcastId: string) =>
  useQuery({
    queryKey: musicKeys.episodes(podcastId),
    queryFn: () => blacApi.getEpisodes(podcastId),
    staleTime: FIVE_MINUTES,
  });

export const useStudioItems = (artistId: string | undefined) =>
  useQuery({
    queryKey: musicKeys.studio(artistId ?? ''),
    queryFn: () => blacApi.getStudioItems(artistId as string),
    enabled: !!artistId,
    // A scheduled release turns Live on the server by itself; check back so the list catches up.
    refetchInterval: (query) => {
      const list = query.state.data;
      // Files going up or being converted change quickly: look every few seconds until they are done.
      if (list?.some((i) => i.status === 'uploading' || i.status === 'processing')) return 4_000;
      return list?.some((i) => i.visibility === 'scheduled') ? 30_000 : false;
    },
  });

/** One of the artist's releases with its tracks and files still being processed. Refreshes while work is going on. */
export const useRelease = (id: string) =>
  useQuery({
    queryKey: ['studio', 'release', id] as const,
    queryFn: () => studioApi.getRelease(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.uploads.some((u) => u.status !== 'ready' && u.status !== 'failed')) return 3000;
      return data?.visibility === 'scheduled' ? 30_000 : false;
    },
  });

export const useQuota =(artistId: string | undefined) =>
  useQuery({
    queryKey: musicKeys.quota(artistId ?? ''),
    queryFn: () => blacApi.getQuota(artistId as string),
    enabled: !!artistId,
  });

/** Resolves saved ids (favourites) to tracks and episodes. Ids the backend does not know are dropped. */
export const usePlayables = (ids: string[]) =>
  useQuery({
    queryKey: musicKeys.playables(ids),
    queryFn: () => blacApi.getPlayables(ids),
    enabled: ids.length > 0,
    // Playing or liking a song changes the ids: keep showing what is known while the new answer comes. Screens look
    // songs up by id, so one that is no longer asked for never shows.
    placeholderData: keepPreviousData,
    staleTime: FIVE_MINUTES,
  });

/** The genres to choose from: the backend's list when it has one, otherwise the built-in list. */
export const useGenres = () =>
  useQuery({
    queryKey: ['genres'] as const,
    queryFn: async () => {
      try {
        const genres = await studioApi.getGenres();
        return genres.length > 0 ? genres : FALLBACK_GENRES;
      } catch {
        // Not available yet (older backend) or offline: the built-in list is a fine stand-in.
        return FALLBACK_GENRES;
      }
    },
    staleTime: 24 * 60 * 60 * 1000,
    placeholderData: FALLBACK_GENRES,
  });

export const useFeaturedArtists = () =>
  useQuery({ queryKey: musicKeys.featuredArtists, queryFn: () => blacApi.getFeaturedArtists(), staleTime: FIVE_MINUTES });

export const useAlbums = () =>
  useQuery({ queryKey: musicKeys.albums, queryFn: () => blacApi.getAlbums(), staleTime: FIVE_MINUTES });

export const useArtist = (id: string) =>
  useQuery({ queryKey: musicKeys.artist(id), queryFn: () => blacApi.getArtist(id), enabled: !!id, staleTime: FIVE_MINUTES });

export const useArtistAlbums = (id: string) =>
  useQuery({ queryKey: musicKeys.artistAlbums(id), queryFn: () => blacApi.getArtistAlbums(id), enabled: !!id, staleTime: FIVE_MINUTES });

/** Artists like this one. */
export const useRelatedArtists = (id: string) =>
  useQuery({ queryKey: ['music', 'related-artists', id] as const, queryFn: () => blacApi.getRelatedArtists(id), enabled: !!id, staleTime: FIVE_MINUTES });

/** Releases like this one. */
export const useRelatedAlbums = (album: Album | undefined) =>
  useQuery({
    queryKey: ['music', 'related-albums', album?.id] as const,
    queryFn: () => blacApi.getRelatedAlbums(album as Album),
    enabled: !!album,
    staleTime: FIVE_MINUTES,
  });

/** The artist's most popular tracks. */
export const useArtistTracks = (id: string) =>
  useQuery({ queryKey: musicKeys.artistTracks(id), queryFn: () => blacApi.getArtistPopularTracks(id), enabled: !!id, staleTime: FIVE_MINUTES });

export const useAlbum = (id: string) =>
  useQuery({ queryKey: musicKeys.album(id), queryFn: () => blacApi.getAlbum(id), enabled: !!id, staleTime: FIVE_MINUTES });

export const useTrack = (id: string) =>
  useQuery({ queryKey: musicKeys.track(id), queryFn: () => blacApi.getTrack(id), enabled: !!id, staleTime: FIVE_MINUTES });

/** The newest releases: one entry per album or single. */
export const useNewReleaseAlbums = () =>
  useQuery({ queryKey: musicKeys.newReleaseAlbums, queryFn: () => blacApi.getNewReleaseAlbums(), staleTime: FIVE_MINUTES });

/** Featured and popular playlists for Home. */
export const usePlaylists = () =>
  useQuery({ queryKey: musicKeys.playlists, queryFn: () => blacApi.getPlaylists(), staleTime: FIVE_MINUTES });

export const useMyPlaylists = () =>
  useQuery({ queryKey: musicKeys.myPlaylists, queryFn: () => blacApi.getMyPlaylists(), staleTime: FIVE_MINUTES });

export const usePlaylist = (id: string) =>
  useQuery({ queryKey: musicKeys.playlist(id), queryFn: () => blacApi.getPlaylist(id), enabled: !!id, staleTime: 60_000 });

/** Playlists that match a search. Public ones only: the Blac team's picks first, then other people's public ones. */
export const useSearchPlaylists = (query: string) =>
  useQuery({
    queryKey: ['music', 'search-playlists', query] as const,
    queryFn: () => blacApi.searchPlaylists(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });

/** Artists that match a search. */
export const useSearchArtists = (query: string) =>
  useQuery({
    queryKey: ['music', 'search-artists', query] as const,
    queryFn: () => blacApi.searchArtists(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });

/** Albums, EPs and singles that match a search. */
export const useSearchAlbums = (query: string) =>
  useQuery({
    queryKey: ['music', 'search-albums', query] as const,
    queryFn: () => blacApi.searchAlbums(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });

/** Your playlists, each saying whether `trackId` is already in it. */
export const useMyPlaylistsFor = (trackId: string | null) =>
  useQuery({
    queryKey: ['music', 'my-playlists-for', trackId] as const,
    queryFn: () => blacApi.getMyPlaylistsFor(trackId as string),
    enabled: !!trackId,
    staleTime: 0,
  });

/** The named editorial groups of playlists for Home. */
export const usePlaylistGroups = () =>
  useQuery({ queryKey: musicKeys.playlistGroups, queryFn: () => blacApi.getPlaylistGroups(), staleTime: FIVE_MINUTES });

export const usePlaylistGroup = (id: string) =>
  useQuery({ queryKey: musicKeys.playlistGroup(id), queryFn: () => blacApi.getPlaylistGroup(id), enabled: !!id, staleTime: FIVE_MINUTES });

/** Popular songs of one genre, for tapping a genre tile on Search. `null` means no genre is chosen. */
export const useGenreTracks = (genre: string | null) =>
  useQuery({
    queryKey: ['music', 'genre-tracks', genre] as const,
    queryFn: () => blacApi.getTracksByGenre(genre as string),
    enabled: !!genre,
    staleTime: FIVE_MINUTES,
  });
