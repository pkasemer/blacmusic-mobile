import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '@/store/settingsStore';
import { registerPushToken, routeForNotification, type PushData } from './push';

/**
 * Mount once while someone is signed in. It registers the phone for pushes when they are allowed (and not switched
 * off in Settings), and opens the right screen when a notification is tapped, including the tap that launched the app.
 */
export function useNotifications(active: boolean) {
  const router = useRouter();
  const optOut = useSettingsStore((s) => s.pushOptOut);
  const handled = useRef<string | null>(null);
  const last = Notifications.useLastNotificationResponse();

  // Tell the backend about this phone on every launch (it keeps one entry per phone).
  useEffect(() => {
    if (active && !optOut) void registerPushToken();
  }, [active, optOut]);

  // A tap, whether the app was open, in the background or closed.
  useEffect(() => {
    if (!active || !last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const target = routeForNotification(last.notification.request.content.data as PushData | undefined);
    if (target) router.push(target as never);
  }, [active, last, router]);
}
