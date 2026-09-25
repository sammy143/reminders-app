import { useEffect, useRef } from 'react';

import { hasAlarm } from '@/domain/appointment';
import { toAppointmentAction, type NotificationResponse } from '@/domain/notificationActions';

import { useAppointments } from './appointments';

/** Where a response takes the user: the alarm screen, or the editor for an event without one. */
export interface OpenTarget {
  screen: 'alarm' | 'edit';
  appointmentId: string;
}

/**
 * Acts on one notification response (docs/exec-plans F007): "I've left" → `leave`, "I'm genuinely
 * stuck" → `stuck`, a plain tap → nothing to change. Then `onOpen` shows the alarm screen, which
 * confirms the result. An event without an alarm (`hasAlarm`: not in person) ignores the buttons,
 * and a tap on its reminder opens the editor. Responses that aren't ours (another namespace, an
 * unknown action, an appointment that no longer exists) are ignored. Never rejects.
 */
export async function handleNotificationResponse(
  response: NotificationResponse,
  onOpen: (target: OpenTarget) => void,
): Promise<void> {
  const target = toAppointmentAction(response);
  if (!target) return;
  const { hydrate, notifications: port } = useAppointments.getState();
  await hydrate();
  const { byId, leave, stuck } = useAppointments.getState();
  const appt = byId(target.appointmentId);
  if (!appt) return;
  const alarm = hasAlarm(appt);
  if (!alarm && target.action !== 'open') return;
  if (target.action !== 'open') {
    try {
      await (target.action === 'left' ? leave : stuck)(appt.id);
    } catch (error) {
      // The alarm screen still opens, with its in-app buttons as the fallback.
      console.warn(`Couldn't apply "${target.action}" from a notification`, error);
    }
    // Android leaves a notification in the tray after a button tap ("left" clears them all).
    port.dismiss(response.notificationId).catch((error: unknown) => {
      console.warn('Could not dismiss the notification', error);
    });
  }
  try {
    onOpen({ screen: alarm ? 'alarm' : 'edit', appointmentId: appt.id });
  } catch (error) {
    console.warn('Could not open the appointment from a notification', error);
  }
}

/**
 * Response ids already handled, for the whole app session: a remount (fast refresh, a remounted
 * layout) or a stale cold-start response must never apply one twice.
 */
const handled = new Set<string>();

/**
 * Handles notification taps and action buttons: those that arrive while the app runs, and the
 * one that launched it (cold start). Each response is handled once. Wire it in the root layout;
 * `onOpen` navigates (routes own the router).
 */
export function useNotificationResponses(onOpen: (target: OpenTarget) => void): void {
  const open = useRef(onOpen);
  useEffect(() => {
    open.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    const port = useAppointments.getState().notifications;
    const handle = (response: NotificationResponse) => {
      if (handled.has(response.responseId)) return;
      handled.add(response.responseId);
      void handleNotificationResponse(response, (target) => open.current(target));
    };
    const unsubscribe = port.onResponse(handle);
    const last = port.takeLastResponse();
    if (last) handle(last);
    return unsubscribe;
  }, []);
}
