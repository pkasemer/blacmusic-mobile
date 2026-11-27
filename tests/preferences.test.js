const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

/** Music preferences against a stand-in server and a phone that has never seen the answers (a new one). */
function setup({ saved, artist, local = {} } = {}) {
  const sent = [];
  const state = { preferred: [], understood: [], regions: [], discoveryMode: 'explore_more', genres: [], artists: [], unsent: false, ownerId: 'me', ...local };
  state.update = (patch) => Object.assign(state, patch);
  const prefs = makeLoader({
    '@tanstack/react-query': {},
    '@/api/blac': { blacApi: { getArtist: artist ?? (async (id) => (id === 'gone' ? null : { id, name: id.toUpperCase(), avatarUrl: null, verification: 'verified' })) } },
    '@/api/blac/onboarding': {
      onboardingApi: { getSaved: async () => saved, save: async (body) => (sent.push(body), true), complete: async () => true },
    },
    '@/store/authStore': { useAuthStore: { getState: () => ({ user: { id: 'me' } }) } },
    '@/store/onboardingStore': { useOnboardingStore: { getState: () => state } },
    '@/onboarding/yourSound': { keepYourSound: async () => {} },
  })('onboarding/preferences');
  return { prefs, state, sent };
}

const SAVED = {
  completed: true,
  languages: { preferred: ['luganda'], understood: ['english'] },
  regions: ['central'],
  discoveryMode: 'familiar',
  genres: ['gospel'],
  artistIds: ['a', 'gone', 'b'],
};

test('on a new phone, changing one choice keeps all the others', async () => {
  const t = setup({ saved: SAVED });
  await t.prefs.loadPreferences();
  assert.deepStrictEqual(t.state.artists.map((a) => [a.id, a.name]), [['a', 'A'], ['b', 'B']]);
  t.state.genres = ['gospel', 'afrobeats'];
  await t.prefs.savePreferences();
  const { completed, ...answers } = SAVED;
  assert.deepStrictEqual(t.sent[0], { ...answers, genres: ['gospel', 'afrobeats'], artistIds: ['a', 'b'] });
});

test('nothing can be edited unless everything saved could be read', async () => {
  const t = setup({
    saved: SAVED,
    artist: async () => {
      throw new Error('offline');
    },
    local: { genres: ['old'] },
  });
  await assert.rejects(t.prefs.loadPreferences());
  assert.deepStrictEqual(t.state.genres, ['old']);
});

test('answers the server has not had yet are not replaced by what it holds', async () => {
  const t = setup({ saved: SAVED, local: { unsent: true, genres: ['newer'] } });
  await t.prefs.loadPreferences();
  assert.deepStrictEqual(t.state.genres, ['newer']);
  await t.prefs.savePreferences();
  assert.strictEqual(t.state.unsent, false);
});
