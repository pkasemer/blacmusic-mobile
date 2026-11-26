import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Play, X } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playQueue } from '@/audio/music/musicEngine';
import { useOnboardingStore } from '@/store/onboardingStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Artwork } from './Artwork';
import { Text } from './Text';

const TILE = 64;

/**
 * The card that pops up on Home right after onboarding: the ready-made playlist from the listener's picks, with its
 * songs, to play now or later (it stays on the big card at the top of Home).
 */
export function StarterPlaylist() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const show = useOnboardingStore((s) => s.showStarter);
  const songs = useOnboardingStore((s) => s.starter);
  const update = useOnboardingStore((s) => s.update);

  if (!show || songs.length === 0) return null;
  const close = () => update({ showStarter: false });
  const play = (from: number) => {
    close();
    playQueue(songs, from, { shuffle: false });
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}>
        <Animated.View
          entering={ZoomIn.delay(80).duration(260)}
          accessibilityViewIsModal
          style={{ width: '100%', maxWidth: 420, maxHeight: '100%', borderRadius: radius.xl, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}
        >
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={{ position: 'absolute', right: 14, top: 14, zIndex: 1 }}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>

          <View style={{ alignSelf: 'center', width: TILE * 2, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 14, overflow: 'hidden' }}>
            {Array.from({ length: 4 }, (_, i) => {
              const song = songs[i % songs.length];
              return <Artwork key={i} id={song.id} logoUrl={song.artworkUrl} size={TILE} />;
            })}
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
              Your first playlist is ready
            </Text>
            <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              {songs.length} {songs.length === 1 ? 'song' : 'songs'} to start you off, from your picks
            </Text>
          </View>

          <ScrollView style={{ flexShrink: 1, maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {songs.map((song, i) => (
              <Pressable
                key={song.id}
                onPress={() => play(i)}
                accessibilityRole="button"
                accessibilityLabel={`Play ${song.title} by ${song.artistName}`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, opacity: pressed ? 0.6 : 1 })}
              >
                <Artwork id={song.id} logoUrl={song.artworkUrl} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {song.artistName}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => {
              haptics.select();
              play(0);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.pill, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 })}
          >
            <Play size={17} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
            <Text variant="bodyStrong" color="onPrimary">
              Play
            </Text>
          </Pressable>
          <Pressable onPress={close} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text variant="body" color="textSecondary">
              Not now
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
