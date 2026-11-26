import { blacApi } from '@/api/blac';
import type { MixReason } from '@/api/blac/api';
import { queryClient } from '@/api/queryClient';
import type { Track } from '@/domain/types';
import { useAuthStore } from '@/store/authStore';

/**
 * A mix is a list of songs chosen from one reference song. Every request names that song and the listener, so that a
 * recommendation model on the server can choose; until there is one, the songs are of the same genre.
 */

export const MIX_LENGTH = 25;

export interface Mix {
  reference: Track;
  /** The chosen songs, without the reference itself. */
  tracks: Track[];
}

/** Where a mix is kept, so its page shows the same songs that are playing. */
export const mixKey = (referenceId: string) => ['mix', referenceId] as const;

// A mix is kept for a day rather than being chosen again each time its page is opened.
queryClient.setQueryDefaults(['mix'], { staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000 });

export async function fetchMix(reference: Track, reason: MixReason, excludeIds: string[] = []): Promise<Mix> {
  const tracks = await blacApi.getMix({
    reference,
    userId: useAuthStore.getState().user?.id ?? null,
    reason,
    excludeIds,
    limit: MIX_LENGTH,
  });
  const skip = new Set([reference.id, ...excludeIds]);
  return { reference, tracks: tracks.filter((t) => !skip.has(t.id)) };
}

export function rememberMix(mix: Mix) {
  queryClient.setQueryData<Mix>(mixKey(mix.reference.id), mix);
}
