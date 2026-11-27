import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ListMusic, Play, RefreshCw } from 'lucide-react-native';
import { playQueue } from '@/audio/music/musicEngine';
import { YOUR_SOUND_NAME } from '@/onboarding/yourSoundRules';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useYourSoundStore } from '@/store/yourSoundStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Artwork } from './Artwork';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

const TILE = 48;
const BUTTON = { flex: 1, height: 54, borderRadius: 12, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 } as const;

/**
 * The sheet that slides up on Home right after onboarding: "Your sound", the playlist made from the listener's picks.
 * It is saved to their account, so after closing this it is always in their Library.
 */
export function YourSoundSheet() {
  const { colors } = useTheme();
  const router = useRouter();
  const show = useOnboardingStore((s) => s.showStarter);
  const songs = useOnboardingStore((s) => s.starter);
  const update = useOnboardingStore((s) => s.update);
  const playlistId = useYourSoundStore((s) => s.playlistId);
  const saving = useYourSoundStore((s) => s.saving);
  const saved = !!playlistId && !saving;

  const play = (from: number) => playQueue(songs, from, { shuffle: false, source: playlistId ? { type: 'playlist', id: playlistId, name: YOUR_SOUND_NAME } : undefined });

  return (
    <BottomSheet visible={show && songs.length > 0} onClose={() => update({ showStarter: false })}>
      {(dismiss) => (
        <View style={{ flexShrink: 1, gap: 14, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: TILE * 2, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 12, overflow: 'hidden' }}>
              {Array.from({ length: 4 }, (_, i) => {
                const song = songs[i % songs.length];
                return <Artwork key={i} id={song.id} logoUrl={song.artworkUrl} size={TILE} />;
              })}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="label" color="textTertiary">
                Made for you
              </Text>
              <Text variant="title" accessibilityRole="header" numberOfLines={1}>
                {YOUR_SOUND_NAME}
              </Text>
              <Text variant="caption" color="textSecondary">
                {songs.length} {songs.length === 1 ? 'song' : 'songs'} from your picks
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
            {saving ? <ActivityIndicator size="small" color={colors.accent} /> : saved ? <Check size={16} color={colors.accent} strokeWidth={3} /> : <RefreshCw size={15} color={colors.accent} />}
            <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
              {saving
                ? 'Saving it to your Library…'
                : saved
                  ? 'Saved in your Library. It keeps updating as you listen.'
                  : "It will be saved to your Library when we can reach Blac."}
            </Text>
          </View>

          <ScrollView style={{ flexShrink: 1, maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {songs.map((song, i) => (
              <Pressable
                key={song.id}
                onPress={() => dismiss(() => play(i))}
                accessibilityRole="button"
                accessibilityLabel={`Play ${song.title} by ${song.artistName}`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, opacity: pressed ? 0.6 : 1 })}
              >
                <Artwork id={song.id} logoUrl={song.artworkUrl} size={44} />
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

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => {
                haptics.select();
                dismiss(() => play(0));
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({ ...BUTTON, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 })}
            >
              <Play size={17} color={colors.onPrimary} fill={colors.onPrimary} strokeWidth={0} />
              <Text variant="bodyStrong" color="onPrimary">
                Play
              </Text>
            </Pressable>
            <Pressable
              onPress={() => dismiss(() => playlistId && router.push({ pathname: '/playlist/[id]', params: { id: playlistId } }))}
              disabled={!saved}
              accessibilityRole="button"
              accessibilityState={{ disabled: !saved }}
              style={({ pressed }) => ({ ...BUTTON, borderWidth: 1, borderColor: colors.borderStrong, opacity: !saved ? 0.4 : pressed ? 0.7 : 1 })}
            >
              <ListMusic size={18} color={colors.text} />
              <Text variant="bodyStrong">Open playlist</Text>
            </Pressable>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}
