import { formatISO } from 'date-fns';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import {
  applyEdit,
  isReschedule,
  markLeft,
  markStuck,
  newAppointment,
  timingChanged,
  type AppointmentDraft,
  type AppointmentFields,
} from '@/domain/appointment';
import { prunePast } from '@/domain/today';
import { loadAppointments, saveAppointments } from '@/services/appointmentStore';
import { notifications as platformNotifications } from '@/services/notifications';
import type { NotificationPermission, NotificationsPort } from '@/services/notificationsPort';
import type { Appointment } from '@/types';

import { systemClock, type Clock } from './clock';
import {
  createSyncQueue,
  dismissDelivered,
  ensurePermission,
  nextPermission,
  syncNotifications,
} from './scheduler';

interface AppointmentsState {
  appointments: Appointment[];
  /** Where "now" comes from (pruning on load, Home's countdowns). Tests set a fixed one. */
  clock: Clock;
  /** True once loading finished, whether it worked or not. */
  hydrated: boolean;
  /** Set when stored appointments couldn't be read; cleared by a later successful load. */
  loadError: string | null;
  /** Local notifications (the platform adapter; tests set a fake). */
  notifications: NotificationsPort;
  /** Last permission seen by a sync; null before the first one. Home's banner reads it. */
  notificationPermission: NotificationPermission | null;
  /**
   * Brings scheduled notifications in line with the appointments (docs/exec-plans F006). Runs
   * after hydrate and every change, and on app foreground (the top-up). Never rejects: failures
   * are logged, and saving never waits for or depends on it. `savedId` marks an appointment just
   * added or re-timed, which asks for permission if needed and lets its due step fire now.
   */
  syncNotifications: (savedId?: string) => Promise<void>;
  /**
   * Loads stored appointments, dropping ones from before today (and saving that). Later calls
   * share the same promise; after a failure the next call tries again.
   */
  hydrate: () => Promise<void>;
  /** Adds a validated draft; resolves with the new id once persisted. */
  add: (draft: AppointmentDraft) => Promise<string>;
  update: (id: string, draft: AppointmentDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /**
   * "I've left": the appointment is marked `left` (no-op unless planned), its series cancelled and
   * its delivered nags cleared from the tray.
   */
  leave: (id: string) => Promise<void>;
  /** "I'm genuinely stuck": the remaining series turns supportive (no-op unless scheduled/snoozed). */
  stuck: (id: string) => Promise<void>;
  byId: (id: string) => Appointment | undefined;
}

/**
 * Picker Date → stored fields. The ISO string carries the device's current offset
 * (F002 requires one), e.g. `2026-09-25T15:00:00-07:00`.
 */
export function toFields(draft: AppointmentDraft): AppointmentFields {
  return {
    title: draft.title,
    startsAt: formatISO(draft.startsAt),
    travelMinutes: draft.travelMinutes,
    bufferMinutes: draft.bufferMinutes,
    inPerson: draft.inPerson,
    intensity: draft.intensity,
  };
}

export const LOAD_ERROR = 'Couldn’t load saved appointments.';

let hydrating: Promise<void> | null = null;

type Change = { next: Appointment[]; savedId?: string } | null;

/** Applies a status transition to one appointment; null (no change) when it isn't there or stays. */
function transition(
  list: Appointment[],
  id: string,
  mark: (appt: Appointment) => Appointment,
): Change {
  const before = list.find((a) => a.id === id);
  const after = before && mark(before);
  if (!before || !after || after === before) return null;
  return { next: list.map((a) => (a === before ? after : a)) };
}

/** One sync run: after a successful load only, so a failed load never cancels everything. */
const runSync = async (justSaved: ReadonlySet<string>) => {
  const { hydrate, notifications: port } = useAppointments.getState();
  await hydrate();
  if (useAppointments.getState().loadError) return;
  const permission = await ensurePermission(port, justSaved.size > 0);
  useAppointments.setState((state) => ({
    notificationPermission: nextPermission(state.notificationPermission, permission),
  }));
  if (permission !== 'granted') return;
  // Read state and "now" after the permission prompt, which can take a while.
  const { appointments, clock } = useAppointments.getState();
  const result = await syncNotifications(port, appointments, clock(), justSaved);
  for (const { appointmentId, error } of result.skipped) {
    console.warn(`Skipped notifications for appointment ${appointmentId}`, error);
  }
  if (result.errors.length > 0) {
    console.warn('Some notifications could not be updated', result.errors);
  }
};

let syncQueue = createSyncQueue(runSync);

export const useAppointments = create<AppointmentsState>()((set, get) => {
  /**
   * Applies a change after a successful load, saves it, then updates state; if saving fails the
   * state is left as it was and the error propagates. Refuses to save while stored data couldn't
   * be read, so a failed load can never overwrite it. A `null` change saves nothing.
   */
  const mutate = async (change: (list: Appointment[]) => Change) => {
    await get().hydrate();
    if (get().loadError) throw new Error(LOAD_ERROR);
    const result = change(get().appointments);
    if (!result) return;
    const { next, savedId } = result;
    await saveAppointments(next);
    set({ appointments: next });
    void get().syncNotifications(savedId);
  };

  const load = async () => {
    try {
      const stored = await loadAppointments();
      const appointments = prunePast(stored, get().clock());
      set({ appointments, hydrated: true, loadError: null });
      void get().syncNotifications();
      if (appointments.length !== stored.length) {
        await saveAppointments(appointments).catch(() => {
          // Pruning is housekeeping; the next successful save persists it.
        });
      }
    } catch {
      hydrating = null;
      set({ hydrated: true, loadError: LOAD_ERROR });
    }
  };

  return {
    appointments: [],
    clock: systemClock,
    hydrated: false,
    loadError: null,
    notifications: platformNotifications,
    notificationPermission: null,
    syncNotifications: (savedId) =>
      syncQueue.request(savedId).catch((error: unknown) => {
        console.warn('Notification sync failed', error);
      }),
    hydrate: () => (hydrating ??= load()),
    add: async (draft) => {
      const appt = newAppointment(toFields(draft), randomUUID());
      await mutate((list) => ({ next: [...list, appt], savedId: appt.id }));
      return appt.id;
    },
    update: (id, draft) =>
      mutate((list) => {
        const before = list.find((a) => a.id === id);
        const now = get().clock();
        const edited = before && applyEdit(before, toFields(draft), now);
        return {
          next: list.map((a) => (a === before && edited ? edited : a)),
          // Only a timing edit may re-fire the due step (docs/exec-plans F006 "Decisions"); a
          // reschedule after left/stuck starts fresh, dropping past steps (F007 "Decisions").
          savedId:
            before && edited && timingChanged(before, edited) && !isReschedule(before, edited, now)
              ? id
              : undefined,
        };
      }),
    remove: (id) => mutate((list) => ({ next: list.filter((a) => a.id !== id) })),
    leave: async (id) => {
      await mutate((list) => transition(list, id, markLeft));
      void dismissDelivered(get().notifications, id);
    },
    stuck: (id) => mutate((list) => transition(list, id, markStuck)),
    byId: (id) => get().appointments.find((a) => a.id === id),
  };
});

/** Resolves once every requested notification sync has finished. */
export function notificationsSettled(): Promise<void> {
  return syncQueue.idle();
}

/**
 * Test helper: forget loaded state so the next `hydrate()` reads storage again, use `clock` as
 * "now" and `notifications` as the port. Both required, so tests can't fall back to the real
 * clock or real notifications.
 */
export function resetAppointmentsForTests(clock: Clock, notifications: NotificationsPort): void {
  hydrating = null;
  syncQueue = createSyncQueue(runSync);
  useAppointments.setState({
    appointments: [],
    hydrated: false,
    loadError: null,
    clock,
    notifications,
    notificationPermission: null,
  });
}
