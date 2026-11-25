import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react-native';
import type { DayPoint } from '@/api/blac/stats';
import { useTheme } from '@/theme';
import { formatCount } from '@/utils/format';
import { useGroupedColors } from './SettingsList';
import { Text } from './Text';

/** "+12" or "-3" in green or red, for a change since the period before. Nothing when there is no change to show. */
export function ChangeTag({ value }: { value: number | undefined }) {
  const { colors } = useTheme();
  if (!value) return null;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const color = up ? colors.success : colors.danger;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Icon size={14} color={color} />
      <Text variant="caption" style={{ color, fontVariant: ['tabular-nums'] }}>
        {formatCount(Math.abs(value))}
      </Text>
    </View>
  );
}

/** One number with its label (and an optional change) in a rounded tile. Two or three sit in a row. */
export function MetricTile({ label, value, change }: { label: string; value: number; change?: number }) {
  const g = useGroupedColors();
  return (
    <View style={{ flex: 1, minWidth: '45%', gap: 4, padding: 14, borderRadius: 12, borderCurve: 'continuous', backgroundColor: g.cell }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text variant="title" style={{ fontVariant: ['tabular-nums'], fontSize: 24, lineHeight: 30 }}>
          {formatCount(value)}
        </Text>
        <ChangeTag value={change} />
      </View>
    </View>
  );
}

/** Bars, one per day, for plays over the period. The last day is drawn in the accent colour. */
export function PlaysChart({ series, height = 96 }: { series: DayPoint[]; height?: number }) {
  const { colors } = useTheme();
  const max = useMemo(() => Math.max(1, ...series.map((p) => p.plays)), [series]);
  const count = Math.max(1, series.length);
  const gap = count > 60 ? 0.5 : count > 30 ? 1 : 2;
  const barWidth = 100 / count;
  return (
    <View accessible accessibilityLabel={`Plays per day, highest ${max}`} style={{ height }}>
      <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {/* a faint baseline so an empty chart still reads as a chart */}
        <Rect x={0} y={height - 1} width={100} height={1} fill={colors.border} />
        {series.map((p, i) => {
          const h = p.plays > 0 ? Math.max(2, (p.plays / max) * (height - 4)) : 0;
          const last = i === series.length - 1;
          return (
            <Rect
              key={p.date}
              x={i * barWidth + gap / 8}
              y={height - 1 - h}
              width={Math.max(0.2, barWidth - gap / 4)}
              height={h}
              rx={0.4}
              fill={last ? colors.accent : colors.primary}
              opacity={last ? 1 : 0.75}
            />
          );
        })}
      </Svg>
    </View>
  );
}
