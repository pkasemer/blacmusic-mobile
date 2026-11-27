import { View } from 'react-native';
import type { FormatError } from '@/domain/lyricsFormat';
import { Card } from './Card';
import { Text } from './Text';

const EXAMPLE = '[00:12.50]Nkwagala nnyo\nI love you so much\n[00:17.20]Oh yeah\n[00:21.00]Tuula nange\nStay with me';
const SHOWN = 5;

/** How to write lyrics that follow the song, with translations. */
export function LyricsFormatHelp() {
  return (
    <Card style={{ padding: 14, gap: 10 }}>
      <Text variant="bodyStrong">Timed lyrics with translations</Text>
      <Text variant="caption" color="textSecondary">
        Start each lyric line with the moment it is sung: [minutes:seconds.hundredths]. For an English translation, write it on the very next line, with no time. Translations are optional, one per lyric line. A time with nothing after it is a music break.
      </Text>
      <Text variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
        {EXAMPLE}
      </Text>
    </Card>
  );
}

/** What is wrong with the lyrics as typed, line by line. */
export function LyricsProblems({ errors }: { errors: FormatError[] }) {
  if (errors.length === 0) return null;
  return (
    <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
      {errors.slice(0, SHOWN).map((e) => (
        <Text key={`${e.line}-${e.message}`} variant="caption" color="danger">
          {e.message}
        </Text>
      ))}
      {errors.length > SHOWN ? (
        <Text variant="caption" color="danger">
          And {errors.length - SHOWN} more.
        </Text>
      ) : null}
    </View>
  );
}
