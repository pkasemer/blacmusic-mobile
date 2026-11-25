import { useEffect } from 'react';
import { getPlaylist } from '@/audio/music/musicEngine';
import { useCurrentItem, useMusicStore } from '@/store/musicStore';
import { useResumeStore } from '@/store/resumeStore';

/** How often the position is written down while a song plays. */
const SAVE_EVERY_MS = 4000;
/** Within this many seconds of the end a song counts as finished: carrying on starts it over. */
const FINISHED_WITHIN_SEC = 8;

/**
 * Mount once in the root layout. It remembers the song that is playing and how far into it, every few seconds and
 * whenever it is paused, so "Continue listening" on Home can pick up from the same second after the app was closed.
 * Studio previews of unpublished songs, and podcasts, are left out.
 */
export function useSaveProgress() {
  const item = useCurrentItem();
  const playing = useMusicStore((s) => s.playing);
  const trackId = item && item.kind === 'track' && !item.preview ? item.id : null;
  const durationSec = item?.durationSec ?? 0;

  useEffect(() => {
    if (!trackId) return;
    const write = () => {
      if (!useMusicStore.getState().active) return;
      const position = getPlaylist().currentTime;
      const finished = durationSec > 0 && position > durationSec - FINISHED_WITHIN_SEC;
      useResumeStore.getState().save(trackId, finished ? 0 : Math.max(0, Math.floor(position)), durationSec);
    };
    // A new song starts at its beginning; remember it straight away, then keep the position up to date.
    if (useResumeStore.getState().itemId !== trackId) useResumeStore.getState().save(trackId, 0, durationSec);
    if (!playing) {
      // Just paused (or stopped): write down exactly where.
      if (useResumeStore.getState().itemId === trackId) write();
      return;
    }
    const timer = setInterval(write, SAVE_EVERY_MS);
    return () => {
      clearInterval(timer);
      write();
    };
  }, [trackId, playing, durationSec]);
}
