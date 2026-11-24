import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/settingsStore';

/** Fire a haptic unless the user turned them off in Settings. Never throws. */
function run(effect: () => Promise<void>) {
  if (!useSettingsStore.getState().hapticsEnabled) return;
  effect().catch(() => {});
}

export const haptics = {
  /** Soft tap: opening/closing sheets and players, pausing. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Firmer tap: starting playback, switching station. */
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Tiny tick: tabs, chips, toggles, segmented controls. */
  select: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
