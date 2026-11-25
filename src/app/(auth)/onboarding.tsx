import { useRef, useState, type ComponentType } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Compass, Download, Headphones, ListMusic, Mic, type LucideProps } from 'lucide-react-native';
import { AuthSheet, type AuthMode } from '@/components/AuthSheet';
import { Avatar } from '@/components/Avatar';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { Text } from '@/components/Text';
import { useShowcase } from '@/store/showcaseStore';
import type { ShowcaseItem } from '@/api/blac/showcase';
import { radius } from '@/theme';
import { haptics } from '@/utils/haptics';

interface Slide {
  key: string;
  Icon: ComponentType<LucideProps>;
  tint: string;
  accents: string[];
  title: string;
  text: string;
  chips: string[];
}

/** The tour: one idea per page, each with its own colour. */
const SLIDES: Slide[] = [
  {
    key: 'everything',
    Icon: Headphones,
    tint: '#BB88FF',
    accents: ['#6C8BFF', '#FF7AB8'],
    title: 'Music and podcasts, together',
    text: 'Songs, albums and shows in one app, so you never switch around to hear what you want.',
    chips: ['Songs', 'Albums', 'Podcasts', 'Playlists'],
  },
  {
    key: 'discover',
    Icon: Compass,
    tint: '#6C8BFF',
    accents: ['#5FD1A1', '#BB88FF'],
    title: "Find what you'll love next",
    text: 'Browse featured artists, fresh releases and playlists for every mood, from workout to chill to focus.',
    chips: ['Workout', 'Chill', 'Focus', 'Party', 'Throwback'],
  },
  {
    key: 'yours',
    Icon: ListMusic,
    tint: '#FF7AB8',
    accents: ['#BB88FF', '#FFB65C'],
    title: 'Make it yours',
    text: 'Like songs, build playlists and pick up right where you stopped. Keep them private or share them.',
    chips: ['Likes', 'Your playlists', 'Recently played'],
  },
  {
    key: 'anywhere',
    Icon: Download,
    tint: '#5FD1A1',
    accents: ['#6C8BFF', '#BB88FF'],
    title: 'Listen anywhere',
    text: 'Download for offline, keep playing in the background, control it from your lock screen, and fall asleep to the sleep timer.',
    chips: ['Offline', 'Lock screen', 'Sleep timer', 'Sound quality'],
  },
  {
    key: 'artists',
    Icon: Mic,
    tint: '#FFB65C',
    accents: ['#FF7AB8', '#BB88FF'],
    title: 'Share your own music',
    text: 'Make music? Upload it, bring your songs over from YouTube, and keep ownership. Your Studio shows how every release is doing.',
    chips: ['Upload', 'YouTube import', 'Schedule releases', 'Your Studio'],
  },
];

function SlidePage({ slide, width, picks }: { slide: Slide; width: number; picks: ShowcaseItem[] }) {
  const { Icon } = slide;
  return (
    <View style={{ width, paddingHorizontal: 28, justifyContent: 'center', gap: 28 }}>
      {/* A glass disc with the feature's icon, ringed in its colour */}
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 168,
            height: 168,
            borderRadius: 84,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          <View
            style={{
              width: 116,
              height: 116,
              borderRadius: 58,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: slide.tint,
            }}
          >
            <Icon size={54} color="#121212" strokeWidth={2} />
          </View>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="display" style={{ fontSize: 34, lineHeight: 40, textAlign: 'center' }}>
          {slide.title}
        </Text>
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center', fontSize: 16, lineHeight: 24 }}>
          {slide.text}
        </Text>
      </View>

      {/* On the discovery page: some of the artists on Blac right now, when the team has picked any */}
      {slide.key === 'discover' && picks.length > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
          {picks.slice(0, 4).map((p) => (
            <View key={p.id} style={{ alignItems: 'center', gap: 6, width: 64 }}>
              <Avatar url={p.imageUrl} name={p.name} size={56} />
              <Text variant="caption" numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 11 }}>
                {p.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {slide.chips.map((chip) => (
          <View
            key={chip}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: radius.pill,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <Text variant="caption" style={{ color: '#FFFFFF' }}>
              {chip}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, input, [8, 26, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.4, 1, 0.4], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }, style]} />;
}

/** The feature tour that "Get started" opens: swipe through what the app does, then create an account. */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const list = useRef<Animated.FlatList<Slide>>(null);
  const scrollX = useSharedValue(0);
  const showcase = useShowcase();
  const picks = showcase.filter((i) => i.kind === 'artist');
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState<AuthMode | null>(null);
  const [lastMode, setLastMode] = useState<AuthMode>('signup');

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });
  const last = page === SLIDES.length - 1;
  const slide = SLIDES[page] ?? SLIDES[0];
  const goTo = (index: number) => list.current?.scrollToIndex({ index, animated: true });
  const open = (mode: AuthMode) => {
    setLastMode(mode);
    setSheet(mode);
  };

  return (
    <>
      <BrandBackdrop tint={slide.tint} accents={slide.accents}>
        <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 20) + 8 }}>
          {/* Back to the welcome screen, and a way to skip to the end */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 44 }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ padding: 8 }}>
              <ChevronLeft size={26} color="#FFFFFF" />
            </Pressable>
            {!last ? (
              <Pressable onPress={() => goTo(SLIDES.length - 1)} hitSlop={10} accessibilityRole="button" style={{ padding: 8 }}>
                <Text variant="bodyStrong" color="textSecondary">
                  Skip
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Animated.FlatList
            ref={list}
            data={SLIDES}
            keyExtractor={(s) => s.key}
            renderItem={({ item }) => <SlidePage slide={item} width={width} picks={picks} />}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            style={{ flex: 1 }}
          />

          <View style={{ alignItems: 'center', gap: 22, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', height: 8 }}>
              {SLIDES.map((s, i) => (
                <Dot key={s.key} index={i} scrollX={scrollX} width={width} />
              ))}
            </View>

            {last ? (
              <View style={{ width: '100%', gap: 4 }}>
                <Pressable
                  onPress={() => {
                    haptics.medium();
                    open('signup');
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#BB88FF', opacity: pressed ? 0.85 : 1 })}
                >
                  <Text variant="bodyStrong" style={{ color: '#121212', fontSize: 17 }}>
                    Create your account
                  </Text>
                </Pressable>
                <Pressable onPress={() => open('signin')} accessibilityRole="button" style={{ alignItems: 'center', padding: 14 }}>
                  <Text variant="body" color="textSecondary">
                    Already have an account?{' '}
                    <Text variant="bodyStrong" color="accent">
                      Sign in
                    </Text>
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  haptics.select();
                  goTo(page + 1);
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({ width: '100%', height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#BB88FF', opacity: pressed ? 0.85 : 1 })}
              >
                <Text variant="bodyStrong" style={{ color: '#121212', fontSize: 17 }}>
                  Next
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </BrandBackdrop>

      <AuthSheet
        visible={sheet !== null}
        mode={sheet ?? lastMode}
        onClose={() => setSheet(null)}
        onEmail={(mode) => router.push({ pathname: '/sign-in', params: { mode } })}
        onSwitchMode={() => setSheet((m) => (m === 'signin' ? 'signup' : 'signin'))}
      />
    </>
  );
}

