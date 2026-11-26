/**
 * What a new listener tells Blac about the music they like. Everything is stored as stable ids, never as the words on
 * screen. The choices are independent of each other: enjoying a language is not understanding it, a region picked is
 * not a language spoken, and none of it says where someone is from.
 */

export interface Choice {
  id: string;
  label: string;
}

export interface LanguageGroup extends Choice {
  description: string;
  languages: Choice[];
}

export interface Region extends Choice {
  /** Places and traditions it covers. */
  areas: string[];
}

export interface OnboardingConfig {
  languageGroups: LanguageGroup[];
  regions: Region[];
  genres: Choice[];
}

export type DiscoveryMode = 'familiar' | 'explore_more' | 'everything_uganda';
export const DEFAULT_DISCOVERY: DiscoveryMode = 'explore_more';

export const DISCOVERY_MODES: { id: DiscoveryMode; label: string; description: string }[] = [
  { id: 'familiar', label: 'Familiar Sounds', description: 'Mostly the cultures and traditions you already enjoy.' },
  { id: 'explore_more', label: 'Explore More', description: 'Bring in music from other Ugandan traditions.' },
  { id: 'everything_uganda', label: 'Everything Uganda', description: 'Discover widely across Ugandan music.' },
];

/** Which of the two language choices: music enjoyed in it, or the language understood. */
export type LanguageUse = 'preferred' | 'understood';

export interface OnboardingPreferences {
  languages: { preferred: string[]; understood: string[] };
  regions: string[];
  discoveryMode: DiscoveryMode;
  genres: string[];
  artistIds: string[];
}

const list = (pairs: [string, string][]): Choice[] => pairs.map(([id, label]) => ({ id, label }));

/** Used when the server does not offer its own catalogue (`GET /v1/onboarding/config`). The one copy in the app. */
export const BUILT_IN_CONFIG: OnboardingConfig = {
  languageGroups: [
    {
      id: 'runyakitara',
      label: 'Runyakitara',
      description: 'Western and Southwestern Uganda.',
      languages: list([['runyankole', 'Runyankole'], ['rukiga', 'Rukiga'], ['runyoro', 'Runyoro'], ['rutooro', 'Rutooro']]),
    },
    {
      id: 'central_eastern_bantu',
      label: 'Central and Eastern Bantu',
      description: 'Central and Eastern Uganda.',
      languages: list([['luganda', 'Luganda'], ['lusoga', 'Lusoga'], ['lugwere', 'Lugwere'], ['luruuli', 'Luruuli']]),
    },
    {
      id: 'luo',
      label: 'Luo / Lwo',
      description: 'Northern and Eastern Uganda.',
      languages: list([['acholi', 'Acholi'], ['lango', 'Lango'], ['alur', 'Alur'], ['kumam', 'Kumam'], ['adhola', 'Adhola (Jopadhola)']]),
    },
    {
      id: 'ateker',
      label: 'Ateker',
      description: 'Eastern and Northeastern Uganda.',
      languages: list([['ateso', 'Ateso'], ['ngakarimojong', 'Ngakarimojong'], ['jie', 'Jie'], ['dodoth', 'Dodoth'], ['pokot', 'Pokot']]),
    },
    { id: 'moru_madi', label: 'Moru–Ma\'di', description: 'West Nile.', languages: list([['lugbara', 'Lugbara'], ['aringa', 'Aringa'], ['madi', 'Ma\'di']]) },
    {
      id: 'national_international',
      label: 'National and International',
      description: 'Languages with wider national and regional reach.',
      languages: list([['english', 'English'], ['swahili', 'Swahili']]),
    },
  ],
  regions: [
    { id: 'western_uganda', label: 'Western Uganda', areas: ['Ankole', 'Kigezi', 'Bunyoro', 'Tooro'] },
    { id: 'central_uganda', label: 'Central Uganda', areas: ['Buganda and surrounding communities'] },
    { id: 'northern_uganda', label: 'Northern Uganda', areas: ['Acholi', 'Lango and surrounding communities'] },
    { id: 'eastern_uganda', label: 'Eastern Uganda', areas: ['Teso', 'Busoga and surrounding communities'] },
    { id: 'karamoja', label: 'Karamoja', areas: ['Karamoja musical traditions'] },
    { id: 'west_nile', label: 'West Nile', areas: ['Lugbara', 'Ma\'di and surrounding communities'] },
  ],
  genres: list([
    ['afrobeats', 'Afrobeats'], ['afropop', 'Afropop'], ['hip_hop', 'Hip-Hop'], ['rnb', 'R&B'], ['dancehall', 'Dancehall'],
    ['gospel', 'Gospel'], ['traditional', 'Traditional'], ['kadongo_kamu', 'Kadongo Kamu'], ['reggae', 'Reggae'], ['amapiano', 'Amapiano'],
  ]),
};

const unique = (ids: readonly string[]) => [...new Set(ids)];

/** Adds the id, or takes it out if it is there. */
export const toggleId = (ids: readonly string[], id: string): string[] => (ids.includes(id) ? ids.filter((x) => x !== id) : unique([...ids, id]));

export const hasAll = (ids: readonly string[], wanted: readonly string[]) => wanted.length > 0 && wanted.every((id) => ids.includes(id));

/** "Select all" for a group: adds every one of `group`; if they are all there already, takes them all out. */
export const toggleAll = (ids: readonly string[], group: readonly string[]): string[] =>
  hasAll(ids, group) ? ids.filter((id) => !group.includes(id)) : unique([...ids, ...group]);

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

/** The groups holding languages that match the search, each with only those languages. A group's name matches all of it. */
export function searchLanguages(groups: readonly LanguageGroup[], query: string): LanguageGroup[] {
  const wanted = plain(query);
  if (!wanted) return [...groups];
  return groups.flatMap((group) => {
    const languages = plain(group.label).includes(wanted) ? group.languages : group.languages.filter((l) => plain(l.label).includes(wanted));
    return languages.length > 0 ? [{ ...group, languages }] : [];
  });
}

/** The server's catalogue where it sends one, filling any part it leaves out from the built-in one. */
export function mergeConfig(server: Partial<OnboardingConfig> | null | undefined): OnboardingConfig {
  const pick = <T>(theirs: T[] | undefined, ours: T[]) => (theirs && theirs.length > 0 ? theirs : ours);
  return {
    languageGroups: pick(server?.languageGroups, BUILT_IN_CONFIG.languageGroups),
    regions: pick(server?.regions, BUILT_IN_CONFIG.regions),
    genres: pick(server?.genres, BUILT_IN_CONFIG.genres),
  };
}

/**
 * What is still missing before a step can be left, as a sentence, or `null` when it is done. Onboarding cannot be
 * skipped: the recommendations are built from these answers. Which languages someone understands may be none, and the
 * artists step lets go only when the catalogue has no artists to offer.
 */
export function missingFor(
  step: 'languages' | 'regions' | 'genres' | 'artists',
  chosen: { preferred: string[]; regions: string[]; genres: string[]; artists: unknown[] },
  noArtists = false,
): string | null {
  if (step === 'languages') return chosen.preferred.length > 0 ? null : 'Choose at least one language you enjoy.';
  if (step === 'regions') return chosen.regions.length > 0 ? null : 'Choose at least one region to explore.';
  if (step === 'genres') return chosen.genres.length > 0 ? null : 'Choose at least one genre.';
  return chosen.artists.length > 0 || noArtists ? null : 'Choose at least one artist.';
}

/** What is sent to the server: ids only, each once. */
export function toPayload(chosen: {
  preferred: string[];
  understood: string[];
  regions: string[];
  discoveryMode: DiscoveryMode;
  genres: string[];
  artists: { id: string }[];
}): OnboardingPreferences {
  return {
    languages: { preferred: unique(chosen.preferred), understood: unique(chosen.understood) },
    regions: unique(chosen.regions),
    discoveryMode: chosen.discoveryMode,
    genres: unique(chosen.genres),
    artistIds: unique(chosen.artists.map((a) => a.id)),
  };
}
