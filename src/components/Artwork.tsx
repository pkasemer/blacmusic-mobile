import { memo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Ellipse, Rect } from 'react-native-svg';
import { radius as radii, useTheme, type Colors } from '@/theme';
import { CachedImage } from './CachedImage';

/**
 * Cover artwork. Uses `logoUrl` (the cover image) when there is one; otherwise (and if the image fails
 * to load) falls back to a flat tile generated from the id: three rotated ovals, the Blac mark.
 */
function tileSchemes(c: Colors, isDark: boolean) {
  return [
    { bg: c.primary, disc: c.onPrimary, ink: c.onPrimary },
    { bg: c.primarySoft, disc: c.accent, ink: c.accent },
    { bg: isDark ? c.surfaceAlt : '#000000', disc: c.primary, ink: '#FFFFFF' },
    { bg: isDark ? c.surface : '#F2F2F2', disc: c.accent, ink: c.text },
  ];
}

/** The colour that best represents a generated tile, for tinting things around it. */
export function generatedTint(id: string, c: Colors, isDark: boolean): string {
  const schemes = tileSchemes(c, isDark);
  const index = hash(id) % schemes.length;
  // Tiles with a dark or very light background are better represented by their accent disc.
  return index < 2 ? schemes[index].bg : schemes[index].disc;
}

function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Props {
  id: string;
  logoUrl?: string | null;
  size: number;
}

function ArtworkBase({ id, logoUrl, size }: Props) {
  const { colors, isDark } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const radius = radii.card;

  if (logoUrl && failedUrl !== logoUrl) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
        }}
      >
        <CachedImage
          key={logoUrl}
          uri={logoUrl}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setFailedUrl(logoUrl)}
        />
      </View>
    );
  }

  const h = hash(id);
  const schemes = tileSchemes(colors, isDark);
  const scheme = schemes[h % schemes.length];
  // The three ovals of the Blac mark, nudged a little per id so tiles are not all identical.
  const turn = (h % 7) * 4 - 12;

  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect width={100} height={100} fill={scheme.bg} />
        <Ellipse cx={34} cy={36} rx={21} ry={11} fill={scheme.disc} transform={`rotate(${-35 + turn} 34 36)`} />
        <Ellipse cx={72} cy={52} rx={10} ry={22} fill={scheme.disc} transform={`rotate(${-10 + turn} 72 52)`} />
        <Ellipse cx={40} cy={72} rx={22} ry={11} fill={scheme.disc} transform={`rotate(${25 + turn} 40 72)`} />
      </Svg>
    </View>
  );
}

export const Artwork = memo(ArtworkBase);
