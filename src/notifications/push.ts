import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { apiRequest } from '@/api/blac/http';

/**
 * Push notifications through Expo's push service. The phone gets a token from Expo, sends it to the Blac backend,
 * and the backend sends messages to it (an import finished, a scheduled release went live).
 */

// While the app is open, still show the banner: a finished import is worth knowing about. No sound, no badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushStatus = 'granted' | 'denied' | 'undetermined';

function toStatus(status: Notifications.PermissionStatus): PushStatus {
  return status === Notifications.PermissionStatus.GRANTED ? 'granted' : status === Notifications.PermissionStatus.DENIED ? 'denied' : 'undetermined';
}

/** Whether the person has allowed notifications for Blac in the system. */
export async function getPushStatus(): Promise<PushStatus> {
  try {
    return toStatus((await Notifications.getPermissionsAsync()).status);
  } catch {
    return 'undetermined';
  }
}

/** Shows the system's "Allow notifications?" box (only the first time; later it just reports the answer). */
export async function requestPush(): Promise<PushStatus> {
  try {
    return toStatus((await Notifications.requestPermissionsAsync()).status);
  } catch {
    return 'denied';
  }
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Blac',
    // 5 is the "default" importance in this version of the module.
    importance: 5,
    lightColor: '#BB88FF',
  });
}

/** This phone's Expo push token, or `null` when it cannot have one (a simulator, or notifications are off). */
async function getToken(): Promise<string | null> {
  try {
    await ensureChannel();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    return null;
  }
}

/** Where the token the backend was told about is kept. */
const TOKEN_KEY = 'blac-push-token';

/**
 * The token to remove from the backend: the one saved when it was registered (instant), else asked from Expo, which
 * needs the network.
 */
export async function tokenToRemove(): Promise<string | null> {
  const saved = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (saved) return saved;
  return (await getPushStatus()) === 'granted' ? getToken() : null;
}

/**
 * Tells the backend about this phone, if notifications are allowed. Safe to call on every launch: the backend
 * keeps one entry per token. Returns whether a token was registered.
 */
export async function registerPushToken(): Promise<boolean> {
  if ((await getPushStatus()) !== 'granted') return false;
  const token = await getToken();
  if (!token) return false;
  try {
    await apiRequest<void>('/v1/me/push-tokens', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    return true;
  } catch {
    return false; // the backend may not have this yet, or we are offline: try again next launch
  }
}

/**
 * Notifications are on by default. The phone still has the last word, so someone it has never asked is shown its
 * "Allow notifications?" box (it appears only once), and the phone is registered if they allow it. Not for people who
 * switched them off in Blac's Settings.
 */
export async function enablePushByDefault(): Promise<void> {
  if ((await getPushStatus()) === 'undetermined') await requestPush();
  await registerPushToken();
}

/** Stops the backend sending to this phone. Call it while still signed in. */
export async function unregisterPushToken(): Promise<void> {
  const token = await tokenToRemove();
  if (!token) return;
  try {
    await apiRequest<void>('/v1/me/push-tokens', { method: 'DELETE', body: { token } });
  } catch {
    // Nothing to undo if it was never registered.
  }
}

/** Which kinds of notification the person wants. Kept on the server, so every phone of theirs agrees. */
export interface NotificationPrefs {
  /** A YouTube import finished or needs attention. */
  transfers: boolean;
  /** Your release's audio is ready, or a scheduled release went live. */
  releases: boolean;
  /** The emails about releases (audio ready, published). Independent of the push switches. */
  releaseEmails: boolean;
}

export const getNotificationPrefs = () => apiRequest<NotificationPrefs>('/v1/me/notification-settings');

export const setNotificationPrefs = (patch: Partial<NotificationPrefs>) =>
  apiRequest<NotificationPrefs>('/v1/me/notification-settings', { method: 'PUT', body: patch });

/** Sends the person to the phone's own settings, where notifications can be allowed after saying no. */
export function openSystemSettings() {
  Linking.openSettings().catch(() => {});
}

/**
 * Asks, in words, before the system box appears: "We'll tell you when your import finishes." Only asks if the system
 * has not been asked yet and the person has not switched notifications off in Blac's Settings.
 */
export async function offerPush(reason: string): Promise<void> {
  if ((await getPushStatus()) !== 'undetermined') return;
  Alert.alert('Get a notification?', reason, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Turn on',
      onPress: async () => {
        if ((await requestPush()) === 'granted') await registerPushToken();
      },
    },
  ]);
}

export interface PushData {
  type?: string;
  id?: string;
}

/** The screen a notification should open, from the data the backend put in it. */
export function routeForNotification(data: PushData | undefined): { pathname: string; params: { id: string } } | null {
  const id = data?.id;
  if (!id) return null;
  switch (data?.type) {
    case 'transfer':
      return { pathname: '/youtube/transfer/[id]', params: { id } };
    case 'release':
      return { pathname: '/release/[id]', params: { id } };
    case 'album':
      return { pathname: '/album/[id]', params: { id } };
    case 'artist':
      return { pathname: '/artist/[id]', params: { id } };
    case 'playlist':
      return { pathname: '/playlist/[id]', params: { id } };
    case 'track':
      return { pathname: '/track/[id]', params: { id } };
    default:
      return null;
  }
}
