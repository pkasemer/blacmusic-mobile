import { NativeTabs } from 'expo-router/native-tabs';
import { useCurrentItem } from '@/store/musicStore';
import { MusicMiniAccessory } from './MusicMiniPlayer';

/**
 * Mini player for the iOS 26 tab bar accessory slot. The system draws the glass capsule, so this
 * is transparent content only. iOS renders it twice: `regular` (above the tab bar) and `inline`
 * (beside the collapsed tab bar), so the inline copy is deliberately tiny.
 */
export function MiniPlayerAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const item = useCurrentItem();
  if (!item) return null;
  return <MusicMiniAccessory item={item} inline={placement === 'inline'} />;
}
