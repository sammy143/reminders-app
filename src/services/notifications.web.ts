import { unavailableNotifications, type NotificationsPort } from './notificationsPort';

/**
 * Web has no local notifications: a no-op adapter keeps the app usable there (PRINCIPLES #5).
 * `unavailable` means the scheduler skips its work and Home shows no banner.
 */
export const notifications: NotificationsPort = unavailableNotifications;
