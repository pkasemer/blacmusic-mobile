const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

const { artistsOf, artistLine, releaseLine, releaseWithFeatures } = makeLoader()('domain/artists');
const track = (featuredArtists) => ({ kind: 'track', artistId: 'a1', artistName: 'Kato', artistVerified: true, featuredArtists });

test('a song with nobody featured shows its one artist', () => {
  assert.strictEqual(artistLine(track()), 'Kato');
  assert.deepStrictEqual(artistsOf(track([])).map((a) => [a.id, a.featured]), [['a1', false]]);
});

test('featured artists follow the song\'s artist, comma separated, nobody twice', () => {
  const song = track([
    { id: 'a2', name: 'Ava' },
    { id: null, name: 'Ben' },
    { id: 'a1', name: 'Kato (again)' },
    { id: null, name: 'kato ' },
    { id: 'a2', name: 'Ava' },
    { id: null, name: ' ' },
  ]);
  assert.strictEqual(artistLine(song), 'Kato, Ava, Ben');
  assert.deepStrictEqual(artistsOf(song).map((a) => [a.id, a.featured]), [['a1', false], ['a2', true], [null, true]]);
});

test('an episode shows its podcast', () => {
  assert.strictEqual(artistLine({ kind: 'episode', podcastTitle: 'Talk' }), 'Talk');
});

test("a release shows what the server says, else what its songs tell", () => {
  const release = (type, featuredArtists) => ({ type, artistId: 'a1', artistName: 'Kato', featuredArtists });
  const songs = [track([{ id: 'a2', name: 'Ava' }, { id: null, name: 'Ben' }]), track([{ id: null, name: 'ben' }])];
  assert.strictEqual(releaseLine(releaseWithFeatures(release('single'), songs.slice(0, 1))), 'Kato, Ava, Ben');
  assert.strictEqual(releaseLine(releaseWithFeatures(release('album'), songs)), 'Kato, Ben');
  assert.strictEqual(releaseLine(releaseWithFeatures(release('album', [{ id: null, name: 'Cy' }]), songs)), 'Kato, Cy');
  assert.strictEqual(releaseLine(releaseWithFeatures(release('single'), [track()])), 'Kato');
});

test('credits list each person once for each role, keeping the profile link', () => {
  const { creditsByRole } = makeLoader()('domain/credits');
  const groups = creditsByRole([
    { name: 'Ava', role: 'producer', trackId: 't1' },
    { name: 'Ben', role: 'featured_artist' },
    { name: 'ava ', role: 'producer', artistId: 'a2' },
    { name: 'Ava', role: 'producer' },
    { name: 'Ava', role: 'songwriter' },
  ]);
  assert.deepStrictEqual(groups.map((g) => [g.role, g.people.map((p) => p.artistId ?? p.name)]), [
    ['Producer', ['a2']],
    ['Featured artist', ['Ben']],
    ['Songwriter', ['Ava']],
  ]);
});

test('where a release stands with verification', () => {
  const { standingOf, toReview, isBeingVerified } = makeLoader()('domain/review');
  const pending = toReview({ status: 'pending', kind: 'new', publishAt: '2027-01-01T10:00:00Z' });
  const refused = toReview({ status: 'rejected', kind: 'new', reason: 'The cover has a phone number on it.' });
  const change = toReview({ status: 'pending', kind: 'update', changes: ['Credits'] });
  assert.deepStrictEqual(standingOf('draft', pending), { label: 'Pending verification', tone: 'review' });
  assert.deepStrictEqual(standingOf('draft', refused), { label: 'Changes needed', tone: 'refused', detail: 'The cover has a phone number on it.' });
  assert.deepStrictEqual(standingOf('public', change), { label: 'Live', tone: 'live', detail: 'Changes pending verification' });
  assert.deepStrictEqual(standingOf('public', undefined), { label: 'Live', tone: 'live' });
  assert.deepStrictEqual([pending, refused, change, toReview(null), toReview({ status: 'approved' })].map(isBeingVerified), [true, false, false, false, false]);
  assert.strictEqual(pending.publishAt, Date.parse('2027-01-01T10:00:00Z'));
});

test('an artist is told where their profile stands', () => {
  const { profileNote, toReview } = makeLoader()('domain/review');
  assert.strictEqual(profileNote(undefined), null);
  assert.match(profileNote(toReview({ status: 'pending', kind: 'new' })).text, /can't see your artist profile/);
  assert.match(profileNote(toReview({ status: 'pending', kind: 'update', changes: ['Name', 'Photo'] })).text, /Waiting: Name, Photo/);
  assert.deepStrictEqual(profileNote(toReview({ status: 'rejected', kind: 'update', reason: 'The photo is not you.' })), {
    title: 'Profile changes not approved',
    text: 'The photo is not you.',
    refused: true,
  });
});
