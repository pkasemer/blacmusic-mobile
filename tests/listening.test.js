const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

const load = makeLoader();
const { createListenTracker, SESSION_GAP_MS } = load('stats/listenTracker');

function setup() {
  const listens = [];
  const sessions = [];
  let ids = 0;
  const tracker = createListenTracker({
    onListen: (l) => listens.push(l),
    onSessionStart: (s) => sessions.push(['start', s.sessionId]),
    onSessionEnd: (s) => sessions.push(['end', s.sessionId]),
    newId: () => `s${++ids}`,
  });
  let now = 0;
  const song = (id) => ({ id, artistId: `art-${id}`, durationSec: 100, source: 'album' });
  /** Plays `id` second by second from `from` for `seconds`. */
  const play = (id, seconds, from = 0) => {
    for (let i = 1; i <= seconds; i++) tracker.tick({ track: song(id), positionSec: from + i, playing: true }, (now += 1000));
  };
  const idle = () => tracker.tick({ track: null, positionSec: 0, playing: false }, (now += 1000));
  const wait = (ms) => (now += ms);
  return { tracker, listens, sessions, play, idle, wait, song };
}

test('a song heard to the end is completed', () => {
  const t = setup();
  t.play('a', 100);
  t.play('b', 1);
  assert.deepStrictEqual(
    { ...t.listens[0] },
    { trackId: 'a', artistId: 'art-a', listenedSec: 100, durationSec: 100, completion: 100, outcome: 'completed', replay: false, source: 'album', sessionId: 's1' },
  );
});

test('leaving early for another song is a skip; stopping playback is not', () => {
  const t = setup();
  t.play('a', 12);
  t.play('b', 20);
  t.idle();
  assert.deepStrictEqual(t.listens.map((l) => [l.trackId, l.completion, l.outcome]), [['a', 12, 'skipped'], ['b', 20, 'stopped']]);
});

test('pauses and jumps forward do not count as listening', () => {
  const t = setup();
  t.play('a', 10);
  for (let i = 0; i < 30; i++) t.tracker.tick({ track: t.song('a'), positionSec: 10, playing: false }, 11_000 + i * 1000);
  t.play('a', 5, 80);
  t.idle();
  assert.strictEqual(t.listens[0].listenedSec, 15);
  assert.strictEqual(t.listens[0].outcome, 'stopped');
});

test('after time in the background, only as far as the song got is counted', () => {
  const t = setup();
  t.play('a', 10);
  t.tracker.tick({ track: t.song('a'), positionSec: 40, playing: true }, 600_000, 590);
  t.tracker.tick({ track: t.song('b'), positionSec: 5, playing: true }, 900_000, 300);
  t.idle();
  assert.deepStrictEqual(t.listens.map((l) => l.listenedSec), [41, 6]);
});

test('starting a song over, or hearing it again in the session, is a replay', () => {
  const t = setup();
  t.play('a', 40);
  t.play('a', 40);
  t.play('b', 5);
  t.play('a', 5);
  t.idle();
  assert.deepStrictEqual(t.listens.map((l) => [l.trackId, l.replay]), [['a', false], ['a', true], ['b', false], ['a', true]]);
});

test('a long break starts a new session', () => {
  const t = setup();
  t.play('a', 20);
  t.idle();
  t.wait(SESSION_GAP_MS + 1000);
  t.play('a', 20);
  t.idle();
  assert.deepStrictEqual(t.sessions, [['start', 's1'], ['end', 's1'], ['start', 's2']]);
  assert.strictEqual(t.listens[1].replay, false);
  t.tracker.finish(Number.MAX_SAFE_INTEGER);
  assert.deepStrictEqual(t.sessions.at(-1), ['end', 's2']);
});

const rules = load('onboarding/yourSoundRules');
const taste = (over) => ({ completed: 0, skipped: 0, replays: 0, liked: false, ...over });
const songs = (n) => Array.from({ length: n }, (_, i) => ({ itemId: `i${i}`, trackId: `t${i}` }));

test('the artists really enjoyed come first, skipped ones not at all', () => {
  const found = rules.favouriteArtists(
    { a: taste({ artistId: 'x', completed: 2 }), b: taste({ artistId: 'y', liked: true, replays: 1 }), c: taste({ artistId: 'z', skipped: 3 }) },
    5,
  );
  assert.deepStrictEqual(found, ['y', 'x']);
});

test('an update adds new songs and keeps the playlist to size, oldest of ours going first', () => {
  const items = songs(rules.YOUR_SOUND_SIZE);
  const ours = new Set(items.map((i) => i.trackId));
  const offered = ['t3', ...Array.from({ length: 20 }, (_, i) => `new${i}`)];
  const plan = rules.planUpdate(items, ours, offered, { t0: taste({ liked: true }) });
  assert.strictEqual(plan.add.length, rules.FRESH_PER_UPDATE);
  assert.ok(!plan.add.includes('t3'));
  assert.deepStrictEqual(plan.remove.map((r) => r.trackId), ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']);
});

test('songs the listener added are never removed, and rejected songs are not offered again', () => {
  const items = songs(3);
  const tastes = { t0: taste({ skipped: 2 }), t1: taste({ skipped: 2 }), n1: taste({ skipped: 4 }) };
  const plan = rules.planUpdate(items, new Set(['t1', 't2']), ['n1', 'n2'], tastes);
  assert.deepStrictEqual(plan.add, ['n2']);
  assert.deepStrictEqual(plan.remove.map((r) => r.trackId), ['t1']);
});

test('it stops growing when nothing in it may be taken out', () => {
  const plan = rules.planUpdate(songs(rules.YOUR_SOUND_MAX - 2), new Set(), ['n1', 'n2', 'n3'], {});
  assert.deepStrictEqual(plan, { add: ['n1', 'n2'], remove: [] });
});

test('"Your sound" is listed first', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepStrictEqual(rules.pinFirst(list, 'c').map((p) => p.id), ['c', 'a', 'b']);
  assert.strictEqual(rules.pinFirst(list, null), list);
});

/** The sender, with a stand-in server and store. */
function sender(answer) {
  class ApiError extends Error {
    constructor(status) {
      super('x');
      this.status = status;
    }
  }
  const calls = [];
  const state = { pending: [], tastes: {} };
  state.add = (e) => state.pending.push(e);
  state.sent = (ids) => (state.pending = state.pending.filter((e) => !ids.includes(e.id)));
  state.taste = (id, change) => (state.tastes[id] = change(state.tastes[id] ?? taste()));
  const signals = makeLoader({
    '@/api/blac/http': {
      ApiError,
      apiRequest: async (url, options) => {
        calls.push(options.body.events.length);
        const status = answer();
        if (status) throw new ApiError(status);
      },
    },
    '@/store/listeningStore': { useListeningStore: { getState: () => state } },
  })('stats/signals');
  return { signals, state, calls };
}

test('events go in batches; a server without the route keeps them and is not asked again at once', async () => {
  const ok = sender(() => 0);
  for (let i = 0; i < 70; i++) ok.signals.recordPlaylistAdd(`trk_${i}`, 'p');
  await ok.signals.sendSignals();
  assert.deepStrictEqual(ok.calls, [50, 20]);
  assert.strictEqual(ok.state.pending.length, 0);

  const missing = sender(() => 404);
  missing.signals.recordLike('trk_1', true);
  await missing.signals.sendSignals();
  await missing.signals.sendSignals();
  assert.deepStrictEqual(missing.calls, [1]);
  assert.strictEqual(missing.state.pending.length, 1);
  assert.strictEqual(missing.state.tastes.trk_1.liked, true);
});

test('likes of podcast episodes are not recorded', () => {
  const t = sender(() => 0);
  t.signals.recordLike('ep_1', true);
  assert.strictEqual(t.state.pending.length, 0);
});
