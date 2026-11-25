import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './Text';

/**
 * The top of a main screen (Library, Studio, Settings): a row with an optional picture on the left, a small label
 * over a large title, and optional controls on the right. `subtitle` goes under the title and `children` under that.
 */
export function ScreenHero({
  label,
  title,
  subtitle,
  leading,
  trailing,
  children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={{ gap: 18, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 }}>
        {leading}
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="label" color="accent">
            {label}
          </Text>
          <Text variant="display" numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing}
      </View>
      {children}
    </View>
  );
}
