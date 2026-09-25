import {
  diffSchedule,
  parseSeriesKey,
  planNotifications,
  type SkippedAppointment,
} from '@/domain/notificationPlan';
import { isPlanned } from '@/domain/appointment';
import type { NotificationPermission, NotificationsPort } from '@/services/notificationsPort';
import type { Appointment } from '@/types';

export interface SyncResult {
  scheduled: number;
  cancelled: number;
  /** Appointments that couldn't be planned (bad data); the others were still synced. */
  skipped: SkippedAppointment[];
  /** Individual cancel/schedule failures; the rest still went through. */
  errors: unknown[];
}

/**
 * Prepares notifications and reads the permission, asking only when `ask` is set and the user
 * was never asked (PLAN: ask on the first save, not on launch).
 */
export async function ensurePermission(
  port: NotificationsPort,
  ask: boolean,
): Promise<NotificationPermission> {
  await port.setup();
  const permission = await port.getPermission();
  if (permission !== 'undetermined' || !ask) return permission;
  // Android 13+ may still say "can ask again" after a no; right after asking, not granted = denied.
  const answer = await port.requestPermission();
  return answer === 'undetermined' ? 'denied' : answer;
}

/**
 * The permission the store should show after a read. Once a prompt was answered with a no, it
 * stays `denied` until a read says something other than `undetermined`: Android 13+ reads
 * `undetermined` again (denied + canAskAgain) as soon as the dialog closes and the app comes back
 * to the foreground, which would hide the banner. In memory only (docs/exec-plans F006).
 */
export function nextPermission(
  previous: NotificationPermission | null,
  read: NotificationPermission,
): NotificationPermission {
  return previous === 'denied' && read === 'undetermined' ? 'denied' : read;
}

/**
 * One reconciliation: reads what the OS holds, plans, diffs, then cancels and schedules.
 * The OS list is the source of truth (docs/exec-plans F006 "Decisions"), so running it again
 * with the same inputs changes nothing. `justSaved` = appointments saved since the last sync,
 * whose due step may fire now. `mutedUntil` (an active "mute today", F008) cancels and holds
 * back everything before it, imminent nags included.
 */
export async function syncNotifications(
  port: NotificationsPort,
  appointments: readonly Appointment[],
  now: Date,
  justSaved: ReadonlySet<string> = new Set(),
  mutedUntil: Date | null = null,
): Promise<SyncResult> {
  const scheduled = await port.listScheduled();
  const { notifications: planned, skipped } = planNotifications(appointments, now, justSaved, {
    mutedUntil,
  });
  // A stuck appointment's imminent ladder nag is cancelled too: it would be an insult (F007).
  // While muted nothing is kept: "mute today" cancels today's series outright.
  const keepImminentFor = new Set(
    appointments
      .filter((a) => !mutedUntil && isPlanned(a) && a.status !== 'stuck' && !justSaved.has(a.id))
      .map((a) => a.id),
  );
  const { toCancel, toSchedule } = diffSchedule(planned, scheduled, { now, keepImminentFor });

  const errors: unknown[] = [];
  const attempt = async (op: () => Promise<unknown>) => {
    try {
      await op();
      return 1;
    } catch (error) {
      errors.push(error);
      return 0;
    }
  };
  let cancelled = 0;
  for (const id of toCancel) cancelled += await attempt(() => port.cancel(id));
  let count = 0;
  for (const p of toSchedule) count += await attempt(() => port.schedule(p));
  return { scheduled: count, cancelled, skipped, errors };
}

/**
 * Removes an appointment's delivered series notifications from the tray (after "I've left", its
 * old nags shouldn't linger in Notification Centre). Never rejects; failures are logged.
 */
export async function dismissDelivered(
  port: NotificationsPort,
  appointmentId: string,
): Promise<void> {
  try {
    const mine = (await port.listPresented()).filter(
      (id) => parseSeriesKey(id)?.appointmentId === appointmentId,
    );
    for (const id of mine) await port.dismiss(id);
  } catch (error) {
    console.warn('Could not clear delivered notifications', error);
  }
}

export interface SyncQueue {
  /**
   * Asks for a sync. One runs at a time; requests made while one runs are merged into a single
   * follow-up run (their `savedId`s together). Resolves or rejects with the run that covers it.
   */
  request: (savedId?: string) => Promise<void>;
  /** Resolves once every requested run has finished (whether it worked or not). */
  idle: () => Promise<void>;
}

export function createSyncQueue(run: (justSaved: ReadonlySet<string>) => Promise<void>): SyncQueue {
  let tail: Promise<void> = Promise.resolve();
  let queued: { ids: Set<string>; promise: Promise<void> } | null = null;

  return {
    request: (savedId) => {
      if (!queued) {
        const ids = new Set<string>();
        const promise = tail.then(() => {
          queued = null;
          return run(ids);
        });
        queued = { ids, promise };
        tail = promise.catch(() => {});
      }
      if (savedId) queued.ids.add(savedId);
      return queued.promise;
    },
    idle: () => tail,
  };
}
