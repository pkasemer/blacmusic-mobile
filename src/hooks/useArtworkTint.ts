import { useEffect, useState } from 'react';
import { generatedTint } from '@/components/Artwork';
import { useTheme } from '@/theme';
import { artworkPalette, getCachedPalette } from '@/utils/dominantColor';

/**
 * Main colour of an item's cover artwork, for tinting the player around it.
 * Cover images: read from the image (cached). Generated tiles: the tile's own colour.
 * Until a new colour is ready the previous one is kept, so the tint cross-fades instead of flashing.
 */
export function useArtworkTint(item: { id: string; logoUrl: string | null } | null): string {
  return useArtworkPalette(item)[0];
}

/**
 * The main colour of an item's artwork followed by up to two other colours that are really in the picture
 * (clearly different hues), for backdrops that should look like the artwork. Never empty.
 */
export function useArtworkPalette(item: { id: string; logoUrl: string | null } | null): string[] {
  return useArtworkPaletteState(item).palette;
}

/** Like `useArtworkPalette`, and says whether the colours are really the picture's (`ready`) or still a stand-in. */
export function useArtworkPaletteState(item: { id: string; logoUrl: string | null } | null): { palette: string[]; ready: boolean } {
  const { colors, isDark } = useTheme();
  const logoUrl = item?.logoUrl ?? null;
  const [fromLogo, setFromLogo] = useState<string[] | null>(() => (logoUrl ? (getCachedPalette(logoUrl) ?? null) : null));

  useEffect(() => {
    if (!logoUrl) return;
    let cancelled = false;
    artworkPalette(logoUrl).then((palette) => {
      if (!cancelled) setFromLogo(palette);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  if (item && !logoUrl) return { palette: [generatedTint(item.id, colors, isDark)], ready: true };
  return { palette: fromLogo ?? [colors.accent], ready: fromLogo !== null };
}
