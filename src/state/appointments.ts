import { formatISO } from 'date-fns';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import {
  applyEdit,
  newAppointment,
  type AppointmentDraft,
  type AppointmentFields,
} from '@/domain/appointment';
import { prunePast } from '@/domain/today';
import { loadAppointments, saveAppointments } from '@/services/appointmentStore';
import type { Appointment } from '@/types';

import { systemClock, type Clock } from './clock';

interface AppointmentsState {
  appointments: Appointment[];
  /** Where "now" comes from (pruning on load, Home's countdowns). Tests set a fixed one. */
  clock: Clock;
  /** True once loading finished, whether it worked or not. */
  hydrated: boolean;
  /** Set when stored appointments couldn't be read; cleared by a later successful load. */
  loadError: string | null;
  /**
   * Loads stored appointments, dropping ones from before today (and saving that). Later calls
   * share the same promise; after a failure the next call tries again.
   */
  hydrate: () => Promise<void>;
  /** Adds a validated draft; resolves with the new id once persisted. */
  add: (draft: AppointmentDraft) => Promise<string>;
  update: (id: string, draft: AppointmentDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
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

export const useAppointments = create<AppointmentsState>()((set, get) => {
  /**
   * Applies a change after a successful load, saves it, then updates state; if saving fails the
   * state is left as it was and the error propagates. Refuses to save while stored data couldn't
   * be read, so a failed load can never overwrite it.
   */
  const mutate = async (change: (list: Appointment[]) => Appointment[]) => {
    await get().hydrate();
    if (get().loadError) throw new Error(LOAD_ERROR);
    const next = change(get().appointments);
    await saveAppointments(next);
    set({ appointments: next });
  };

  const load = async () => {
    try {
      const stored = await loadAppointments();
      const appointments = prunePast(stored, get().clock());
      set({ appointments, hydrated: true, loadError: null });
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
    hydrate: () => (hydrating ??= load()),
    add: async (draft) => {
      const appt = newAppointment(toFields(draft), randomUUID());
      await mutate((list) => [...list, appt]);
      return appt.id;
    },
    update: (id, draft) =>
      mutate((list) => list.map((a) => (a.id === id ? applyEdit(a, toFields(draft)) : a))),
    remove: (id) => mutate((list) => list.filter((a) => a.id !== id)),
    byId: (id) => get().appointments.find((a) => a.id === id),
  };
});

/**
 * Test helper: forget loaded state so the next `hydrate()` reads storage again, and use `clock`
 * as "now". Required, so tests can't fall back to the real clock.
 */
export function resetAppointmentsForTests(clock: Clock): void {
  hydrating = null;
  useAppointments.setState({ appointments: [], hydrated: false, loadError: null, clock });
}
