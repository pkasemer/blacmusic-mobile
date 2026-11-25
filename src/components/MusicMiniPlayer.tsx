import { Pressable, View } from 'react-native';
import { toggleMusicPlayback } from '@/audio/music/musicEngine';
import type { Playable } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Artwork } from './Artwork';
import { PlayButton } from './PlayButton';
import { ArtistName } from './ArtistName';
import { Text } from './Text';
import { subtitleOf } from './TrackRow';

function useMusicPhase() {
  const playing = useMusicStore((s) => s.playing);
  const buffering = useMusicStore((s) => s.buffering);
  return playing ? (buffering ? 'buffering' : 'playing') : 'paused';
}

const openMusicPlayer = () => {
  haptics.light();
  useMusicStore.getState().set({ isFullOpen: true });
};

/** Docked mini player for music and podcasts (Android, and iOS before 26). Tap to open the full player. */
export function MusicMiniPlayer({ item }: { item: Playable }) {
  const { colors } = useTheme();
  const phase = useMusicPhase();
  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 8, backgroundColor: colors.bg }}>
      <Pressable
        onPress={openMusicPlayer}
        accessibilityRole="button"
        accessibilityLabel={`Open player. ${item.title}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 8,
          paddingRight: 12,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Artwork id={item.id} logoUrl={item.artworkUrl} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={1}>
            {item.title}
          </Text>
          <ArtistName name={subtitleOf(item)} verified={item.kind === 'track' ? item.artistVerified : false} />
        </View>
        <PlayButton phase={phase} size={40} onPress={toggleMusicPlayback} />
      </Pressable>
    </View>
  );
}

/** Content for the iOS 26 tab bar accessory slot (the system draws the capsule). */
export function MusicMiniAccessory({ item, inline }: { item: Playable; inline: boolean }) {
  const phase = useMusicPhase();
  return (
    <Pressable
      onPress={openMusicPlayer}
      accessibilityRole="button"
      accessibilityLabel={`Open player. ${item.title}`}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: inline ? 8 : 12,
        paddingHorizontal: inline ? 10 : 14,
      }}
    >
      <Artwork id={item.id} logoUrl={item.artworkUrl} size={inline ? 26 : 36} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ fontSize: inline ? 13 : 14, lineHeight: 18 }}>
          {item.title}
        </Text>
        {inline ? null : (
          <ArtistName name={subtitleOf(item)} verified={item.kind === 'track' ? item.artistVerified : false} />
        )}
      </View>
      <PlayButton phase={phase} size={inline ? 30 : 36} tone="plain" onPress={toggleMusicPlayback} />
    </Pressable>
  );
}
