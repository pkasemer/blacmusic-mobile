import { memo, useState } from 'react';
import { View } from 'react-native';
import { reachable } from '@/api/blac/config';
import { useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { CachedImage } from './CachedImage';
import { Text } from './Text';

/** One or two capital letters from a name, for when there is no picture. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface Props {
  /** The picture, or empty for initials. */
  url?: string | null;
  /** Used for the initials and as the accessibility label. */
  name: string;
  size: number;
}

/** Round profile picture, with the person's initials on the brand purple when there is no picture (or it fails to load). */
function AvatarBase({ url, name, size }: Props) {
  const { colors } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const source = reachable(url);

  return (
    <View
      accessibilityLabel={`Profile picture of ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {source && failedUrl !== source ? (
        <CachedImage
          key={source}
          uri={source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setFailedUrl(source)}
        />
      ) : (
        <Text
          variant="title"
          style={{ ...fontStyle('rounded', '700'), fontSize: size * 0.38, lineHeight: size * 0.5, color: colors.accent }}
        >
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

export const Avatar = memo(AvatarBase);
