const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

/** The artist page's Favourite button against a stand-in server. */
function setup(artistIds) {
  let saved = { completed: true, languages: { preferred: ['luganda'], understood: [] }, regions: ['central'], discoveryMode: 'familiar', genres: ['gospel'], artistIds };
  const posts = [];
  const state = { artists: artistIds.map((id) => ({ id })), ownerId: 'me', unsent: false };
  state.update = (patch) => Object.assign(state, patch);
  const favourites = makeLoader({
    '@tanstack/react-query': {},
    '@/api/queryClient': { queryClient: { setQueryData: () => {} } },
    '@/api/blac/onboarding': {
      onboardingApi: {
        getSaved: async () => saved,
        save: async (body) => {
          posts.push(body);
          saved = { ...body, completed: true };
          return true;
        },
      },
    },
    '@/store/authStore': { useAuthStore: { getState: () => ({ user: { id: 'me' } }) } },
    '@/store/onboardingStore': { useOnboardingStore: { getState: () => state } },
  })('onboarding/favouriteArtists');
  const mark = (id, on) => favourites.setFavouriteArtist({ id, name: id, avatarUrl: null, verified: false }, on);
  return { mark, posts, state, ids: () => saved.artistIds };
}

test('marking artists keeps every other answer, even when tapped quickly', async () => {
  const t = setup(['a']);
  await Promise.all([t.mark('b', true), t.mark('c', true)]);
  assert.deepStrictEqual(t.ids(), ['a', 'b', 'c']);
  assert.deepStrictEqual([t.posts[1].genres, t.posts[1].regions, t.posts[1].discoveryMode, t.posts[1].languages.preferred], [['gospel'], ['central'], 'familiar', ['luganda']]);
  assert.deepStrictEqual(t.state.artists.map((a) => a.id), ['a', 'b', 'c']);
});

test('the last favourite is kept, and marking one twice saves nothing', async () => {
  const t = setup(['a']);
  assert.strictEqual(await t.mark('a', false), 'last');
  assert.strictEqual(await t.mark('a', true), 'saved');
  assert.strictEqual(t.posts.length, 0);
  await t.mark('b', true);
  await t.mark('a', false);
  assert.deepStrictEqual(t.ids(), ['b']);
});
