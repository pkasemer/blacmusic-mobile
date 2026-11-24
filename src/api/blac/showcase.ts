import { reachable } from './config';
import { apiRequest } from './http';

/** An artist or album the Blac team chose to show to people who have not signed in yet. */
export interface ShowcaseItem {
  id: string;
  kind: 'artist' | 'album';
  name: string;
  subtitle?: string;
  /** The picture (an artist's photo or an album cover). */
  imageUrl: string;
}

interface WireItem {
  id: string;
  kind?: string;
  name: string;
  subtitle?: string;
  imageUrl?: string | null;
}

/** The picks, in the order the team set. Empty when nothing is picked or the backend has no showcase yet. */
export async function fetchShowcase(): Promise<ShowcaseItem[]> {
  try {
    const data = await apiRequest<{ items: WireItem[] }>('/v1/showcase', { auth: false });
    return data.items.flatMap((i) => {
      const imageUrl = reachable(i.imageUrl);
      return imageUrl ? [{ id: i.id, kind: i.kind === 'album' ? ('album' as const) : ('artist' as const), name: i.name, subtitle: i.subtitle, imageUrl }] : [];
    });
  } catch (error) {
    // The endpoint does not exist yet: nothing to show, which is fine.
    if (typeof error === 'object' && error && 'status' in error && (error as { status: number }).status === 404) return [];
    throw error;
  }
}
