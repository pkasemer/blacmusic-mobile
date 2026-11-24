import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius, useTheme } from '@/theme';

/**
 * Skeleton loading placeholders: flat blocks shaped like the content that is about to appear,
 * pulsing gently together. Wrap a set of blocks in `SkeletonGroup` so they share one animation and
 * are announced to screen readers as a single "Loading". With Reduce Motion on, they stay still.
 */
const PulseContext = createContext<SharedValue<number> | null>(null);

export function SkeletonGroup({
  children,
  label = 'Loading',
  style,
}: {
  children: ReactNode;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse]);

  return (
    <PulseContext.Provider value={pulse}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        importantForAccessibility="no-hide-descendants"
        style={style}
      >
        {children}
      </View>
    </PulseContext.Provider>
  );
}

/** One placeholder block. */
export function Skeleton({
  width,
  height,
  rounded = 6,
  style,
}: {
  width?: DimensionValue;
  height: DimensionValue;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  const pulse = useContext(PulseContext);
  const animated = useAnimatedStyle(() => ({ opacity: pulse ? 0.5 + pulse.value * 0.5 : 1 }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: rounded, backgroundColor: isDark ? colors.surfaceAlt : colors.border },
        style,
        animated,
      ]}
    />
  );
}

/** A bordered card, the same shell the real cards use. */
function SkeletonCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Looks like a song row: cover, two lines of text, a length. */
export function TrackRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 16 }}>
      <Skeleton width={48} height={48} rounded={radius.card} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="58%" height={14} />
        <Skeleton width="36%" height={11} />
      </View>
      <Skeleton width={28} height={11} />
    </View>
  );
}

/** A list of song rows, for Search. */
export function TrackRowsSkeleton({ count = 7 }: { count?: number }) {
  return (
    <SkeletonGroup label="Loading songs" style={{ gap: 2 }}>
      {Array.from({ length: count }, (_, i) => (
        <TrackRowSkeleton key={i} />
      ))}
    </SkeletonGroup>
  );
}

/** Looks like a shelf: a section title and a few square covers. */
function ShelfSkeleton({ titleWidth = 110 }: { titleWidth?: number }) {
  return (
    <View style={{ gap: 14 }}>
      <Skeleton width={titleWidth} height={22} style={{ marginHorizontal: 20 }} />
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 20, overflow: 'hidden' }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 140, gap: 8 }}>
            <Skeleton width={140} height={140} rounded={radius.card} />
            <View style={{ gap: 6 }}>
              <Skeleton width="70%" height={14} />
              <Skeleton width="50%" height={11} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The whole Home screen below the greeting while it loads. */
export function HomeSkeleton() {
  return (
    <SkeletonGroup label="Loading home" style={{ gap: 28 }}>
      <ShelfSkeleton titleWidth={100} />
      <ShelfSkeleton titleWidth={130} />
      <ShelfSkeleton titleWidth={90} />
    </SkeletonGroup>
  );
}

/** Placeholder for one Settings section: a small caption and a card of rows. */
export function SettingsSectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <SkeletonGroup label="Loading settings" style={{ gap: 10 }}>
      <Skeleton width={90} height={11} style={{ marginLeft: 4 }} />
      <SkeletonCard style={{ paddingHorizontal: 16 }}>
        {Array.from({ length: rows }, (_, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 16,
            }}
          >
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="48%" height={14} />
              <Skeleton width="86%" height={11} />
            </View>
            <Skeleton width={46} height={28} rounded={14} />
          </View>
        ))}
      </SkeletonCard>
    </SkeletonGroup>
  );
}
