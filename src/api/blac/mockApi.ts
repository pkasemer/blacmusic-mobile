import type { MorePage } from '@/domain/more';
import { FREE_STORAGE_BYTES, type Album, type Playlist, type PlaylistGroup, type PlaylistDetail, type AlbumDetail, type Artist, type Episode, type Podcast, type StudioItem, type Track } from '@/domain/types';
import type { BlacApi, CreateArtistInput } from './api';
import { albumsFromTracks, artistsFromTracks } from './derive';

/**
 * Placeholder data so every music screen can be built and tried before the backend exists.
 * Audio comes from the public SoundHelix demo tracks. Artwork is null, so the app draws its own
 * generated cover. Delete this once the real API is wired in.
 */
const sample = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

const ARTISTS = [
  { id: 'a1', name: 'Nyota' },
  { id: 'a2', name: 'Kato & The Drift' },
  { id: 'a3', name: 'Amani Rae' },
  { id: 'a4', name: 'Low Tide Club' },
] as const;

const TITLES = [
  'Midnight Static',
  'Golden Hour',
  'Paper Planes',
  'Slow Burn',
  'City Lights',
  'Violet Rain',
  'Echoes',
  'Afterglow',
  'North Star',
  'Quiet Riot',
  'Soft Landing',
  'Neon Garden',
];
const ALBUMS = ['Night Shift', 'Sunday', 'Open Roads', 'Static', 'Afterhours', 'Bloom'];
const GENRES = ['Afrobeats', 'R&B', 'Hip-Hop', 'Pop', 'Electronic', 'Soul'];

const TRACKS: Track[] = TITLES.map((title, i) => {
  const artist = ARTISTS[i % ARTISTS.length];
  return {
    kind: 'track',
    id: `t${i + 1}`,
    title,
    artistId: artist.id,
    artistName: artist.name,
    releaseId: `r${(i % 6) + 1}`,
    albumTitle: ALBUMS[i % ALBUMS.length],
    artworkUrl: null,
    durationSec: 180 + ((i * 37) % 120),
    streamUrl: sample((i % 16) + 1),
    explicit: i % 5 === 0,
    genre: GENRES[i % GENRES.length],
    downloadable: i !== 4,
    loudnessLufs: null,
  };
});

const PODCASTS: Podcast[] = [
  { id: 'p1', title: 'The Blac Hour', host: 'Amani Rae', artworkUrl: null, description: 'Conversations with the people behind the music.' },
  { id: 'p2', title: 'Studio Sessions', host: 'Kato', artworkUrl: null, description: 'Producers break down how a track gets made.' },
];

const EPISODES: Episode[] = PODCASTS.flatMap((p, pi) =>
  [1, 2, 3].map(
    (n): Episode => ({
      kind: 'episode',
      id: `e${pi + 1}-${n}`,
      podcastId: p.id,
      podcastTitle: p.title,
      title: `Episode ${n}`,
      artworkUrl: null,
      durationSec: 1500 + n * 240,
      streamUrl: sample(((pi * 3 + n) % 16) + 1),
      publishedAt: new Date(Date.UTC(2026, 10, 20 - n * 7)).toISOString(),
      downloadable: true,
      description: `${p.title}, episode ${n}.`,
    }),
  ),
);

const MINE: Playlist[] = [];
const MINE_TRACKS = new Map<string, { itemId: string; track: Track }[]>();

const PLAYLISTS: Playlist[] = [
  { id: 'pl1', name: 'Late Night Drive', description: 'Slow, warm and a little blue.', ownerName: 'Blac', artworkUrl: null, artworkUrls: [], trackCount: 6, isPublic: true, isFeatured: true },
  { id: 'pl2', name: 'Sunday Soul', description: 'Easy mornings.', ownerName: 'Blac', artworkUrl: null, artworkUrls: [], trackCount: 5, isPublic: true, isFeatured: true },
  { id: 'pl3', name: 'Gym Energy', ownerName: 'Blac', artworkUrl: null, artworkUrls: [], trackCount: 8, isPublic: true },
];

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockApi: BlacApi = {
  getTrending: () => delay(TRACKS.slice(0, 8)),
  getNewReleases: () => delay([...TRACKS].reverse().slice(0, 8)),
  searchTracks: (query) => {
    const q = query.trim().toLowerCase();
    return delay(
      q ? TRACKS.filter((t) => `${t.title} ${t.artistName} ${t.albumTitle ?? ''}`.toLowerCase().includes(q)) : TRACKS,
    );
  },
  getTracksByGenre: (genre) => delay(TRACKS.filter((t) => t.genre?.toLowerCase() === genre.toLowerCase())),
  getTrack: (id) => delay(TRACKS.find((t) => t.id === id) ?? null),
  getArtistTracks: (artistId) => delay(TRACKS.filter((t) => t.artistId === artistId)),
  getFeaturedArtists: () => delay(artistsFromTracks(TRACKS)),
  getAlbums: () => delay(albumsFromTracks(TRACKS).filter((a) => a.type === 'album')),
  getNewReleaseAlbums: () => delay(albumsFromTracks([...TRACKS].reverse())),
  getArtist: (id) => delay(artistsFromTracks(TRACKS).find((a) => a.id === id) ?? null),
  getPlaylists: () => delay(PLAYLISTS),
  getPlaylistGroups: () =>
    delay<PlaylistGroup[]>([
      { id: 'hits', title: "Today's biggest hits", playlistCount: 2, playlists: PLAYLISTS.slice(0, 2) },
      { id: 'chill', title: 'Chill', playlistCount: 2, playlists: PLAYLISTS.slice(1, 3) },
    ]),
  getPlaylistGroup: (id) =>
    delay<PlaylistGroup | null>(id === 'hits' ? { id, title: "Today's biggest hits", playlistCount: 2, playlists: PLAYLISTS.slice(0, 2) } : id === 'chill' ? { id, title: 'Chill', playlistCount: 2, playlists: PLAYLISTS.slice(1, 3) } : null),
  getMyPlaylists: () => delay<Playlist[]>([...MINE]),
  getMyPlaylistsFor: (trackId) =>
    delay<Playlist[]>(MINE.map((p) => ({ ...p, containsTrack: (MINE_TRACKS.get(p.id) ?? []).some((e) => e.track.id === trackId) }))),
  createPlaylist: (input) => {
    const playlist: Playlist = {
      id: `my-${Date.now().toString(36)}`,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      ownerName: 'You',
      artworkUrl: null,
      artworkUrls: [],
      trackCount: 0,
      isPublic: input.isPublic === true,
    };
    MINE.unshift(playlist);
    MINE_TRACKS.set(playlist.id, []);
    return delay(playlist);
  },
  updatePlaylist: (id, patch) => {
    const p = MINE.find((x) => x.id === id);
    if (!p) return Promise.reject(new Error('Not found'));
    if (patch.name !== undefined) p.name = patch.name.trim();
    if (patch.description !== undefined) p.description = patch.description.trim() || undefined;
    if (patch.isPublic !== undefined) p.isPublic = patch.isPublic;
    return delay({ ...p });
  },
  deletePlaylist: (id) => {
    const i = MINE.findIndex((x) => x.id === id);
    if (i >= 0) MINE.splice(i, 1);
    MINE_TRACKS.delete(id);
    return delay(undefined, 100);
  },
  addToPlaylist: (playlistId, trackId) => {
    const p = MINE.find((x) => x.id === playlistId);
    const track = TRACKS.find((t) => t.id === trackId);
    if (!p || !track) return Promise.reject(new Error('Not found'));
    (MINE_TRACKS.get(playlistId) ?? []).push({ itemId: `${playlistId}-${Date.now()}`, track });
    p.trackCount = (MINE_TRACKS.get(playlistId) ?? []).length;
    return delay(undefined, 100);
  },
  removeFromPlaylist: (playlistId, itemId) => {
    const list = MINE_TRACKS.get(playlistId) ?? [];
    const i = list.findIndex((e) => e.itemId === itemId);
    if (i >= 0) list.splice(i, 1);
    const p = MINE.find((x) => x.id === playlistId);
    if (p) p.trackCount = list.length;
    return delay(undefined, 100);
  },
  searchArtists: async (query) => artistsFromTracks(await mockApi.searchTracks(query)),
  searchAlbums: async (query) => albumsFromTracks(await mockApi.searchTracks(query)),
  searchPlaylists: (query) => {
    const q = query.trim().toLowerCase();
    return delay(q ? PLAYLISTS.filter((p) => p.name.toLowerCase().includes(q)) : []);
  },
  getPlaylist: (id) => {
    const mine = MINE.find((p) => p.id === id);
    if (mine) {
      const entries = MINE_TRACKS.get(id) ?? [];
      return delay<PlaylistDetail | null>({ playlist: { ...mine }, tracks: entries.map((e) => e.track), itemIds: entries.map((e) => e.itemId) });
    }
    const playlist = PLAYLISTS.find((p) => p.id === id);
    const offset = PLAYLISTS.findIndex((p) => p.id === id) * 2;
    const tracks = playlist ? TRACKS.slice(offset, offset + playlist.trackCount) : [];
    return delay<PlaylistDetail | null>(playlist ? { playlist, tracks, itemIds: tracks.map((t) => `${id}-${t.id}`) } : null);
  },
  getSimilarTracks: (track) => delay(TRACKS.filter((t) => t.id !== track.id && (t.genre === track.genre || t.artistId === track.artistId))),
  getFollowedReleases: () => delay<Album[]>([]),
  // The sample data is too small for a second page.
  getMorePage: () => delay<MorePage>({ items: [], next: null }),
  setFollowing: () => delay(undefined, 150),
  getRelatedArtists: (artistId) => delay(artistsFromTracks(TRACKS).filter((a) => a.id !== artistId)),
  getRelatedAlbums: (album) => delay(albumsFromTracks(TRACKS).filter((a) => a.id !== album.id)),
  getArtistAlbums: (artistId) => delay(albumsFromTracks(TRACKS).filter((a) => a.artistId === artistId)),
  getArtistPopularTracks: (artistId) => delay(TRACKS.filter((t) => t.artistId === artistId).slice(0, 10)),
  getAlbum: (id) => {
    const tracks = TRACKS.filter((t) => t.releaseId === id);
    const album: Album | undefined = albumsFromTracks(TRACKS).find((a) => a.id === id);
    return delay<AlbumDetail | null>(album ? { album, tracks } : null);
  },
  getPodcasts: () => delay(PODCASTS),
  getEpisodes: (podcastId) => delay(EPISODES.filter((e) => e.podcastId === podcastId)),
  getPlayables: (ids) =>
    delay(
      ids
        .map((id) => TRACKS.find((t) => t.id === id) ?? EPISODES.find((e) => e.id === id))
        .filter((x): x is Track | Episode => !!x),
    ),

  getPlayback: async (id) => {
    const item = TRACKS.find((t) => t.id === id) ?? EPISODES.find((e) => e.id === id);
    if (!item?.streamUrl) throw new Error('Not found');
    return { url: item.streamUrl, expiresAt: null };
  },

  getDownloadInfo: async (id) => {
    const item = TRACKS.find((t) => t.id === id) ?? EPISODES.find((e) => e.id === id);
    if (!item?.streamUrl) throw new Error('Not found');
    if (!item.downloadable) throw new Error('The artist has turned off downloads for this item.');
    return delay({ url: item.streamUrl, licenceExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  },

  getMyArtist: () => delay<Artist | null>(null),
  createArtistProfile: (input: CreateArtistInput) =>
    delay<Artist>({
      id: `artist-${Date.now().toString(36)}`,
      name: input.name.trim(),
      bio: input.bio?.trim() || undefined,
      avatarUrl: null,
      verification: 'unverified',
    }),
  requestVerification: (artistId) =>
    delay<Artist>({ id: artistId, name: '', avatarUrl: null, verification: 'pending' }),
  getStudioItems: () =>
    delay<StudioItem[]>([
      { id: 's1', title: 'Midnight Static', type: 'single', artworkUrl: null, status: 'ready', visibility: 'public', trackCount: 1, plays: 1280 },
      { id: 's2', title: 'Night Shift (EP)', type: 'ep', artworkUrl: null, status: 'processing', visibility: 'draft', trackCount: 4, plays: 0 },
    ]),
  getQuota: () => delay({ freeBytes: FREE_STORAGE_BYTES, purchasedBytes: 0, usedBytes: 50_400_000 }),
};

export const mockTracks = TRACKS;
