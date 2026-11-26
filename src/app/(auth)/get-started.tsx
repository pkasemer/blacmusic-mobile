import { useState, type ComponentType } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartNoAxesColumn, ChevronLeft, Download, Headphones, Heart, ListMusic, MessageSquareQuote, Search, Upload, Users, type LucideProps } from 'lucide-react-native';
import { AuthOptions, type AuthMode } from '@/components/AuthSheet';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { Text } from '@/components/Text';

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

function SlidePage({ slide, width }: { slide: Slide; width: number }) {
  return (
    // Scrolls on short phones, where the sign-in buttons leave less room.
    <ScrollView style={{ width }} contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 10 }}>
        <Text variant="label" color="accent" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {slide.eyebrow}
        </Text>
        <Text variant="display" style={{ fontSize: 30, lineHeight: 36 }}>
          {slide.title}
        </Text>
      </Animated.View>

      <View style={{ gap: 18, paddingTop: 26 }}>
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
    </ScrollView>
  );
}

/** "Get Started": what the app does (swipe through it), with the ways to make an account always underneath. */
export default function GetStartedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const [mode, setMode] = useState<AuthMode>('signup');

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  return (
    <BrandBackdrop>
      <View style={{ flex: 1, paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ paddingHorizontal: 12, height: 40, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ padding: 8 }}>
            <ChevronLeft size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <Animated.FlatList
          data={SLIDES}
          keyExtractor={(slide) => slide.key}
          renderItem={({ item }) => <SlidePage slide={item} width={width} />}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          style={{ flex: 1 }}
        />

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 28 }}>
          {SLIDES.map((slide, i) => (
            <Dot key={slide.key} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>

        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          {/* Signing in swaps to the next screen by itself. */}
          <AuthOptions
            onBrand
            mode={mode}
            dismiss={(after) => after?.()}
            onEmail={() => router.push({ pathname: '/sign-in', params: { mode } })}
            onSwitchMode={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
          />
        </View>
      </View>
    </BrandBackdrop>
  );
}
