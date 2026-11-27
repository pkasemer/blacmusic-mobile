import { useEffect } from 'react';
import { AppState } from 'react-native';
import { playerPosition } from '@/audio/music/musicEngine';
import { onPlayerEvent } from '@/audio/music/playerEvents';
import type { Playable } from '@/domain/types';
import { useMusicStore } from '@/store/musicStore';
import type { PlayerSnapshot } from './listenTracker';
import { recoverDraft, saveDraft, sendSignals, tracker } from './signals';

const SEND_EVERY_MS = 60_000;

/** A number for each place in the queue: the same song queued twice has two. */
const keys = new WeakMap<Playable, number>();
let lastKey = 0;
function keyOf(item: Playable): number {
  let key = keys.get(item);
  if (key === undefined) keys.set(item, (key = ++lastKey));
  return key;
}

/** What the player is doing now. Podcasts and an artist's own unpublished previews are not listening signals. */
function snapshot(): PlayerSnapshot {
  const { active, queue, index, playing, source, autoplay } = useMusicStore.getState();
  const item = active ? queue[index] : undefined;
  if (!item || item.kind !== 'track' || item.preview) return { track: null, index, positionSec: null, playing };
  const at = playerPosition();
  const seed = autoplay.get(item);
  return {
    track: {
      key: keyOf(item),
      id: item.id,
      artistId: item.artistId,
      durationSec: item.durationSec,
      source: source?.type,
      // A song autoplay added is its own kind of play, whatever list the queue started from.
      ...(seed ? { autoplay: true, autoplaySeedId: seed.id } : {}),
    },
    index,
    positionSec: at ? at.positionSec : null,
    playing: at ? at.playing : playing,
  };
}

function watch() {
  tracker.tick(snapshot(), Date.now());
  saveDraft();
}

/**
 * Mount once while someone is signed in: watches listening (completion, skips, replays, sessions) and sends what is
 * waiting (likes and playlist additions too) in batches, also when the app is put away.
 */
export function useListeningSignals(active: boolean) {
  useEffect(() => {
    if (!active) return;
    // The song that was under way when the app last went away.
    recoverDraft();
    // The player's own reports carry on in the background; the timer is for when it has nothing new to say.
    const unwatchEvents = onPlayerEvent((event) => {
      if (event.type === 'leaving') {
        // Where the song stands before anything changes, and then why it is about to.
        watch();
        tracker.leaving(event.reason, Date.now());
        return;
      }
      watch();
      if (event.type === 'ended') {
        tracker.ended(Date.now());
        void sendSignals();
      }
    });
    const timer = setInterval(watch, 1000);
    // A change of song is looked at straight away, so a quick skip is not missed.
    const unwatchPlayer = useMusicStore.subscribe((state, previous) => {
      if (state.index !== previous.index || state.queue !== previous.queue || state.playing !== previous.playing) watch();
    });
    const sender = setInterval(() => void sendSignals(), SEND_EVERY_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        saveDraft(true);
        void sendSignals();
      }
    });
    void sendSignals();
    return () => {
      clearInterval(timer);
      clearInterval(sender);
      unwatchEvents();
      unwatchPlayer();
      appState.remove();
    };
  }, [active]);
}
