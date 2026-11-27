const test = require('node:test');
const assert = require('node:assert');
const makeLoader = require('./load');

const { checkLyrics, looksTimed, stamp, toLrc } = makeLoader()('domain/lyricsFormat');

const GOOD = `[00:12.50]Nkwagala nnyo
I love you so much
[00:17.20]Oh yeah

[00:21.00]Tuula nange
Stay with me
[00:25.40]
[01:07.5]Nkwagala`;

test('a translation belongs to the line above it, and is optional', () => {
  const { timed, lines, errors } = checkLyrics(GOOD, 200);
  assert.deepStrictEqual([timed, errors], [true, []]);
  assert.deepStrictEqual(
    lines.map((l) => [l.timeSec, l.text, l.translation]),
    [
      [12.5, 'Nkwagala nnyo', 'I love you so much'],
      [17.2, 'Oh yeah', undefined],
      [21, 'Tuula nange', 'Stay with me'],
      [25.4, '', undefined],
      [67.5, 'Nkwagala', undefined],
    ],
  );
});

test('writing the lines out again keeps times and translations', () => {
  const first = checkLyrics(GOOD).lines;
  assert.deepStrictEqual(checkLyrics(toLrc(first)).lines, first);
  assert.strictEqual(stamp(67.5), '[01:07.50]');
  assert.strictEqual(stamp(59.999), '[01:00.00]');
});

test('plain lyrics need no times and have no errors', () => {
  assert.deepStrictEqual(checkLyrics('One line\nAnother\n[Chorus]'), { timed: false, lines: [], errors: [] });
  assert.strictEqual(looksTimed('sing at [00:10.00] please'), false);
});

const errorsOf = (text, duration) => checkLyrics(text, duration).errors.map((e) => [e.line, e.message]);

test('each mistake names its line', () => {
  assert.match(errorsOf('Hello\n[00:01.00]A')[0][1], /Line 1 has no time stamp/);
  assert.match(errorsOf('[00:01.00]A\n\nTranslation')[0][1], /Line 3 has no time stamp/);
  assert.match(errorsOf('[00:01.00]A\nOne\nTwo')[0][1], /Line 3 has no time stamp/);
  assert.match(errorsOf('[00:01.00]A\n[00:75.00]B')[0][1], /Line 2: write the time/);
  assert.match(errorsOf('[00:01.00]A\n[0:2]B')[0][1], /Line 2: write the time/);
  assert.match(errorsOf('[00:09.00]A\n[00:05.00]B')[0][1], /must be after \[00:09.00\] on line 1/);
  assert.match(errorsOf('[00:09.00]A\n[00:09.00]Translated')[0][1], /A translation line has no time stamp/);
  assert.match(errorsOf('[00:09.00]\nBreak words')[0][1], /music break has no translation/);
  assert.match(errorsOf('[00:09.00]A\n[04:00.00]B', 180)[0][1], /Line 2 is after the song ends \(3:00\)/);
});

test('a repeated chorus and common file tags still work', () => {
  const { lines, errors } = checkLyrics('[ar:Someone]\n[offset:+500]\n[00:10.00][00:30.00]Chorus\nThe chorus\n[00:20.00]Verse');
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(lines.map((l) => [l.timeSec, l.text, l.translation]), [
    [9.5, 'Chorus', 'The chorus'],
    [19.5, 'Verse', undefined],
    [29.5, 'Chorus', 'The chorus'],
  ]);
});
