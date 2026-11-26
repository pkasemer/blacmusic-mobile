// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

const rules = makeLoader()('domain/onboarding');

const memory = () => {
  const saved = new Map();
  return { saved, storage: { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: (k) => saved.delete(k) } };
};

function storeOn(device) {
  const { createJSONStorage } = require('zustand/middleware');
  const load = makeLoader({ '@/store/storage': { persistStorage: createJSONStorage(() => device.storage) } });
  return load('store/onboardingStore').useOnboardingStore;
}

test('the catalogue has the six language groups and every language once', () => {
  const { languageGroups, regions, genres } = rules.BUILT_IN_CONFIG;
  assert.deepStrictEqual(languageGroups.map((g) => g.languages.length), [4, 4, 5, 5, 3, 2]);
  const ids = languageGroups.flatMap((g) => g.languages.map((l) => l.id));
  assert.strictEqual(new Set(ids).size, 23);
  assert.strictEqual(regions.length, 6);
  assert.strictEqual(genres.length, 10);
  assert.strictEqual(rules.DEFAULT_DISCOVERY, 'explore_more');
});

test('search finds languages across all groups, and a group name shows the whole group', () => {
  const groups = rules.BUILT_IN_CONFIG.languageGroups;
  const found = (q) => rules.searchLanguages(groups, q).flatMap((g) => g.languages.map((l) => l.id));
  // "Luo / Lwo" matches too, so that whole group shows.
  assert.deepStrictEqual(found('lu'), ['luganda', 'lusoga', 'lugwere', 'luruuli', 'acholi', 'lango', 'alur', 'kumam', 'adhola', 'lugbara']);
  assert.deepStrictEqual(found('madi'), ['lugbara', 'aringa', 'madi']);
  assert.deepStrictEqual(found("Ma'di"), ['lugbara', 'aringa', 'madi']);
  assert.deepStrictEqual(found('swa'), ['swahili']);
  assert.deepStrictEqual(found('zzz'), []);
  assert.strictEqual(rules.searchLanguages(groups, '  ').length, 6);
});

test('enjoying and understanding a language stay separate, with bulk select and no duplicates', () => {
  const store = storeOn(memory());
  const s = () => store.getState();
  s().begin();
  s().toggleLanguage('preferred', 'acholi');
  assert.deepStrictEqual([s().preferred, s().understood], [['acholi'], []]);
  s().toggleLanguage('understood', 'english');
  s().toggleLanguages('preferred', ['acholi', 'lango', 'alur']);
  assert.deepStrictEqual(s().preferred, ['acholi', 'lango', 'alur']);
  assert.deepStrictEqual(s().understood, ['english']);
  s().toggleLanguages('preferred', ['acholi', 'lango', 'alur']);
  assert.deepStrictEqual(s().preferred, []);
});

test('choices survive moving between steps and closing the app; beginning again keeps them', async () => {
  const device = memory();
  let store = storeOn(device);
  store.getState().begin();
  store.getState().toggleRegion('west_nile');
  store.getState().toggleGenre('rnb');
  store.getState().toggleArtist({ id: 'art_1', name: 'A', avatarUrl: null, verified: true });
  store.getState().goTo('artists');
  store.getState().goTo('regions');
  store = storeOn(device); // the app is opened again
  await store.persist.rehydrate();
  const s = store.getState();
  assert.deepStrictEqual([s.status, s.step, s.regions, s.genres, s.artists.length], ['active', 'regions', ['west_nile'], ['rnb'], 1]);
  s.begin();
  assert.deepStrictEqual(store.getState().regions, ['west_nile']);
  store.getState().reset();
  assert.strictEqual(store.getState().status, 'idle');
});

test('no step can be left without an answer, except artists when the catalogue has none', () => {
  const none = { preferred: [], regions: [], genres: [], artists: [] };
  for (const step of ['languages', 'regions', 'genres', 'artists']) assert(rules.missingFor(step, none), step);
  const all = { preferred: ['luganda'], regions: ['karamoja'], genres: ['rnb'], artists: [{}] };
  for (const step of ['languages', 'regions', 'genres', 'artists']) assert.strictEqual(rules.missingFor(step, all), null, step);
  assert.strictEqual(rules.missingFor('artists', none, true), null);
});

test('what is sent holds ids only, each once, and no guess about the person', () => {
  const payload = rules.toPayload({
    preferred: ['acholi', 'acholi'], understood: [], regions: ['northern_uganda'], discoveryMode: 'explore_more', genres: [],
    artists: [{ id: 'art_1', name: 'A' }, { id: 'art_1', name: 'A' }],
  });
  assert.deepStrictEqual(payload, {
    languages: { preferred: ['acholi'], understood: [] }, regions: ['northern_uganda'], discoveryMode: 'explore_more', genres: [], artistIds: ['art_1'],
  });
});

test("the server's catalogue replaces the built-in one only for the parts it sends", () => {
  const merged = rules.mergeConfig({ genres: [{ id: 'x', label: 'X' }], regions: [] });
  assert.deepStrictEqual(merged.genres, [{ id: 'x', label: 'X' }]);
  assert.strictEqual(merged.regions.length, 6);
});

test('the first listen takes from each pick in turn, without repeats', () => {
  const { starterTracks } = makeLoader()('onboarding/starter');
  const list = (...ids) => ids.map((id) => ({ id }));
  const got = starterTracks([list('a', 'b', 'c'), list('a', 'd'), []], 4, (x) => x).map((t) => t.id);
  assert.deepStrictEqual(got, ['a', 'b', 'd', 'c']);
  assert.deepStrictEqual(starterTracks([], 4, (x) => x), []);
});

// ---- the API and finishing, against a stand-in server -----------------------------------------------

function app({ routes = {}, signedIn = true, effects = [] } = {}) {
  class ApiError extends Error {
    constructor(status, code) {
      super(code);
      this.status = status;
      this.code = code;
    }
  }
  const sent = [];
  const auth = { user: signedIn ? { id: 'u1' } : null, refreshToken: signedIn ? 'r' : null };
  const apiRequest = async (path, options = {}) => {
    sent.push([options.method ?? 'GET', path, options.body]);
    const answer = routes[path];
    if (answer === undefined) throw new ApiError(404, 'error');
    if (typeof answer === 'number') throw new ApiError(answer, 'error');
    return answer;
  };
  const device = memory();
  const { createJSONStorage } = require('zustand/middleware');
  const load = makeLoader({
    '@/store/storage': { persistStorage: createJSONStorage(() => device.storage) },
    '@/store/authStore': { useAuthStore: Object.assign((select) => select(auth), { getState: () => auth }) },
    '@/api/blac/http': { ApiError, apiRequest },
    '@/api/blac/config': { reachable: (u) => u ?? null },
    '@/api/blac/index': {
      USES_BACKEND: true,
      blacApi: { getArtistPopularTracks: async (id) => [{ id: `t-${id}` }], getTracksByGenre: async (g) => [{ id: `g-${g}` }], getTrending: async () => [{ id: 'trend' }] },
    },
    '@/api/blac': {
      blacApi: { getArtistPopularTracks: async (id) => [{ id: `t-${id}` }], getTracksByGenre: async (g) => [{ id: `g-${g}` }], getTrending: async () => [{ id: 'trend' }] },
    },
    '@/audio/music/queue': { shuffled: (x) => x },
    '@/api/queryClient': { queryClient: { fetchQuery: async ({ queryFn }) => queryFn() } },
    '@tanstack/react-query': { useQuery: () => ({}) },
    react: { useEffect: (effect) => effects.push(effect) },
  });
  return { load, sent, auth, store: load('store/onboardingStore').useOnboardingStore };
}

test('without onboarding on the server, signed-out artists need an account and signed-in ones use the catalogue', async () => {
  const out = app({ signedIn: false, routes: {} });
  const { onboardingApi, NeedsAccount } = out.load('api/blac/onboarding');
  await assert.rejects(onboardingApi.getArtists(''), NeedsAccount);
  const inside = app({ routes: { '/v1/search/artists': { artists: [{ id: 'a1', name: 'N', verified: true }] } } });
  assert.deepStrictEqual(await inside.load('api/blac/onboarding').onboardingApi.getArtists('n'), [{ id: 'a1', name: 'N', avatarUrl: null, verified: true }]);
});

test('an account the server says has not finished is taken through onboarding; a finished one is not', async () => {
  for (const [completed, expected] of [[false, 'active'], [true, 'done']]) {
    const effects = [];
    const w = app({ routes: { '/v1/onboarding/preferences': { completed } }, effects });
    w.load('onboarding/finish').useRequireOnboarding(true);
    effects.forEach((run) => run());
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(w.store.getState().status, expected);
  }
});

test('finishing without the server keeps the answers to send later and builds a first listen from the picks', async () => {
  const w = app();
  w.store.getState().begin();
  w.store.getState().toggleGenre('hip_hop');
  w.store.getState().toggleArtist({ id: 'a1', name: 'N', avatarUrl: null, verified: false });
  const { finishOnboarding } = w.load('onboarding/finish');
  const first = finishOnboarding();
  assert.strictEqual(finishOnboarding(), first, 'a second tap does not send twice');
  await first;
  const s = w.store.getState();
  assert.deepStrictEqual([s.status, s.unsent, s.ownerId], ['done', true, 'u1']);
  assert.deepStrictEqual(s.starter.map((t) => t.id), ['t-a1', 'g-Hip-Hop']);
  assert.strictEqual(w.sent.filter(([m, p]) => m === 'POST' && p === '/v1/onboarding/preferences').length, 1);
});

test('with the server in place, the answers are saved, onboarding is completed and nothing is made up locally', async () => {
  const w = app({ routes: { '/v1/onboarding/preferences': {}, '/v1/onboarding/complete': {} } });
  w.store.getState().begin();
  w.store.getState().toggleLanguage('preferred', 'luganda');
  await w.load('onboarding/finish').finishOnboarding();
  assert.deepStrictEqual(w.sent.filter(([m]) => m === 'POST').map(([, p]) => p), ['/v1/onboarding/preferences', '/v1/onboarding/complete']);
  assert.deepStrictEqual(w.sent.find(([m]) => m === 'POST')[2].languages, { preferred: ['luganda'], understood: [] });
  const s = w.store.getState();
  // No picks that lead to songs: the ready-made playlist is what is trending, and Home is to show it.
  assert.deepStrictEqual([s.status, s.unsent, s.starter.map((t) => t.id), s.showStarter], ['done', false, ['trend'], true]);
});
