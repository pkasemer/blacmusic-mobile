import { Platform, Pressable, View } from 'react-native';
import { Host, DatePicker } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';
import { Minus, Plus } from 'lucide-react-native';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** "Sat, 29 Nov, 18:00 GMT+3", in the phone's own time zone. */
export function formatGoLive(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function Stepper({ label, onMinus, onPlus }: { label: string; onMinus: () => void; onPlus: () => void }) {
  const { colors } = useTheme();
  const button = (onPress: () => void, Icon: typeof Plus, name: string) => (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label}`}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderStrong,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon size={16} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text variant="caption" color="textSecondary" style={{ width: 36 }}>
        {label}
      </Text>
      {button(onMinus, Minus, 'Earlier')}
      {button(onPlus, Plus, 'Later')}
    </View>
  );
}

/**
 * Date and time of a go-live. iPhone: the system's own compact picker. Elsewhere: simple day and hour steppers.
 * The date is never earlier than `minimum` (default: now).
 */
export function DateTimeField({
  value,
  onChange,
  minimum,
}: {
  value: Date;
  onChange: (date: Date) => void;
  minimum?: Date;
}) {
  const { isDark } = useTheme();
  const min = minimum ?? new Date();
  const set = (ms: number) => onChange(new Date(Math.max(min.getTime(), ms)));

  if (Platform.OS === 'ios') {
    return (
      <View style={{ alignItems: 'flex-start' }}>
        <Host matchContents colorScheme={isDark ? 'dark' : 'light'}>
          <DatePicker
            title="Go live"
            selection={value}
            range={{ start: min }}
            displayedComponents={['date', 'hourAndMinute']}
            onDateChange={(date) => set(date.getTime())}
            modifiers={[datePickerStyle('compact')]}
          />
        </Host>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Text variant="bodyStrong">{formatGoLive(value)}</Text>
      <Stepper label="Day" onMinus={() => set(value.getTime() - DAY)} onPlus={() => set(value.getTime() + DAY)} />
      <Stepper label="Hour" onMinus={() => set(value.getTime() - HOUR)} onPlus={() => set(value.getTime() + HOUR)} />
    </View>
  );
}

/** The next whole hour from now, but at least 15 minutes away: where the picker starts when "Pick a date" is chosen. */
function defaultGoLive(): number {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

/** Two-way choice for when a release goes live: by hand (the default) or at a chosen date and time. */
export function GoLiveChoice({
  scheduledFor,
  onChange,
}: {
  /** The chosen go-live time (epoch ms), or `null` to publish by hand. */
  scheduledFor: number | null;
  onChange: (value: number | null) => void;
}) {
  const { colors } = useTheme();
  const option = (selected: boolean, title: string, detail: string, onPress: () => void) => (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flex: 1,
        gap: 3,
        padding: 14,
        borderRadius: radius.card,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="caption" color="textSecondary">
        {detail}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {option(scheduledFor === null, 'Publish by hand', 'You press Publish when ready', () => onChange(null))}
        {option(scheduledFor !== null, 'Pick a date', 'It goes live on its own', () => onChange(scheduledFor ?? defaultGoLive()))}
      </View>
      {scheduledFor !== null ? (
        <View style={{ gap: 8 }}>
          <DateTimeField value={new Date(scheduledFor)} onChange={(d) => onChange(d.getTime())} />
          <Text variant="caption" color="textTertiary">
            Goes live {formatGoLive(new Date(scheduledFor))}. You can still change this before then.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
