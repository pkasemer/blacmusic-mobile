import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getPlaylist } from '@/audio/music/musicEngine';
import { useMusicStore } from '@/store/musicStore';
import { sendSignals, tracker } from './signals';

const SEND_EVERY_MS = 60_000;

/** What the player is doing now. Podcasts and an artist's own unpublished previews are not listening signals. */
function snapshot() {
  const { active, queue, index, playing, source } = useMusicStore.getState();
  const item = active ? queue[index] : undefined;
  const track =
    item && item.kind === 'track' && !item.preview
      ? { id: item.id, artistId: item.artistId, durationSec: item.durationSec, source: source?.type }
      : null;
  return { track, playing, positionSec: track ? getPlaylist().currentTime : 0 };
}

/**
 * Mount once while someone is signed in: watches listening (completion, skips, replays, sessions) and sends what is
 * waiting (likes and playlist additions too) in batches, also when the app is put away.
 */
export function useListeningSignals(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const watch = () => {
      const now = Date.now();
      // The timer stops while the app is in the background; the audio does not. Count that time, up to a long song.
      const elapsed = Math.min(15 * 60, (now - last) / 1000);
      last = now;
      tracker.tick(snapshot(), now, elapsed);
    };
    const timer = setInterval(watch, 1000);
    // A change of song is looked at straight away, so a quick skip is not missed.
    const unwatchPlayer = useMusicStore.subscribe((state, previous) => {
      if (state.index !== previous.index || state.queue !== previous.queue || state.playing !== previous.playing) watch();
    });
    const sender = setInterval(() => void sendSignals(), SEND_EVERY_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void sendSignals();
    });
    void sendSignals();
    return () => {
      clearInterval(timer);
      clearInterval(sender);
      unwatchPlayer();
      appState.remove();
    };
  }, [active]);
}
