const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

const { artistsOf, artistLine } = makeLoader()('domain/artists');
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
