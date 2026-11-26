export interface Genre {
  id: string;
  /** Display text, and what is sent to the backend as the release's genre. */
  name: string;
}

/**
 * Built-in copy of the backend's genre list (`GET /v1/genres`), used until the backend's own list (`GET /v1/genres`) arrives or
 * when it cannot be reached. Most popular first. Keep it in step with the backend: a server that checks genres rejects names that are not on its list.
 */
export const FALLBACK_GENRES: Genre[] = [
  'Pop',
  'Hip-Hop/Rap',
  'Rap',
  'Afrobeats',
  'Afrobeat',
  'R&B/Soul',
  'R&B',
  'Amapiano',
  'Dancehall',
  'Gospel',
  'Rock',
  'Electronic/Dance',
  'Dance',
  'House',
  'Reggae',
  'Latin',
  'Bongo Flava',
  'Kidandali',
  'Afro House',
  'Trap',
  'Afropop',
  'Alternative',
  'Indie',
  'Country',
  'Jazz',
  'Blues',
  'Classical',
  'Folk',
  'Metal',
  'Punk',
  'K-Pop',
  'Funk',
  'Disco',
  'Techno',
  'Drill',
  'Soukous',
  'Zouk',
  'Highlife',
  'Gengetone',
  'Gqom',
  'Kwaito',
  'Taarab',
  'Lo-fi',
  'Ambient',
  'Other',
].map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name }));
