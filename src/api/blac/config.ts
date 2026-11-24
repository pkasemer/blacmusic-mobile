import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Where the Blac backend lives.
 *
 * - `EXPO_PUBLIC_BLAC_API_URL=https://api.example.com` points the app at a specific server.
 * - `EXPO_PUBLIC_BLAC_API_URL=mock` forces the built-in sample data (no sign-in, no network).
 * - With nothing set, a development build talks to the backend on the computer running Metro (port 8080),
 *   which works on a real phone, the iOS simulator and the Android emulator. A production build with
 *   nothing set uses the sample data, so it never points at a developer's machine.
 */
const BACKEND_PORT = 8080;

function devHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri; // for example "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  if (host) return host;
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

function resolveApiUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_BLAC_API_URL?.trim();
  if (configured === 'mock') return null;
  if (configured) return configured.replace(/\/+$/, '');
  if (!__DEV__) return null;
  const host = devHost();
  return host ? `http://${host}:${BACKEND_PORT}` : null;
}

export const API_URL = resolveApiUrl();

/** True when the app talks to the real backend (and so needs the user to sign in). */
export const USES_BACKEND = API_URL !== null;

/**
 * Whether an email-and-password account must confirm its email with a 6 digit code before the app opens.
 * `EXPO_PUBLIC_REQUIRE_EMAIL_CODE=true|false` decides. With nothing set it is on for a local backend (which logs the
 * codes) and off for an `https` server, because production cannot send email until its mail provider is set up:
 * switch it on there by setting `EXPO_PUBLIC_REQUIRE_EMAIL_CODE=true` once codes really arrive.
 */
function resolveRequireEmailCode(): boolean {
  if (API_URL === null) return false;
  const flag = process.env.EXPO_PUBLIC_REQUIRE_EMAIL_CODE?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return !API_URL.startsWith('https://');
}

export const REQUIRE_EMAIL_CODE = resolveRequireEmailCode();

/**
 * In development the backend hands out links that say `localhost` (storage, images). A phone cannot
 * reach the computer through that name, so point them at the same machine the API is on.
 */
export function reachable(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!__DEV__ || !API_URL) return url;
  try {
    const apiHost = new URL(API_URL).hostname;
    return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1|10\.0\.2\.2)(?=[:/])/, `$1${apiHost}`);
  } catch {
    return url;
  }
}
