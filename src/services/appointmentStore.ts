import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { BUFFER_LIMITS, TRAVEL_LIMITS, isOffsetDateTime } from '@/domain/appointment';
import type { Appointment } from '@/types';

export const STORAGE_KEY = 'appointments.v1';

const minutes = (limits: { min: number; max: number }) =>
  z.number().int().min(limits.min).max(limits.max);

/** Boundary parser for stored appointments (PRINCIPLES #7). */
const AppointmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  startsAt: z.string().refine(isOffsetDateTime, 'startsAt must be an ISO date-time with offset'),
  travelMinutes: minutes(TRAVEL_LIMITS),
  bufferMinutes: minutes(BUFFER_LIMITS),
  inPerson: z.boolean(),
  intensity: z.enum(['mild', 'spicy', 'savage']),
  status: z.enum(['scheduled', 'snoozed', 'left', 'stuck', 'done']),
  notificationIds: z.array(z.string()),
  lines: z.array(z.string()).optional(),
  source: z.enum(['manual', 'calendar']),
  calendarEventId: z.string().optional(),
});

// Compile-time check that the schema and the `Appointment` type describe the same shape, both ways.
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
export type SchemaMatchesAppointment = Assert<
  Equals<z.infer<typeof AppointmentSchema>, Appointment>
>;

/**
 * Parses stored JSON into appointments. Invalid entries are dropped, valid ones kept, and a
 * repeated id keeps its first entry; unreadable JSON or a non-array yields an empty list.
 * Never throws. Dropped entries disappear from storage on the next save (intended).
 */
export function parseAppointments(raw: string | null): Appointment[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  return data.flatMap((item) => {
    const result = AppointmentSchema.safeParse(item);
    if (!result.success || seen.has(result.data.id)) return [];
    seen.add(result.data.id);
    return [result.data];
  });
}

export async function loadAppointments(): Promise<Appointment[]> {
  return parseAppointments(await AsyncStorage.getItem(STORAGE_KEY));
}

export async function saveAppointments(list: readonly Appointment[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
