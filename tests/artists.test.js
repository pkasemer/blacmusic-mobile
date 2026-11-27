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
