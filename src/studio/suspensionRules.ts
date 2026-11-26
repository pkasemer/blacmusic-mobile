/**
 * What a refused call says about the artist profile. Kept apart from React and the stores so it can be checked on
 * its own.
 *
 * - `suspended`: the server says outright that the artist is suspended (`artist_banned`).
 * - `check`: `account_banned` can mean two things. An older server uses it when only the artist is suspended, and any
 *   server uses it on every call when the whole account is banned. So it is only a reason to ask for the profile again.
 * - `null`: nothing to do with it.
 *
 * Neither ever signs anyone out. The calls that fetch the account and the profile are ignored, so asking for the
 * profile again can never set off another round.
 */
export function suspensionSignal(code: string, path: string): 'suspended' | 'check' | null {
  const route = path.split('?')[0];
  if (route === '/v1/me' || route === '/v1/me/artist') return null;
  if (code === 'artist_banned') return 'suspended';
  if (code === 'account_banned') return 'check';
  return null;
}
