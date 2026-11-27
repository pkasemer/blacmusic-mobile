/**
 * The format lyrics are written in. A lyric line starts with the time it is sung, like `[01:07.50]`; the line directly
 * below it, without a time, is its English translation (optional). With no times anywhere, the text is plain lyrics.
 *
 *     [00:12.50]Nkwagala nnyo
 *     I love you so much
 *     [00:17.20]Oh yeah
 *
 * The server and the admin site follow the same rules; the app uses them to check lyrics before saving.
 */

export interface TimedLine {
  timeSec: number;
  text: string;
  translation?: string;
}

export interface FormatError {
  /** The line of the text as typed, counting from 1. */
  line: number;
  message: string;
}

export interface CheckedLyrics {
  /** There is at least one time stamp. */
  timed: boolean;
  /** The timed lines, in the order they are sung. Empty for plain lyrics. */
  lines: TimedLine[];
  errors: FormatError[];
}

export const MAX_LINE_LENGTH = 500;

const STAMP = /^\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/;
/** Starts like a time: `[` then a digit. */
const LOOKS_LIKE_STAMP = /^\[\s*\d/;
/** Other LRC tags, such as `[ar:Name]` or `[offset:+200]`. */
const TAG = /^\[([a-z#]+):([^\]]*)\]$/i;
const WORD_STAMP = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g;

const pad = (n: number) => String(n).padStart(2, '0');

/** `75.5` as `[01:15.50]`. */
export function stamp(timeSec: number): string {
  const hundredths = Math.max(0, Math.round(timeSec * 100));
  return `[${pad(Math.floor(hundredths / 6000))}:${pad(Math.floor(hundredths / 100) % 60)}.${pad(hundredths % 100)}]`;
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;

/** Timed lines written out again, for editing. */
export const toLrc = (lines: TimedLine[]) => lines.map((l) => stamp(l.timeSec) + l.text + (l.translation ? `\n${l.translation}` : '')).join('\n');

/** True when any line starts with a time, so the whole text is read as timed lyrics. */
export const looksTimed = (text: string) => text.split(/\r?\n/).some((line) => STAMP.test(line.trim()));

/** Reads lyrics and says what is wrong with them. `durationSec` is the song's length, when known. */
export function checkLyrics(source: string, durationSec?: number): CheckedLyrics {
  const rows = source.split(/\r?\n/).map((row) => row.trim());
  if (!rows.some((row) => STAMP.test(row))) return { timed: false, lines: [], errors: [] };

  const errors: FormatError[] = [];
  const found: (TimedLine & { order: number })[] = [];
  /** The lyric line a translation may follow: the one directly above. */
  let above: { words: boolean; made: TimedLine[]; translated: boolean } | null = null;
  /** The last line with a single time, to keep times in order. */
  let last: { sec: number; line: number } | null = null;
  let offsetSec = 0;

  rows.forEach((row, i) => {
    const line = i + 1;
    const fail = (message: string) => errors.push({ line, message });
    if (!row) {
      above = null;
      return;
    }
    const tag = TAG.exec(row);
    if (tag) {
      if (tag[1].toLowerCase() === 'offset') offsetSec = (Number(tag[2]) || 0) / 1000;
      above = null;
      return;
    }

    let rest = row;
    const times: number[] = [];
    for (let m = STAMP.exec(rest); m; m = STAMP.exec(rest)) {
      times.push(Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0));
      rest = rest.slice(m[0].length).trimStart();
    }

    if (LOOKS_LIKE_STAMP.test(rest)) {
      fail(`Line ${line}: write the time as [mm:ss.xx], for example [01:07.50].`);
      above = null;
      return;
    }

    if (times.length === 0) {
      if (!above || above.translated) {
        fail(`Line ${line} has no time stamp. A translation goes directly under its lyric line, one per line.`);
      } else if (!above.words) {
        fail(`Line ${line}: a music break has no translation.`);
      } else {
        if (row.length > MAX_LINE_LENGTH) fail(`Line ${line} is longer than ${MAX_LINE_LENGTH} characters.`);
        for (const made of above.made) made.translation = row;
      }
      if (above) above.translated = true;
      return;
    }

    const text = rest.replace(WORD_STAMP, '').trim();
    if (text.length > MAX_LINE_LENGTH) fail(`Line ${line} is longer than ${MAX_LINE_LENGTH} characters.`);
    if (times.length === 1) {
      if (last && times[0] <= last.sec) {
        fail(
          times[0] === last.sec
            ? `Line ${line} has the same time as line ${last.line}. A translation line has no time stamp.`
            : `Line ${line}: its time must be after ${stamp(last.sec)} on line ${last.line}.`,
        );
      } else {
        last = { sec: times[0], line };
      }
    }
    if (durationSec && times.some((t) => t > durationSec + 1)) fail(`Line ${line} is after the song ends (${clock(durationSec)}).`);

    const made = times.map((timeSec) => ({ timeSec, text, order: found.length }));
    found.push(...made);
    above = { words: text.length > 0, made, translated: false };
  });

  const lines = found
    .sort((a, b) => a.timeSec - b.timeSec || a.order - b.order)
    // A positive offset means the lyrics show earlier.
    .map(({ order, ...l }) => ({ ...l, timeSec: Math.max(0, l.timeSec - offsetSec) }));
  return { timed: true, lines, errors };
}
