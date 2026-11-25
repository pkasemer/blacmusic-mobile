/** The people who worked on a release or one of its tracks, and what they did. */
export type CreditRole =
  | 'producer'
  | 'executive_producer'
  | 'songwriter'
  | 'composer'
  | 'lyricist'
  | 'writer'
  | 'recording_engineer'
  | 'mixing_engineer'
  | 'mastering_engineer'
  | 'featured_artist'
  | 'label'
  | 'publisher'
  | 'other';

/** The roles an artist can pick, in the order they are listed. */
export const CREDIT_ROLES: { value: CreditRole; label: string }[] = [
  { value: 'producer', label: 'Producer' },
  { value: 'executive_producer', label: 'Executive producer' },
  { value: 'songwriter', label: 'Songwriter' },
  { value: 'composer', label: 'Composer' },
  { value: 'lyricist', label: 'Lyricist' },
  { value: 'writer', label: 'Writer' },
  { value: 'recording_engineer', label: 'Recording engineer' },
  { value: 'mixing_engineer', label: 'Mixing engineer' },
  { value: 'mastering_engineer', label: 'Mastering engineer' },
  { value: 'featured_artist', label: 'Featured artist' },
  { value: 'label', label: 'Label' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'other', label: 'Other' },
];

export interface Credit {
  id?: string;
  name: string;
  role: CreditRole;
  /** What the person did, when `role` is "other". */
  roleLabel?: string | null;
  /** The track this is for; absent or null means the whole release. */
  trackId?: string | null;
  trackTitle?: string | null;
  /** A Blac artist, when the person has a profile here (so their name opens their page). */
  artistId?: string | null;
}

/** "Mixing engineer" for a credit; the artist's own words for "other". */
export function roleName(credit: Pick<Credit, 'role' | 'roleLabel'>): string {
  if (credit.role === 'other') return credit.roleLabel?.trim() || 'Other';
  return CREDIT_ROLES.find((r) => r.value === credit.role)?.label ?? credit.role;
}
