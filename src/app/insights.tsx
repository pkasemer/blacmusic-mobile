import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Insights } from '@/components/Insights';
import { useGroupedColors } from '@/components/SettingsList';
import { refreshStudio, usePullToRefresh } from '@/hooks/usePullToRefresh';

/** Every number about the artist's music in one place: monthly listeners, plays, the main counts, top songs and releases. */
export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const g = useGroupedColors();
  const refreshControl = usePullToRefresh(() => refreshStudio());
  return (
    <ScrollView
      style={{ backgroundColor: g.page }}
      // The native header sits on top of the scroll view: let iOS start the content below it.
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 40 }}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    >
      <Insights />
    </ScrollView>
  );
}
