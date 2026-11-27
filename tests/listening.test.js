const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

const load = makeLoader();
const { createListenTracker, SESSION_GAP_MS } = load('stats/listenTracker');

function setup() {
  const listens = [];
  const sessions = [];
  let ids = 0;
  let sessionIds = 0;
  const tracker = createListenTracker({
    onListen: (l) => listens.push(l),
    onSessionStart: (m) => sessions.push(['start', m.sessionId]),
    onSessionEnd: (m) => sessions.push(['end', m.sessionId]),
    // Session ids and listen ids are told apart.
    newId: () => (tracker?.sessionId() || sessions.length === 0 || sessions.at(-1)[0] === 'start' ? `l${++ids}` : `s${++sessionIds + 1}`),
  });
  let now = 0;
  // Songs a, b, c... sit in that order in the queue, 100 seconds each.
  const song = (id, over = {}) => ({ key: id.charCodeAt(0), id, artistId: `art-${id}`, durationSec: 100, source: 'album', ...over });
  const place = (id) => id.charCodeAt(0) - 97;
  /** The player says where it is. */
  const see = (id, positionSec, playing = true, over) =>
    tracker.tick({ track: id ? song(id, over) : null, index: id ? place(id) : 0, positionSec, playing }, now);
  /** Plays `id` second by second from `from` for `seconds`. */
  const play = (id, seconds, from = 0, over) => {
    for (let i = 1; i <= seconds; i++) {
      now += 1000;
      see(id, from + i, true, over);
    }
  };
  const idle = () => {
    now += 1000;
    see(null, null, false);
  };
  const wait = (ms) => (now += ms);
  const leave = (reason) => tracker.leaving(reason, now);
  const how = () => listens.map((l) => [l.trackId, l.outcome, l.endReason]);
  return { tracker, listens, sessions, see, play, idle, wait, leave, how, at: () => now };
}

test('a song heard to the end is completed', () => {
  const t = setup();
  t.play('a', 100);
  t.play('b', 1);
  const { id, sessionId, at, ...listen } = t.listens[0];
  assert.ok(id && sessionId && at);
  assert.deepStrictEqual(listen, {
    trackId: 'a', artistId: 'art-a', listenedSec: 100, durationSec: 100, completion: 100, outcome: 'completed',
    replay: false, source: 'album', endReason: 'ended', positionSec: 100,
  });
});

test('next in the app is a skip; going back and stopping are not', () => {
  const t = setup();
  t.play('a', 12);
  t.leave('next');
  t.play('b', 20);
  t.leave('previous');
  t.play('a', 20);
  t.leave('stopped');
  t.idle();
  assert.deepStrictEqual(t.how(), [['a', 'skipped', 'next'], ['b', 'stopped', 'previous'], ['a', 'stopped', 'stopped']]);
});

test('lock-screen buttons seen as they happen: next is a skip, previous is not', () => {
  const t = setup();
  t.play('b', 12);
  t.play('c', 12);
  t.play('b', 3);
  t.idle();
  assert.deepStrictEqual(t.how().slice(0, 2), [['b', 'skipped', 'next'], ['c', 'stopped', 'previous']]);
});

test('lock-screen next while briefly paused is still a skip', () => {
  const t = setup();
  t.play('a', 20);
  t.see('a', 20, false);
  t.wait(120_000);
  t.play('b', 2);
  assert.deepStrictEqual(t.how(), [['a', 'skipped', 'next']]);
});

test('in the background, reports far apart still count all the song moved', () => {
  const t = setup();
  t.play('a', 10);
  t.wait(60_000);
  t.see('a', 70);
  t.wait(29_500);
  t.see('a', 99.5);
  t.wait(700);
  t.see('b', 0.2);
  assert.deepStrictEqual([t.listens[0].listenedSec, t.listens[0].outcome, t.listens[0].endReason], [100, 'completed', 'ended']);
});

test('a change nobody saw happen is not a skip', () => {
  const t = setup();
  t.play('a', 10);
  t.wait(600_000);
  t.see('c', 30);
  assert.deepStrictEqual(t.how(), [['a', 'stopped', 'unobserved']]);
  assert.strictEqual(t.listens[0].listenedSec, 10);
});

test('a song that ran out is never a skip, even when little of it was heard', () => {
  const t = setup();
  t.play('a', 5);
  t.see('a', 90); // dragged near the end
  t.play('a', 10, 90);
  t.play('b', 1);
  assert.deepStrictEqual(t.how(), [['a', 'stopped', 'ended']]);
});

test('jumps forward, pauses and waiting for audio add nothing', () => {
  const t = setup();
  t.play('a', 10);
  for (let i = 0; i < 30; i++) {
    t.wait(1000);
    t.see('a', 10, false);
  }
  t.see('a', 80, false);
  t.play('a', 5, 80);
  for (let i = 0; i < 10; i++) {
    t.wait(1000);
    t.see('a', 85); // playing, but nothing arriving
  }
  t.leave('stopped');
  t.idle();
  assert.strictEqual(t.listens[0].listenedSec, 14);
});

test('nothing is counted while the player is not yet showing the song', () => {
  const t = setup();
  t.play('a', 20);
  t.leave('replaced');
  for (let i = 0; i < 8; i++) {
    t.wait(1000);
    t.see('b', null);
  }
  t.idle();
  assert.deepStrictEqual(t.how(), [['a', 'skipped', 'replaced']]);
});

test('starting something else after pausing, or the same song again, is not a skip', () => {
  const t = setup();
  t.play('a', 20);
  t.see('a', 20, false);
  t.wait(10_000);
  t.leave('replaced');
  t.play('b', 20);
  t.leave('replaced'); // the same song, chosen from another list
  t.play('b', 3, 0, { key: 999 });
  assert.deepStrictEqual(t.how(), [['a', 'stopped', 'replaced'], ['b', 'stopped', 'restart']]);
});

test('a song left paused past the session is over, at the time it was paused', () => {
  const t = setup();
  t.play('a', 20);
  t.see('a', 20, false);
  const pausedAt = t.at();
  t.wait(SESSION_GAP_MS + 1000);
  t.leave('next');
  t.see('a', 20, false);
  t.play('b', 2);
  assert.deepStrictEqual(t.how(), [['a', 'stopped', 'paused']]);
  assert.strictEqual(t.listens[0].at, pausedAt);
});

test('the last song of the queue is recorded as soon as it ends, once', () => {
  const t = setup();
  t.play('a', 100);
  t.tracker.ended(t.at());
  t.see('a', 100, false);
  t.leave('stopped');
  t.idle();
  assert.deepStrictEqual(t.how(), [['a', 'completed', 'ended']]);
});

test('the song under way can be saved in case the app goes away, under the id it keeps', () => {
  const t = setup();
  t.play('a', 30);
  const draft = t.tracker.draft();
  assert.deepStrictEqual([draft.outcome, draft.endReason, draft.listenedSec], ['stopped', 'app_closed', 30]);
  assert.strictEqual(t.listens.length, 0);
  t.play('a', 65, 30);
  assert.strictEqual(t.tracker.draft().outcome, 'completed');
  t.leave('next');
  t.play('b', 2);
  assert.strictEqual(t.listens[0].id, draft.id);
});

test('signing out records the song once, and stopping the player does not open it again', () => {
  const t = setup();
  t.play('a', 30);
  t.tracker.finish(t.at());
  t.leave('stopped');
  t.play('a', 1, 30);
  t.idle();
  assert.deepStrictEqual(t.how(), [['a', 'stopped', 'sign_out']]);
});

test('autoplay is carried with the listen', () => {
  const t = setup();
  t.play('a', 100, 0, { autoplay: true, autoplaySeedId: 'trk_seed' });
  t.play('b', 1);
  assert.deepStrictEqual([t.listens[0].autoplay, t.listens[0].autoplaySeedId, t.listens[0].source], [true, 'trk_seed', 'album']);
  t.idle();
});

test('starting a song over, or hearing it again in the session, is a replay', () => {
  const t = setup();
  t.play('a', 40);
  t.play('a', 40);
  t.play('b', 5);
  t.play('a', 5);
  t.idle();
  assert.deepStrictEqual(t.listens.map((l) => [l.trackId, l.replay]), [['a', false], ['a', true], ['b', false], ['a', true]]);
  assert.strictEqual(t.listens[0].endReason, 'restart');
});

test('a song on repeat is completed each time round', () => {
  const t = setup();
  t.play('a', 100);
  t.play('a', 100);
  t.play('a', 2);
  assert.deepStrictEqual(t.how(), [['a', 'completed', 'ended'], ['a', 'completed', 'ended']]);
});

test('a long break starts a new session', () => {
  const t = setup();
  t.play('a', 20);
  t.idle();
  t.wait(SESSION_GAP_MS + 1000);
  t.play('a', 20);
  t.idle();
  assert.deepStrictEqual(t.sessions.map((m) => m[0]), ['start', 'end', 'start']);
  assert.notStrictEqual(t.listens[0].sessionId, t.listens[1].sessionId);
  assert.strictEqual(t.listens[1].replay, false);
  t.tracker.finish(t.at());
  assert.strictEqual(t.sessions.at(-1)[0], 'end');
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
  state.draft = null;
  state.setDraft = (d) => (state.draft = d);
  state.add = (e) => {
    state.pending = [...state.pending.filter((p) => p.id !== e.id), e];
    if (state.draft?.id === e.id) state.draft = null;
  };
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

test('a listen left open when the app went away is sent next time, once', () => {
  const t = sender(() => 0);
  const open = { id: 'x1', type: 'listen', trackId: 'trk_1', at: new Date().toISOString(), listenedSec: 40, outcome: 'stopped', endReason: 'app_closed' };
  t.state.draft = open;
  t.signals.recoverDraft();
  t.signals.recoverDraft();
  assert.deepStrictEqual(t.state.pending, [open]);
  assert.strictEqual(t.state.draft, null);
});

test('at sign out everything unsent, the open listen included, goes with the old account\'s token', async () => {
  let fail = false;
  const t = sender(() => (fail ? 500 : 0));
  t.state.draft = { id: 'x1', type: 'listen', trackId: 'trk_1' };
  t.signals.recordPlaylistAdd('trk_2', 'p');
  const unsent = t.signals.finishForSignOut();
  assert.deepStrictEqual(unsent.map((e) => e.type), ['playlist_add', 'listen']);
  assert.deepStrictEqual(await t.signals.sendWithToken(unsent, 'old-token'), unsent.map((e) => e.id));
  fail = true;
  assert.deepStrictEqual(await t.signals.sendWithToken(unsent, 'old-token'), []);
});

test('likes of podcast episodes are not recorded', () => {
  const t = sender(() => 0);
  t.signals.recordLike('ep_1', true);
  assert.strictEqual(t.state.pending.length, 0);
});
