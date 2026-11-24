import * as WebBrowser from 'expo-web-browser';
import { API_URL } from '@/api/blac/config';

/**
 * The public Privacy Policy and Terms of Service pages. The backend serves them (no sign-in needed), so they follow
 * whichever server the app talks to; the sample-data build falls back to the production site.
 */
const SITE = API_URL ?? 'https://blacmusic.pkasemer.com';

export const PRIVACY_URL = `${SITE}/privacy`;
export const TERMS_URL = `${SITE}/terms`;

/** Opens one of the legal pages in the in-app browser. */
export function openLegal(page: 'privacy' | 'terms') {
  WebBrowser.openBrowserAsync(page === 'privacy' ? PRIVACY_URL : TERMS_URL).catch(() => {});
}
