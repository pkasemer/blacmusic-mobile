import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAudioPlaylistStatus } from 'expo-audio';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { formatTime } from '@/audio/music/queue';
import { getPlaylist, seekMusic } from '@/audio/music/musicEngine';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

const TRACK_HEIGHT = 4;
const THUMB = 14;
const TOUCH_HEIGHT = 36;

/**
 * Progress bar for the on-demand player: shows position and length, and seeks on tap or drag.
 * It follows the native player directly (not the store) so the rest of the screen does not re-render
 * every half second. While dragging it shows where you are dragging to and seeks once on release.
 */
export function SeekBar({ trackColor, fillColor }: { trackColor?: string; fillColor?: string }) {
  const { colors } = useTheme();
  const status = useAudioPlaylistStatus(getPlaylist());
  const duration = status.duration > 0 ? status.duration : 0;

  const width = useSharedValue(0);
  const fraction = useSharedValue(0);
  const durationSv = useSharedValue(0);
  const dragging = useSharedValue(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  useEffect(() => {
    durationSv.value = duration;
  }, [duration, durationSv]);

  // Follow the player unless the finger is on the bar.
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const isDragging = dragTime !== null;
  useEffect(() => {
    if (!isDragging) fraction.value = progress;
  }, [progress, isDragging, fraction]);

  // Stable JS-side callbacks, so the gesture is built once and a re-render never interrupts a drag.
  const startDrag = useCallback(() => haptics.select(), []);
  const updateDrag = useCallback((seconds: number) => setDragTime(seconds), []);
  const endDrag = useCallback((seconds: number) => {
    seekMusic(seconds);
    setDragTime(null);
  }, []);

  /* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable by design. */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          const f = Math.min(1, Math.max(0, e.x / Math.max(1, width.value)));
          dragging.value = true;
          fraction.value = f;
          scheduleOnRN(startDrag);
          scheduleOnRN(updateDrag, f * durationSv.value);
        })
        .onUpdate((e) => {
          const f = Math.min(1, Math.max(0, e.x / Math.max(1, width.value)));
          fraction.value = f;
          scheduleOnRN(updateDrag, f * durationSv.value);
        })
        .onFinalize((e) => {
          const f = Math.min(1, Math.max(0, e.x / Math.max(1, width.value)));
          dragging.value = false;
          scheduleOnRN(endDrag, f * durationSv.value);
        }),
    [width, dragging, fraction, durationSv, startDrag, updateDrag, endDrag],
  );
  /* eslint-enable react-hooks/immutability */

  const fillStyle = useAnimatedStyle(() => ({ width: `${fraction.value * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: fraction.value * width.value - THUMB / 2 },
      { scale: dragging.value ? 1.3 : 1 },
    ],
  }));

  const shownTime = dragTime ?? status.currentTime;

  return (
    <View style={{ alignSelf: 'stretch' }}>
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Playback position"
          accessibilityValue={{ text: `${formatTime(shownTime)} of ${formatTime(duration)}` }}
          onLayout={(e) => {
            // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design.
            width.value = e.nativeEvent.layout.width;
          }}
          style={{ height: TOUCH_HEIGHT, justifyContent: 'center' }}
        >
          <View
            style={{
              height: TRACK_HEIGHT,
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: trackColor ?? colors.borderStrong,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={[{ height: TRACK_HEIGHT, backgroundColor: fillColor ?? colors.text }, fillStyle]}
            />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                width: THUMB,
                height: THUMB,
                borderRadius: THUMB / 2,
                backgroundColor: fillColor ?? colors.text,
              },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 }}>
        <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
          {formatTime(shownTime)}
        </Text>
        <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
          {duration > 0 ? `-${formatTime(Math.max(0, duration - shownTime))}` : '--:--'}
        </Text>
      </View>
    </View>
  );
}
