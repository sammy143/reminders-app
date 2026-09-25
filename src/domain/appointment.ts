import type { Appointment, Intensity } from '@/types';

const MS_PER_MINUTE = 60_000;
const OFFSET_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

export const TRAVEL_LIMITS = { min: 0, max: 600, step: 5 } as const;
export const BUFFER_LIMITS = { min: 0, max: 120, step: 5 } as const;

/** Defaults for a new appointment (docs/exec-plans F005 "Decisions"; buffer 5 per PLAN). */
export const DRAFT_DEFAULTS = {
  travelMinutes: 20,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'spicy' as Intensity,
};

/** What the add/edit form edits. `startsAt` is a local Date from the picker. */
export interface AppointmentDraft {
  title: string;
  startsAt: Date;
  travelMinutes: number;
  bufferMinutes: number;
  inPerson: boolean;
  intensity: Intensity;
}

/** Draft fields after validation, with `startsAt` as an ISO string with offset. */
export type AppointmentFields = Pick<
  Appointment,
  'title' | 'startsAt' | 'travelMinutes' | 'bufferMinutes' | 'inPerson' | 'intensity'
>;

export type DraftErrors = Partial<Record<keyof AppointmentDraft, string>>;

/** A blank draft starting one hour from `now`, rounded up to the next 5 minutes. */
export function draftDefaults(now: Date): AppointmentDraft {
  const step = 5 * MS_PER_MINUTE;
  const start = Math.ceil((now.getTime() + 60 * MS_PER_MINUTE) / step) * step;
  return { title: '', startsAt: new Date(start), ...DRAFT_DEFAULTS };
}

export function draftFromAppointment(appt: Appointment): AppointmentDraft {
  return {
    title: appt.title,
    startsAt: new Date(appt.startsAt),
    travelMinutes: appt.travelMinutes,
    bufferMinutes: appt.bufferMinutes,
    inPerson: appt.inPerson,
    intensity: appt.intensity,
  };
}

/** Form validation. Returns an empty object when the draft can be saved. */
export function validateAppointmentDraft(draft: AppointmentDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.title.trim() === '') errors.title = 'Give it a title.';
  if (Number.isNaN(draft.startsAt.getTime())) errors.startsAt = 'Pick a date and time.';
  if (!inRange(draft.travelMinutes, TRAVEL_LIMITS)) {
    errors.travelMinutes = `Travel time must be ${TRAVEL_LIMITS.min}–${TRAVEL_LIMITS.max} min.`;
  }
  if (!inRange(draft.bufferMinutes, BUFFER_LIMITS)) {
    errors.bufferMinutes = `Buffer must be ${BUFFER_LIMITS.min}–${BUFFER_LIMITS.max} min.`;
  }
  return errors;
}

/** A new appointment from validated fields, with defaults for everything the form doesn't edit. */
export function newAppointment(fields: AppointmentFields, id: string): Appointment {
  return {
    ...normalise(fields),
    id,
    status: 'scheduled',
    source: 'manual',
    notificationIds: [],
  };
}

/** Applies edited fields; keeps id, status, source and notification ids. */
export function applyEdit(appt: Appointment, fields: AppointmentFields): Appointment {
  return { ...appt, ...normalise(fields) };
}

/**
 * True for an ISO 8601 date-time with an explicit offset that names a real calendar time.
 * Rejects what `Date.parse` would roll forward, such as `2026-02-30` or `24:00`.
 */
export function isOffsetDateTime(value: string): boolean {
  const m = OFFSET_DATE_TIME.exec(value);
  if (!m) return false;
  const [year, month, day, hour, minute, second = '0', offH = '0', offM = '0'] = m.slice(1);
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  return (
    date.getUTCFullYear() === +year &&
    date.getUTCMonth() === +month - 1 &&
    date.getUTCDate() === +day &&
    +hour < 24 &&
    +minute < 60 &&
    +second < 60 &&
    +offH < 24 &&
    +offM < 60
  );
}

function normalise(fields: AppointmentFields): AppointmentFields {
  return { ...fields, title: fields.title.trim() };
}

function inRange(value: number, limits: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= limits.min && value <= limits.max;
}
