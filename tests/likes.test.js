const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

const rules = makeLoader()('likes/likesRules');
const state = (over = {}) => ({ ids: [], pending: {}, onServer: [], localOnly: [], ...over });

test('a tap on the heart waits to be sent; episodes stay on the phone', () => {
  const liked = rules.toggled(state(), 'trk_1');
  assert.deepStrictEqual([liked.liked, liked.ids, liked.pending], [true, ['trk_1'], { trk_1: true }]);
  const unliked = rules.toggled(liked, 'trk_1');
  assert.deepStrictEqual([unliked.ids, unliked.pending], [[], { trk_1: false }]);
  assert.deepStrictEqual(rules.toggled(state(), 'epi_1').pending, {});
});

test('likes from before the server kept them are sent up, oldest first', () => {
  const after = rules.merged(state({ ids: ['trk_new', 'epi_1', 'trk_old'] }), ['trk_elsewhere']);
  assert.deepStrictEqual(after.ids, ['trk_elsewhere', 'trk_new', 'epi_1', 'trk_old']);
  assert.deepStrictEqual(rules.toSend(after), [['trk_old', true], ['trk_new', true]]);
});

test('an unlike made elsewhere is followed; what is waiting here wins', () => {
  const after = rules.merged(
    state({ ids: ['trk_a', 'trk_b'], onServer: ['trk_a', 'trk_b', 'trk_c'], pending: { trk_c: false } }),
    ['trk_b', 'trk_c'],
  );
  assert.deepStrictEqual(after.ids, ['trk_b']);
  assert.deepStrictEqual(after.pending, { trk_c: false });
});

test('once sent a change is not waiting; a newer one still is', () => {
  const sent = rules.settled(state({ ids: ['trk_1'], pending: { trk_1: true } }), 'trk_1', true);
  assert.deepStrictEqual([sent.pending, sent.onServer], [{}, ['trk_1']]);
  const changed = rules.settled(state({ pending: { trk_1: false } }), 'trk_1', true);
  assert.deepStrictEqual(changed.pending, { trk_1: false });
});

test('a song the server will not take stays liked here and is not sent for ever', () => {
  const refused = rules.settled(state({ ids: ['trk_1'], pending: { trk_1: true } }), 'trk_1', true, true);
  const after = rules.merged(refused, []);
  assert.deepStrictEqual([after.ids, after.pending], [['trk_1'], {}]);
});

/** The sync, with a stand-in server that holds a set of liked songs. */
function sync(server, local, answer = () => 0) {
  class ApiError extends Error {
    constructor(status) {
      super('x');
      this.status = status;
    }
  }
  const calls = [];
  let value = state(local);
  const store = { getState: () => value, setState: (next) => (value = { ...value, ...(typeof next === 'function' ? next(value) : next) }) };
  const api = makeLoader({
    'react': {},
    'react-native': {},
    '@/auth/personalData': { personalDataSettled: () => Promise.resolve() },
    '@/store/authStore': { useAuthStore: { getState: () => ({ user: { id: 'u1' } }) } },
    '@/store/favouritesStore': { useFavouritesStore: store },
    '@/api/blac/http': {
      ApiError,
      apiRequest: async (url, options = {}) => {
        const method = options.method ?? 'GET';
        calls.push(`${method} ${url.split('/').pop()}`);
        const status = answer(method);
        if (status) throw new ApiError(status);
        if (method === 'GET') return { tracks: server.map((id) => ({ id })) };
        const id = url.split('/').pop();
        if (method === 'PUT' && !server.includes(id)) server.unshift(id);
        if (method === 'DELETE') server.splice(0, server.length, ...server.filter((x) => x !== id));
      },
    },
  })('likes/likesSync');
  return { api, calls, get: () => value };
}

test('syncing sends what is waiting, brings in the rest and uploads old likes', async () => {
  const server = ['trk_s', 'trk_gone'];
  const t = sync(server, { ids: ['trk_old'], pending: { trk_gone: false }, onServer: ['trk_gone'] });
  await t.api.syncLikes();
  assert.deepStrictEqual([...server].sort(), ['trk_old', 'trk_s']);
  assert.deepStrictEqual([...t.get().ids].sort(), ['trk_old', 'trk_s']);
  assert.deepStrictEqual(t.get().pending, {});
});

test('offline, nothing is lost', async () => {
  const t = sync([], { ids: ['trk_1'], pending: { trk_1: true } }, () => 500);
  await t.api.syncLikes();
  assert.deepStrictEqual([t.get().ids, t.get().pending], [['trk_1'], { trk_1: true }]);
});
