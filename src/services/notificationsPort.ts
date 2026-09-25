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
  /** Idempotent: foreground display handler and the Android channel (needed before asking). */
  setup: () => Promise<void>;
  getPermission: () => Promise<NotificationPermission>;
  requestPermission: () => Promise<NotificationPermission>;
  /** Everything pending, read back from the OS. */
  listScheduled: () => Promise<ScheduledNotification[]>;
  /** Schedules one notification at `planned.at`; resolves with the OS identifier. */
  schedule: (planned: PlannedNotification) => Promise<string>;
  cancel: (id: string) => Promise<void>;
}
