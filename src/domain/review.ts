/**
 * Verification of an artist's music: the Blac team checks a new release, and changes to one that is live, before
 * listeners see them. The server enforces it; this says where a release stands, in one place.
 */

export interface Review {
  status: 'pending' | 'rejected';
  /** A release never seen by listeners yet, or changes to one that is live or scheduled. */
  kind: 'new' | 'update';
  /** Why it was refused. */
  reason?: string;
  /** When the artist asked for a new release to go live (epoch ms), or `null` for as soon as it is approved. */
  publishAt: number | null;
  /** What is waiting, such as "Lyrics: Wakanda". */
  changes: string[];
}

export interface WireReview {
  status?: string;
  kind?: string;
  reason?: string | null;
  publishAt?: string | null;
  changes?: string[] | null;
}

export function toReview(wire: WireReview | null | undefined): Review | undefined {
  if (!wire || (wire.status !== 'pending' && wire.status !== 'rejected')) return undefined;
  const at = wire.publishAt ? Date.parse(wire.publishAt) : NaN;
  return {
    status: wire.status,
    kind: wire.kind === 'update' ? 'update' : 'new',
    reason: wire.reason?.trim() || undefined,
    publishAt: Number.isNaN(at) ? null : at,
    changes: wire.changes ?? [],
  };
}

export type StandingTone = 'live' | 'scheduled' | 'draft' | 'review' | 'refused';

export interface Standing {
  label: string;
  tone: StandingTone;
  detail?: string;
}

/** A new release the team has not decided on: it is locked until then, or until the artist withdraws it. */
export const isBeingVerified = (review: Review | undefined) => review?.status === 'pending' && review.kind === 'new';

/** One short label for where a release is, and a few words more when something is waiting or was refused. */
export function standingOf(visibility: 'draft' | 'scheduled' | 'public' | string, review: Review | undefined, scheduledFor?: string): Standing {
  if (visibility === 'public' || visibility === 'scheduled') {
    const base: Standing =
      visibility === 'public' ? { label: 'Live', tone: 'live' } : { label: 'Scheduled', tone: 'scheduled', detail: scheduledFor };
    if (!review) return base;
    return { ...base, detail: review.status === 'pending' ? 'Changes pending verification' : 'Changes not approved' };
  }
  if (review?.status === 'pending') return { label: 'Pending verification', tone: 'review' };
  if (review?.status === 'rejected') return { label: 'Changes needed', tone: 'refused', detail: review.reason };
  return { label: 'Draft', tone: 'draft', detail: 'Only you can see it' };
}

/** Said after a change to a live release was sent for verification. */
export const CHANGE_SENT = {
  title: 'Sent for verification',
  message: "Listeners see the current version until the Blac team approves your change. We'll email you and send a notification.",
};
