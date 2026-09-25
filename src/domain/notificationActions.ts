import { parseSeriesKey } from './notificationPlan';
import type { NotificationActionId } from './notificationCategories';

/** What a response asks for: an action button, or `open` for a plain tap on the notification. */
export type AppointmentAction = NotificationActionId | 'open';

/** A notification response as the adapter reads it: a plain tap has `actionId: 'open'`. */
export interface NotificationResponse {
  /** Unique per response (notification, delivery time, action), so one is handled once. */
  responseId: string;
  /** OS identifier of the notification that was answered. */
  notificationId: string;
  actionId: string;
}

const ACTIONS: ReadonlySet<string> = new Set<AppointmentAction>(['left', 'stuck', 'open']);

/**
 * The appointment action a response asks for, or null when it isn't ours: an identifier outside
 * the series namespace, or an unknown action id.
 */
export function toAppointmentAction(
  response: Pick<NotificationResponse, 'notificationId' | 'actionId'>,
): { action: AppointmentAction; appointmentId: string } | null {
  const series = parseSeriesKey(response.notificationId);
  if (!series || !ACTIONS.has(response.actionId)) return null;
  return { action: response.actionId as AppointmentAction, appointmentId: series.appointmentId };
}
