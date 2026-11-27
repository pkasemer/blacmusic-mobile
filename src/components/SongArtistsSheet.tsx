import { Pressable, ScrollView, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useArtist } from '@/api/blac/queries';
import { artistsOf, type SongArtist } from '@/domain/artists';
import type { Track } from '@/domain/types';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';
import { VerifiedBadge } from './VerifiedBadge';

/** A song, or a release: what is needed to list who is on it. */
type Credited = Pick<Track, 'title' | 'artistId' | 'artistName' | 'artistVerified' | 'artistImageUrl' | 'featuredArtists'>;

function Row({ artist, onPress }: { artist: SongArtist; onPress: () => void }) {
  const { colors } = useTheme();
  // A song does not always carry its artists' pictures: their profiles have them.
  const profile = useArtist(artist.id ?? '').data;
  const verified = artist.verified || profile?.verification === 'verified';
  const role = artist.featured ? 'Featured' : 'Main artist';
  return (
    <Pressable
      onPress={onPress}
      disabled={!artist.id}
      accessibilityRole="button"
      accessibilityLabel={artist.id ? `${artist.name}, ${role}. Open profile` : `${artist.name}, ${role}. No profile on Blac`}
      accessibilityState={{ disabled: !artist.id }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingHorizontal: 20, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
    >
      <Avatar url={profile?.avatarUrl ?? artist.imageUrl} name={artist.name} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {artist.name}
          </Text>
          {verified ? <VerifiedBadge size={15} /> : null}
        </View>
        <Text variant="caption" color="textSecondary">
          {artist.id ? role : `${role} · No profile on Blac yet`}
        </Text>
      </View>
      {artist.id ? <ChevronRight size={20} color={colors.textTertiary} /> : null}
    </Pressable>
  );
}

/**
 * Everyone on a song. Tapping an artist's name anywhere opens this first; picking one slides it away and then calls
 * `onOpen` with their id, to go to the profile.
 */
export function SongArtistsSheet({ track, onClose, onOpen }: { track: Credited | null; onClose: () => void; onOpen: (artistId: string) => void }) {
  return (
    <BottomSheet visible={!!track} onClose={onClose}>
      {(dismiss) =>
        track ? (
          <View style={{ flexShrink: 1 }}>
            <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 2 }}>
              <Text variant="title" accessibilityRole="header">
                {artistsOf(track).length > 1 ? 'Artists' : 'Artist'}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {track.title}
              </Text>
            </View>
            <ScrollView style={{ flexShrink: 1 }} bounces={false}>
              {artistsOf(track).map((artist) => (
                <Row
                  key={artist.id ?? artist.name}
                  artist={artist}
                  onPress={() => {
                    haptics.select();
                    dismiss(() => artist.id && onOpen(artist.id));
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null
      }
    </BottomSheet>
  );
}
