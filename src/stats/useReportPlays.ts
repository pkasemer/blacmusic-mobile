import { useEffect, useRef } from 'react';
import { reportPlay } from '@/api/blac/stats';
import { useCurrentItem, useMusicStore } from '@/store/musicStore';

/** The backend's own names for where a play came from: search, album, playlist, artist, library, radio, downloads, home, other. */
function playSource(type: string | undefined): string {
  switch (type) {
    case 'search':
    case 'album':
    case 'playlist':
    case 'artist':
    case 'downloads':
      return type;
    case 'mix':
      return 'radio';
    case 'release':
      return 'album';
    case 'favourites':
    case 'recent':
      return 'library';
    case 'trending':
    case 'genre':
      return 'home';
    default:
      return 'other';
  }
}

/** A song counts as a play after this many seconds of listening (or half of it, for very short ones). */
const COUNT_AFTER_SEC = 30;

/**
 * Mount once while someone is signed in. It counts the seconds a song is really playing and, once it passes about 30
 * seconds, tells the backend (once per listen). Studio previews of unpublished songs and podcasts are not counted.
 */
export function useReportPlays(active: boolean) {
  const item = useCurrentItem();
  const playing = useMusicStore((s) => s.playing);
  const source = useMusicStore((s) => s.source);
  // A song autoplay added is counted as autoplay's, not as the list the queue started from.
  const autoplayed = useMusicStore((s) => !!item && s.autoplay.has(item));
  const heard = useRef({ id: '', seconds: 0, sent: false });

  const trackId = item && item.kind === 'track' && !item.preview ? item.id : null;
  const durationSec = item?.durationSec ?? 0;
  const sourceType = autoplayed ? 'autoplay' : playSource(source?.type);

  // A different song starts a new count.
  useEffect(() => {
    heard.current = { id: trackId ?? '', seconds: 0, sent: false };
  }, [trackId]);

  useEffect(() => {
    if (!active || !trackId || !playing) return;
    const timer = setInterval(() => {
      const h = heard.current;
      if (h.id !== trackId || h.sent) return;
      h.seconds += 1;
      const needed = durationSec > 0 && durationSec < 60 ? Math.max(10, durationSec / 2) : COUNT_AFTER_SEC;
      if (h.seconds >= needed) {
        h.sent = true;
        void reportPlay({ trackId, listenedSec: Math.round(h.seconds), source: sourceType });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [active, trackId, playing, durationSec, sourceType]);
}
