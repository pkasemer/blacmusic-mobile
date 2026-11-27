import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { syncAccount } from '@/auth/session';
import { queryClient } from '@/api/queryClient';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { enablePushByDefault, routeForNotification, type PushData } from './push';

/** Reads Studio, the account and the artist profile again (a refused photo puts the account's picture back). */
function refreshStatuses() {
  void queryClient.invalidateQueries({ queryKey: ['studio'] });
  void syncAccount();
}

/**
 * Mount once while someone is signed in. It turns pushes on (unless switched off in Settings), and opens the right screen when a notification is tapped, including the tap that launched the app.
 */
export function useNotifications(active: boolean) {
  const router = useRouter();
  const optOut = useSettingsStore((s) => s.pushOptOut);
  // The phone's question waits until onboarding is over, so it does not interrupt it.
  const settingUp = useOnboardingStore((s) => s.status === 'active');
  const handled = useRef<string | null>(null);
  const last = Notifications.useLastNotificationResponse();

  // Ask once if never asked, and tell the backend about this phone on every launch (it keeps one entry per phone).
  useEffect(() => {
    if (active && !optOut && !settingUp) void enablePushByDefault();
  }, [active, optOut, settingUp]);

  // A message while the app is open may be a decision on a release: show the new status without waiting.
  useEffect(() => {
    if (!active) return;
    const received = Notifications.addNotificationReceivedListener(() => refreshStatuses());
    return () => received.remove();
  }, [active]);

  // A tap, whether the app was open, in the background or closed.
  useEffect(() => {
    if (!active || !last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    refreshStatuses();
    const target = routeForNotification(last.notification.request.content.data as PushData | undefined);
    if (target) router.push(target as never);
  }, [active, last, router]);
}
