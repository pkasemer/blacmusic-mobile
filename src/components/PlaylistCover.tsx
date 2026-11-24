import { View } from 'react-native';
import type { Playlist } from '@/domain/types';
import { radius, useTheme } from '@/theme';
import { Artwork } from './Artwork';
import { CachedImage } from './CachedImage';

/**
 * A playlist's cover: its own picture when it has one; otherwise a 2 by 2 mosaic of its first songs' covers
 * (or one cover filling the square when there are fewer than four); otherwise a generated tile.
 */
export function PlaylistCover({ playlist, size }: { playlist: Pick<Playlist, 'id' | 'artworkUrl' | 'artworkUrls'>; size: number }) {
  const { colors } = useTheme();
  const { artworkUrl, artworkUrls } = playlist;

  if (artworkUrl || artworkUrls.length === 0) return <Artwork id={playlist.id} logoUrl={artworkUrl} size={size} />;

  if (artworkUrls.length < 4) {
    return <Artwork id={playlist.id} logoUrl={artworkUrls[0]} size={size} />;
  }

  const cell = size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.card,
        overflow: 'hidden',
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      {artworkUrls.slice(0, 4).map((url, i) => (
        <CachedImage key={`${i}-${url}`} uri={url} style={{ width: cell, height: cell }} resizeMode="cover" />
      ))}
    </View>
  );
}
