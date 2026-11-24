import { useEffect, useReducer } from 'react';
import { AppState } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { useMusicStore } from '@/store/musicStore';
import { useSleepStore } from '@/store/sleepStore';
import { getPlaylist, pauseMusic } from './music/musicEngine';

const TICK_MS = 1000;
const FADE_MS = 10_000;
const FADE_STEP_MS = 250;

let fading = false;

/** Fade for music and podcasts: lowers the playlist volume, pauses, then restores the volume. */
function fadeOutAndPauseMusic() {
  const player = getPlaylist();
  const restore = player.volume;
  fading = true;
  const startedAt = Date.now();
  const timer = setInterval(() => {
    // The user paused or stopped meanwhile: leave things alone.
    if (!useMusicStore.getState().playing) {
      clearInterval(timer);
      fading = false;
      player.volume = restore;
      return;
    }
    const progress = useSettingsStore.getState().sleepFadeOut ? Math.min(1, (Date.now() - startedAt) / FADE_MS) : 1;
    player.volume = restore * (1 - progress);
    if (progress >= 1) {
      clearInterval(timer);
      pauseMusic();
      player.volume = restore;
      fading = false;
    }
  }, FADE_STEP_MS);
}

/** Checks the clock and, when the timer is up, stops playback. */
function check() {
  const { endsAt, cancel } = useSleepStore.getState();
  if (endsAt === null || fading || Date.now() < endsAt) return;
  cancel();
  const music = useMusicStore.getState();
  if (music.active && music.playing) fadeOutAndPauseMusic();
}

/**
 * Mount once in the root layout. While audio plays the app stays alive in the background, so a
 * simple one-second check is enough; coming back to the app checks straight away.
 */
export function useSleepTimerEngine() {
  useEffect(() => {
    const timer = setInterval(check, TICK_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, []);
}

/** Seconds left on the timer, ticking once a second, or `null` when no timer is running. */
export function useSleepRemaining(): number | null {
  const endsAt = useSleepStore((s) => s.endsAt);
  // `now` is only refreshed by the tick (never read during render), so the value stays stable between ticks.
  const [now, tick] = useReducer(() => Date.now(), undefined, () => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const first = setTimeout(tick, 0); // refresh right away: `now` may be stale from before the timer started
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [endsAt]);

  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** "28:41" or "1:05:09". */
export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
