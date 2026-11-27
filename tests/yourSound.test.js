const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

/** "Your sound" against a stand-in server that keeps playlists, with no route of its own for it. */
function setup(serverId) {
  class ApiError extends Error {
    constructor(status) {
      super('x');
      this.status = status;
    }
  }
  const playlists = new Map();
  let made = 0;
  const track = (id) => ({ id });
  const record = { ownerId: null, playlistId: null, added: [], updatedAt: 0, saving: false };
  const store = {
    ...record,
    update: (patch) => Object.assign(store, patch),
    switchTo: (ownerId) => store.ownerId !== ownerId && Object.assign(store, record, { ownerId }),
  };
  const blacApi = {
    getMyPlaylists: async () => [...playlists.values()],
    getPlaylist: async (id) => {
      const p = playlists.get(id);
      return p ? { playlist: p, tracks: p.songs.map(track), itemIds: p.songs.map((s) => `item-${s}`) } : null;
    },
    createPlaylist: async (input) => {
      const p = { id: `p${++made}`, ownerId: 'me', songs: [], ...input };
      playlists.set(p.id, p);
      return p;
    },
    addToPlaylist: async (id, song) => playlists.get(id).songs.push(song),
    removeFromPlaylist: async (id, item) => (playlists.get(id).songs = playlists.get(id).songs.filter((s) => `item-${s}` !== item)),
    getArtistPopularTracks: async () => ['fresh1', 'fresh2'].map(track),
    getTracksByGenre: async () => [],
    getTrending: async () => [],
  };
  const { keepYourSound } = makeLoader({
    react: { useEffect: () => {} },
    'react-native': { AppState: {} },
    '@/api/blac': { blacApi },
    '@/api/blac/http': {
      ApiError,
      apiRequest: async () => {
        if (serverId) return { playlistId: serverId };
        throw new ApiError(404);
      },
    },
    '@/api/blac/onboarding': { onboardingApi: { getSaved: async () => ({ completed: true, artistIds: ['a1'], genres: [] }) } },
    '@/api/blac/playlistCache': { refreshPlaylistQueries: () => {} },
    '@/audio/music/queue': { shuffled: (x) => x },
    '@/store/authStore': { useAuthStore: { getState: () => ({ user: { id: 'me' } }) } },
    '@/store/listeningStore': { useListeningStore: { getState: () => ({ tastes: {} }) } },
    '@/store/onboardingStore': { useOnboardingStore: { getState: () => ({ artists: [], genres: [] }) } },
    '@/store/yourSoundStore': { useYourSoundStore: { getState: () => store } },
    '@/onboarding/useConfig': { onboardingApiConfig: async () => ({ genres: [] }) },
  })('onboarding/yourSound');
  return { keepYourSound, playlists, store, track };
}

test('"Your sound" is made once, private, with the songs just shown', async () => {
  const t = setup();
  await Promise.all([t.keepYourSound([t.track('a'), t.track('b')]), t.keepYourSound()]);
  await t.keepYourSound();
  assert.strictEqual(t.playlists.size, 1);
  const p = t.playlists.get('p1');
  assert.deepStrictEqual([p.name, p.songs, p.isPublic], ['Your sound', ['a', 'b'], undefined]);
});

test('on a phone that forgot it, the account\'s playlist is found again, and a day later gets new songs', async () => {
  const t = setup();
  await t.keepYourSound([t.track('a')]);
  Object.assign(t.store, { playlistId: null, added: [], updatedAt: 0 });
  await t.keepYourSound([t.track('z')]);
  assert.strictEqual(t.playlists.size, 1);
  assert.deepStrictEqual(t.playlists.get('p1').songs, ['a', 'fresh1', 'fresh2']);
});

test('a deleted one is made again', async () => {
  const t = setup();
  await t.keepYourSound([t.track('a')]);
  t.playlists.clear();
  await t.keepYourSound([t.track('a')]);
  assert.deepStrictEqual(t.playlists.get('p2').songs, ['fresh1', 'fresh2']);
});

test('once the server keeps it, the app makes and changes nothing', async () => {
  const t = setup('srv1');
  await t.keepYourSound([t.track('a')]);
  assert.deepStrictEqual([t.store.playlistId, t.store.saving, t.playlists.size], ['srv1', false, 0]);
});
