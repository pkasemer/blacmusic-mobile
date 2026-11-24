import { useEffect, useId, useMemo, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme';
import { mixHex, shiftHue } from '@/utils/color';

/**
 * Apple Music style backdrop: big, soft, blurred colour blobs in the artwork's colours that drift
 * slowly, with a fine film grain on top. The blur comes from radial gradients that fade to fully
 * transparent, so it needs no native blur module.
 */

type Tone = 'base' | 'light' | 'dark' | 'warm' | 'cool';

interface Blob {
  /** Centre as a fraction of the screen. */
  x: number;
  y: number;
  /** Diameter as a multiple of the screen width. */
  size: number;
  tone: Tone;
  /** How far it drifts (fraction of screen width) and how much it swells. */
  drift: number;
  swell: number;
  /** Milliseconds for one drift cycle. */
  period: number;
  strength: number;
}

const BLOBS: Blob[] = [
  { x: 0.5, y: 0.36, size: 1.6, tone: 'base', drift: 0.07, swell: 0.1, period: 11000, strength: 0.95 },
  { x: 0.08, y: 0.18, size: 1.2, tone: 'light', drift: 0.1, swell: 0.12, period: 14500, strength: 0.8 },
  { x: 0.96, y: 0.46, size: 1.3, tone: 'warm', drift: 0.08, swell: 0.1, period: 9500, strength: 0.75 },
  { x: 0.22, y: 0.8, size: 1.4, tone: 'dark', drift: 0.1, swell: 0.12, period: 13000, strength: 0.75 },
  { x: 0.86, y: 0.9, size: 1.1, tone: 'cool', drift: 0.09, swell: 0.1, period: 10500, strength: 0.7 },
];

/** `accents` are other colours from the picture itself; without them the warm and cool blobs are hue-shifted from the main one. */
function toneColor(tint: string, tone: Tone, accents: string[] = []): string {
  switch (tone) {
    case 'light':
      return mixHex(tint, '#FFFFFF', 0.4);
    case 'dark':
      return mixHex(tint, '#000000', 0.4);
    case 'warm':
      return accents[0] ?? shiftHue(tint, 28);
    case 'cool':
      return accents[1] ?? accents[0] ?? shiftHue(tint, -28);
    default:
      return tint;
  }
}

function BlobView({
  blob,
  tint,
  accents,
  width,
  height,
  active,
}: {
  blob: Blob;
  tint: string;
  accents: string[];
  width: number;
  height: number;
  active: boolean;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const drift = useSharedValue(0);
  const sway = useSharedValue(0);
  const diameter = blob.size * width;

  useEffect(() => {
    if (active) {
      const loop = (duration: number) =>
        withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
      drift.value = loop(blob.period);
      sway.value = loop(blob.period * 1.35);
    } else {
      cancelAnimation(drift);
      cancelAnimation(sway);
    }
  }, [active, blob.period, drift, sway]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (drift.value * 2 - 1) * blob.drift * width },
      { translateY: (sway.value * 2 - 1) * blob.drift * width },
      { scale: 1 + sway.value * blob.swell },
    ],
  }));

  const color = toneColor(tint, blob.tone, accents);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: blob.x * width - diameter / 2,
          top: blob.y * height - diameter / 2,
          width: diameter,
          height: diameter,
        },
        style,
      ]}
    >
      <Svg width={diameter} height={diameter}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={blob.strength} />
            <Stop offset="0.45" stopColor={color} stopOpacity={blob.strength * 0.5} />
            <Stop offset="0.75" stopColor={color} stopOpacity={blob.strength * 0.14} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={diameter} height={diameter} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

function BlobLayer({
  tint,
  accents,
  opacity,
  active,
  width,
  height,
}: {
  tint: string;
  accents: string[];
  opacity: SharedValue<number>;
  active: boolean;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {BLOBS.map((blob, i) => (
        <BlobView key={i} blob={blob} tint={tint} accents={accents} width={width} height={height} active={active} />
      ))}
    </Animated.View>
  );
}

/**
 * Blurred, drifting blobs in the artwork colour. When `tint` changes the new colours fade in over
 * the old ones. Pass `active={false}` when the player is off-screen so nothing animates needlessly.
 */
export function TintBlobs({
  tint,
  accents,
  active,
  width,
  height,
}: {
  tint: string;
  /** Other colours from the picture, used for the warm and cool blobs. Optional. */
  accents?: string[];
  active: boolean;
  /** Size of the area to fill. Defaults to the whole screen. */
  width?: number;
  height?: number;
}) {
  const { isDark } = useTheme();
  const window = useWindowDimensions();
  const w = width ?? window.width;
  const h = height ?? window.height;
  const palette = useMemo(() => ({ tint, accents: accents ?? [] }), [tint, accents]);
  const paletteKey = `${tint}|${(accents ?? []).join(',')}`;
  const [slots, setSlots] = useState({ a: palette, b: palette, current: 'a' as 'a' | 'b' });
  const fadeA = useSharedValue(1);
  const fadeB = useSharedValue(0);

  // Write the new colour into the hidden slot, then cross-fade to it.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSlots((s) => {
        const now = s[s.current];
        if (`${now.tint}|${now.accents.join(',')}` === paletteKey) return s;
        return s.current === 'a' ? { a: s.a, b: palette, current: 'b' } : { a: palette, b: s.b, current: 'a' };
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [palette, paletteKey]);

  const current = slots.current;
  useEffect(() => {
    fadeA.value = withTiming(current === 'a' ? 1 : 0, { duration: 900 });
    fadeB.value = withTiming(current === 'b' ? 1 : 0, { duration: 900 });
  }, [current, fadeA, fadeB]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.88 : 0.6 }]}>
      <BlobLayer tint={slots.a.tint} accents={slots.a.accents} opacity={fadeA} active={active} width={w} height={h} />
      <BlobLayer tint={slots.b.tint} accents={slots.b.accents} opacity={fadeB} active={active} width={w} height={h} />
    </View>
  );
}

const grain = require('../../assets/grain.png');

/** Size of one grain tile in points. The texture is random noise, so tile seams are invisible. */
const GRAIN_TILE = 192;

/**
 * Fine film grain over the blobs: the "noise" in the Apple Music look. Tiled by hand with a grid of
 * images, because the native "repeat" resize mode stopped partway down the screen.
 */
export function Grain({ opacity = 0.5, width, height }: { opacity?: number; width?: number; height?: number }) {
  const window = useWindowDimensions();
  const columns = Math.ceil((width ?? window.width) / GRAIN_TILE);
  const rows = Math.ceil((height ?? window.height) / GRAIN_TILE);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, overflow: 'hidden' }]}>
      {Array.from({ length: columns * rows }, (_, i) => (
        <Image
          key={i}
          source={grain}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: (i % columns) * GRAIN_TILE,
            top: Math.floor(i / columns) * GRAIN_TILE,
            width: GRAIN_TILE,
            height: GRAIN_TILE,
          }}
        />
      ))}
    </View>
  );
}
