import { NativeTabs } from 'expo-router/native-tabs';
import { MiniPlayerAccessory } from '@/components/MiniPlayerAccessory';
import { useIsArtist } from '@/store/artistStore';
import { useMusicStore } from '@/store/musicStore';
import { useTheme } from '@/theme';
import { hasBottomAccessory } from '@/utils/platform';

/**
 * The platform's own tab bar: Liquid Glass on iOS 26, UITabBar on older iOS, Material navigation
 * on Android. The mini player rides in the iOS 26 bottom accessory (like Apple Music).
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const hasMusic = useMusicStore((s) => s.active && s.queue.length > 0);
  const isArtist = useIsArtist();

  return (
    <NativeTabs
      tintColor={colors.accent}
      backgroundColor={colors.bg}
      indicatorColor={colors.primarySoft}
      minimizeBehavior="onScrollDown"
    >
      {hasBottomAccessory && hasMusic ? (
        <NativeTabs.BottomAccessory>
          <MiniPlayerAccessory />
        </NativeTabs.BottomAccessory>
      ) : null}

      <NativeTabs.Trigger name="(home)" contentStyle={{ backgroundColor: colors.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(search)" contentStyle={{ backgroundColor: colors.bg }}>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(library)" contentStyle={{ backgroundColor: colors.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'music.note.list', selected: 'music.note.list' }} md="library_music" />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* Studio is only for accounts that have an artist profile */}
      <NativeTabs.Trigger name="studio" hidden={!isArtist} contentStyle={{ backgroundColor: colors.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'waveform', selected: 'waveform' }} md="graphic_eq" />
        <NativeTabs.Trigger.Label>Studio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings" contentStyle={{ backgroundColor: colors.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
