import { ActivityIndicator, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { blacApi } from '@/api/blac';
import { fetchMix, mixKey, type Mix } from '@/audio/music/mixData';
import { playQueue } from '@/audio/music/musicEngine';
import { Artwork } from '@/components/Artwork';
import { DownloadAllButton } from '@/components/CollectionActions';
import { DetailActions } from '@/components/DetailActions';
import { DetailHero, HeroCover, HeroMeta, HeroTitle, useHeroCoverSize, useHeroScroll } from '@/components/DetailHero';
import { ScreenState } from '@/components/ScreenState';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { useTrackMenu } from '@/components/TrackActionSheet';
import { TrackRow } from '@/components/TrackRow';
import { useTheme } from '@/theme';
import { formatTotalLength } from '@/utils/format';

/** The mix chosen from the song `id`: the one made when it was started, or a new one if there is none yet. */
const useMix = (id: string) =>
  useQuery({
    queryKey: mixKey(id),
    queryFn: async (): Promise<Mix | null> => {
      const reference = await blacApi.getTrack(id);
      return reference ? fetchMix(reference, 'mix') : null;
    },
    enabled: !!id,
  });

/** A mix: the song it is based on, then the songs chosen from it. */
export default function MixScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeroScroll();
  const menu = useTrackMenu();
  const cover = useHeroCoverSize(260);
  const query = useMix(id);

  if (query.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
        <Text variant="body" color="textSecondary">
          Making your mix…
        </Text>
      </View>
    );
  }
  const mix = query.data;
  if (!mix) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState kind="error" title="Couldn't open this mix" message="The song may have been removed, or you may be offline." actionLabel="Try again" onAction={() => void query.refetch()} />
      </View>
    );
  }

  const { reference } = mix;
  const tracks = [reference, ...mix.tracks];
  const source = { type: 'mix', id: reference.id, name: reference.title } as const;
  const length = formatTotalLength(tracks.reduce((sum, t) => sum + t.durationSec, 0));

  return (
    <TabScreen>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: colors.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <DetailHero scrollY={scrollY} artwork={{ id: reference.id, logoUrl: reference.artworkUrl }}>
          <HeroCover size={cover}>
            <Artwork id={reference.id} logoUrl={reference.artworkLargeUrl ?? reference.artworkUrl} size={cover} />
          </HeroCover>
          <HeroTitle>{`${reference.title} Mix`}</HeroTitle>
          <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            Based on “{reference.title}” by {reference.artistName}
          </Text>
          <HeroMeta>{[reference.genre, `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`, length].filter(Boolean).join(' · ')}</HeroMeta>
        </DetailHero>

        <DetailActions items={tracks} source={source} tools={<DownloadAllButton tracks={tracks} what="mix" />} />

        <View>
          {tracks.map((track, i) => (
            <TrackRow key={track.id} item={track} onPress={() => playQueue(tracks, i, { source })} onMore={() => menu.open(track)} separator={i < tracks.length - 1} />
          ))}
        </View>
        {mix.tracks.length === 0 ? (
          <Text variant="body" color="textSecondary" style={{ paddingHorizontal: 32, textAlign: 'center' }}>
            There are no other songs like this one yet.
          </Text>
        ) : null}
      </Animated.ScrollView>
      {menu.sheet}
    </TabScreen>
  );
}
