import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Check, Moon } from 'lucide-react-native';
import { formatCountdown, useSleepRemaining } from '@/audio/sleepTimer';
import { SLEEP_PRESETS, useSleepStore } from '@/store/sleepStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

/** "15 min", "1 hour", "1.5 hours", "2 hours". */
export function presetLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

/**
 * Bottom card for choosing a sleep-timer length from the player. Picking a preset starts the timer
 * (playback stops after that long); picking the active one, or "Turn off", cancels it.
 */
export function SleepTimerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const durationMin = useSleepStore((s) => s.durationMin);
  const start = useSleepStore((s) => s.start);
  const cancel = useSleepStore((s) => s.cancel);
  const remaining = useSleepRemaining();
  const active = remaining !== null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        onPress={onClose}
        accessibilityLabel="Close sleep timer"
      />
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 34,
            gap: 6,
          }}
        >
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
            <Moon size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text variant="title">Sleep timer</Text>
              <Text variant="caption" color="textSecondary">
                {active ? `Playback stops in ${formatCountdown(remaining)}` : 'Stop playback after…'}
              </Text>
            </View>
          </View>

          {SLEEP_PRESETS.map((minutes) => {
            const selected = active && durationMin === minutes;
            return (
              <Pressable
                key={minutes}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  haptics.select();
                  if (selected) cancel();
                  else start(minutes);
                  onClose();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: 50,
                  paddingHorizontal: 14,
                  borderRadius: radius.card,
                  backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceAlt : 'transparent',
                })}
              >
                <Text variant="bodyStrong" color={selected ? 'accent' : 'text'}>
                  {presetLabel(minutes)}
                </Text>
                {selected ? <Check size={18} color={colors.accent} /> : null}
              </Pressable>
            );
          })}

          {active ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.warning();
                cancel();
                onClose();
              }}
              style={({ pressed }) => ({
                height: 50,
                marginTop: 6,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="bodyStrong" color="danger">
                Turn off timer
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
