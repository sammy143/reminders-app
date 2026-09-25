import type { NotificationResponse } from '@/domain/notificationActions';
import type { PlannedNotification, ScheduledNotification } from '@/domain/notificationPlan';

/**
 * - `granted`: notifications can be scheduled.
 * - `undetermined`: never asked; ask on the first save.
 * - `denied`: the user said no; Home shows a banner.
 * - `unavailable`: the platform has no local notifications (web); nothing to show or ask.
 */
export type NotificationPermission = 'granted' | 'undetermined' | 'denied' | 'unavailable';

/** The app's view of local notifications. Adapters only translate; decisions live in domain/. */
export interface NotificationsPort {
  /**
   * Idempotent: the Android channel (needed before asking) and the action-button categories.
   * A category failure is logged, not thrown: nags still go out, without buttons.
   */
  setup: () => Promise<void>;
  getPermission: () => Promise<NotificationPermission>;
  requestPermission: () => Promise<NotificationPermission>;
  /** Everything pending, read back from the OS. */
  listScheduled: () => Promise<ScheduledNotification[]>;
  /** Schedules one notification at `planned.at`; resolves with the OS identifier. */
  schedule: (planned: PlannedNotification) => Promise<string>;
  cancel: (id: string) => Promise<void>;
  /** Removes a delivered notification from the tray (Android keeps it after an action tap). */
  dismiss: (id: string) => Promise<void>;
  /** Identifiers of the notifications currently shown in the tray / Notification Centre. */
  listPresented: () => Promise<string[]>;
  /** Calls `listener` for every tap or action button while the app runs; returns unsubscribe. */
  onResponse: (listener: (response: NotificationResponse) => void) => () => void;
  /** The response that launched the app (cold start), once: it is cleared as it is read. */
  takeLastResponse: () => NotificationResponse | null;
}

/** A port that does nothing: web, or a device where expo-notifications couldn't load. */
export const unavailableNotifications: NotificationsPort = {
  setup: async () => {},
  getPermission: async () => 'unavailable',
  requestPermission: async () => 'unavailable',
  listScheduled: async () => [],
  schedule: async (planned) => planned.key,
  cancel: async () => {},
  dismiss: async () => {},
  listPresented: async () => [],
  onResponse: () => () => {},
  takeLastResponse: () => null,
};
