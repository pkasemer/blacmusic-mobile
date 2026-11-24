import { useCurrentItem } from '@/store/musicStore';
import { MusicMiniPlayer } from './MusicMiniPlayer';

/** Compact player that docks above the tab bar (Android and iOS before 26). Tap to open the full player. */
export function MiniPlayer() {
  const item = useCurrentItem();
  if (!item) return null;
  return <MusicMiniPlayer item={item} />;
}
