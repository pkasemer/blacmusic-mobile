import { Children, isValidElement, type ComponentType, type ReactNode } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight, type LucideProps } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Text } from './Text';

/**
 * Building blocks for a settings screen that looks like the iPhone's own Settings app: grey page, white (or dark grey)
 * rounded groups, rows with a black or white icon, a value on the right and a chevron, and small notes under a group.
 */

/** The colours of the grouped look, which are iOS's own "grouped" background and cell colours. */
export function useGroupedColors() {
  const { isDark } = useTheme();
  return {
    page: isDark ? '#000000' : '#F2F2F7',
    cell: isDark ? '#1C1C1E' : '#FFFFFF',
    pressed: isDark ? '#2C2C2E' : '#E5E5EA',
    separator: isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)',
    chevron: isDark ? '#636366' : '#C7C7CC',
  };
}

const ICON_TILE = 30;
const SEPARATOR_INSET_WITH_ICON = 58;
const SEPARATOR_INSET = 16;

/** A rounded group of rows, with an optional heading above and a note below. */
export function SettingsGroup({
  title,
  footer,
  separatorInset,
  children,
}: {
  title?: string;
  footer?: string;
  /** How far in the lines between rows start. Defaults to under the title (after the icon, when the row has one). */
  separatorInset?: number;
  children: ReactNode;
}) {
  const g = useGroupedColors();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: 7 }}>
      {title ? (
        <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: 32, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {title}
        </Text>
      ) : null}
      <View style={{ marginHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: g.cell }}>
        {rows.map((row, index) => {
          const hasIcon = (row.props as { icon?: unknown }).icon !== undefined;
          return (
            <View key={row.key ?? index}>
              {index > 0 ? (
                <View style={{ height: 0.5, marginLeft: separatorInset ?? (hasIcon ? SEPARATOR_INSET_WITH_ICON : SEPARATOR_INSET), backgroundColor: g.separator }} />
              ) : null}
              {row}
            </View>
          );
        })}
      </View>
      {footer ? (
        <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: 32 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export interface RowIcon {
  Icon: ComponentType<LucideProps>;
}

/** A single-colour icon, black in light mode and white in dark mode, on a soft grey tile. */
function RowGlyph({ icon }: { icon: RowIcon }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={{
        width: ICON_TILE,
        height: ICON_TILE,
        borderRadius: 8,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <icon.Icon size={18} color={colors.text} strokeWidth={1.9} />
    </View>
  );
}

/**
 * One row. With `onPress` it is tappable; `value` shows grey text on the right, and `chevron` adds the ">" for rows
 * that lead somewhere. `destructive` makes the title red (and `center` centres it), like Sign Out.
 */
export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  chevron,
  destructive,
  center,
  disabled,
  onPress,
  right,
  style,
}: {
  icon?: RowIcon;
  title: string;
  subtitle?: string;
  value?: string;
  chevron?: boolean;
  destructive?: boolean;
  center?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useGroupedColors();
  const content = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingVertical: subtitle ? 9 : 7, paddingHorizontal: 16 }, style]}>
      {icon ? <RowGlyph icon={icon} /> : null}
      <View style={{ flex: 1, gap: 1, alignItems: center ? 'center' : 'stretch' }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" color="textSecondary" numberOfLines={1} style={{ maxWidth: '45%' }}>
          {value}
        </Text>
      ) : null}
      {right}
      {chevron ? <ChevronRight size={18} color={g.chevron} strokeWidth={2.5} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      style={({ pressed }) => ({ backgroundColor: pressed ? g.pressed : 'transparent', opacity: disabled ? 0.4 : 1 })}
    >
      {content}
    </Pressable>
  );
}

/** A row with an on/off switch. */
export function SettingsSwitchRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon?: RowIcon;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <SettingsRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          value={value}
          onValueChange={(next) => {
            haptics.select();
            onChange(next);
          }}
          trackColor={{ false: undefined, true: colors.accent }}
          accessibilityLabel={title}
        />
      }
    />
  );
}

/**
 * Asks the person to pick one of a few options in the system's own sheet (an action sheet on iPhone). The current
 * choice is marked with a tick. `destructive` options are red. Calls `onSelect` with the chosen value.
 */
export function chooseOne<T extends string | number>({
  title,
  message,
  options,
  current,
  isDark,
  onSelect,
}: {
  title: string;
  message?: string;
  options: { value: T; label: string; destructive?: boolean }[];
  current?: T | null;
  isDark: boolean;
  onSelect: (value: T) => void;
}) {
  const labelOf = (o: { value: T; label: string }) => (o.value === current ? `✓  ${o.label}` : o.label);
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [...options.map(labelOf), 'Cancel'],
        cancelButtonIndex: options.length,
        destructiveButtonIndex: options.flatMap((o, i) => (o.destructive ? [i] : [])),
        userInterfaceStyle: isDark ? 'dark' : 'light',
      },
      (index) => {
        const picked = options[index];
        if (picked) onSelect(picked.value);
      },
    );
    return;
  }
  Alert.alert(title, message, [
    ...options.map((o) => ({ text: labelOf(o), style: o.destructive ? ('destructive' as const) : ('default' as const), onPress: () => onSelect(o.value) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
