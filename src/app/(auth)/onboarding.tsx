import { useRef, useState, type ComponentType } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartNoAxesColumn, ChevronLeft, Download, Headphones, Heart, ListMusic, MessageSquareQuote, Search, Upload, Users, type LucideProps } from 'lucide-react-native';
import { AuthSheet, type AuthMode } from '@/components/AuthSheet';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { Text } from '@/components/Text';
import { radius } from '@/theme';
import { haptics } from '@/utils/haptics';

const ACCENT = '#BB88FF';

interface Point {
  Icon: ComponentType<LucideProps>;
  title: string;
  text: string;
}

interface Slide {
  key: string;
  /** A small line above the title. */
  eyebrow: string;
  title: string;
  points: Point[];
}

/** The tour: three pages, each a short title and three lines with an icon. */
const SLIDES: Slide[] = [
  {
    key: 'listen',
    eyebrow: 'Listen',
    title: 'Music and podcasts, together',
    points: [
      { Icon: Headphones, title: 'Stream anything', text: 'Songs, albums and shows in one app, with no switching around.' },
      { Icon: Search, title: 'Find what is next', text: 'Search artists, albums and playlists, and see what is new.' },
      { Icon: Download, title: 'Take it with you', text: 'Download your favourites and play them without a connection.' },
    ],
  },
  {
    key: 'yours',
    eyebrow: 'Yours',
    title: 'Make it yours',
    points: [
      { Icon: Heart, title: 'Like what you love', text: 'Your likes are saved in one place, ready to play.' },
      { Icon: ListMusic, title: 'Build playlists', text: 'Keep them private, or share them with anyone.' },
      { Icon: MessageSquareQuote, title: 'Sing along', text: 'Follow the lyrics as the song plays.' },
    ],
  },
  {
    key: 'share',
    eyebrow: 'Artists',
    title: 'Share your own music',
    points: [
      { Icon: Upload, title: 'Upload in minutes', text: 'Add a single or an album and choose when it goes live.' },
      { Icon: ChartNoAxesColumn, title: 'See who is listening', text: 'Plays, listeners and how each release is doing.' },
      { Icon: Users, title: 'Credit your team', text: 'Name the producers, writers and engineers behind a song.' },
    ],
  },
];

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, input, [7, 22, 7], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[{ height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' }, style]} />;
}

function SlidePage({ slide, width, top }: { slide: Slide; width: number; top: number }) {
  return (
    <View style={{ width, paddingHorizontal: 28, paddingTop: top }}>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 10 }}>
        <Text variant="label" color="accent" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {slide.eyebrow}
        </Text>
        <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
          {slide.title}
        </Text>
      </Animated.View>

      <View style={{ gap: 26, paddingTop: 40 }}>
        {slide.points.map((p, i) => (
          <Animated.View key={p.title} entering={FadeInDown.delay(120 + i * 90).duration(420)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
            <View style={{ width: 40, alignItems: 'center', paddingTop: 2 }}>
              <p.Icon size={30} color={ACCENT} strokeWidth={1.7} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="headline" style={{ fontSize: 18, lineHeight: 23 }}>
                {p.title}
              </Text>
              <Text variant="body" color="textSecondary" style={{ fontSize: 16, lineHeight: 22 }}>
                {p.text}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/** The tour "Get started" opens: swipe or tap Continue through what the app does, then make an account. */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const list = useRef<Animated.FlatList<Slide>>(null);
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState<AuthMode | null>(null);
  const [lastMode, setLastMode] = useState<AuthMode>('signup');

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });
  const last = page === SLIDES.length - 1;
  const goTo = (index: number) => list.current?.scrollToIndex({ index, animated: true });
  const open = (mode: AuthMode) => {
    setLastMode(mode);
    setSheet(mode);
  };

  return (
    <>
      <BrandBackdrop>
        <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 20) + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 44 }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ padding: 8 }}>
              <ChevronLeft size={26} color="#FFFFFF" />
            </Pressable>
            {!last ? (
              <Pressable onPress={() => goTo(SLIDES.length - 1)} hitSlop={10} accessibilityRole="button" style={{ padding: 8, paddingRight: 14 }}>
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
            renderItem={({ item }) => <SlidePage slide={item} width={width} top={28} />}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            style={{ flex: 1 }}
          />

          <View style={{ alignItems: 'center', gap: 22, paddingHorizontal: 28 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', height: 8 }}>
              {SLIDES.map((s, i) => (
                <Dot key={s.key} index={i} scrollX={scrollX} width={width} />
              ))}
            </View>

            <View style={{ width: '100%', gap: 4 }}>
              <Pressable
                onPress={() => {
                  if (last) {
                    haptics.medium();
                    open('signup');
                  } else {
                    haptics.select();
                    goTo(page + 1);
                  }
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({ height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1 })}
              >
                <Text variant="bodyStrong" style={{ color: '#121212', fontSize: 17 }}>
                  {last ? 'Create your account' : 'Continue'}
                </Text>
              </Pressable>
              {last ? (
                <Pressable onPress={() => open('signin')} accessibilityRole="button" style={{ alignItems: 'center', padding: 14 }}>
                  <Text variant="body" color="textSecondary">
                    Already have an account?{' '}
                    <Text variant="bodyStrong" color="accent">
                      Sign in
                    </Text>
                  </Text>
                </Pressable>
              ) : (
                <View style={{ height: 48 }} />
              )}
            </View>
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
