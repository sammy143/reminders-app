import type { Appointment, Intensity } from '@/types';

import { computeLeaveBy } from './leaveBy';

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

/**
 * Applies edited fields; keeps id, source and notification ids. A real reschedule of a `left` or
 * `stuck` appointment (`isReschedule`) sets it back to `scheduled`: the event starts a fresh series.
 * Anything else keeps the status (docs/exec-plans F007 "Decisions").
 */
export function applyEdit(appt: Appointment, fields: AppointmentFields, now: Date): Appointment {
  const edited = { ...appt, ...normalise(fields) };
  if (!isReschedule(appt, edited, now)) return edited;
  const { stuckAt: _dropped, ...fresh } = edited;
  return { ...fresh, status: 'scheduled' };
}

/** Step 1 fires this long before leaveBy (docs/PLAN.md "Escalation schedule"). */
export const FIRST_STEP_MINUTES = -30;

/**
 * True when an edit really reschedules a `left` or `stuck` appointment: `startsAt` moves and the
 * new series hasn't begun yet (its step 1, leaveBy − 30 min, is still after `now`). Fixing a
 * slightly-off start after leaving, or tweaking travel or buffer, keeps the status, so it never
 * resumes the ladder.
 */
export function isReschedule(
  before: Pick<Appointment, 'startsAt' | 'status'>,
  after: Pick<Appointment, 'startsAt' | 'travelMinutes' | 'bufferMinutes'>,
  now: Date,
): boolean {
  if (before.status !== 'left' && before.status !== 'stuck') return false;
  if (Date.parse(before.startsAt) === Date.parse(after.startsAt)) return false;
  const firstStep = computeLeaveBy(after).getTime() + FIRST_STEP_MINUTES * MS_PER_MINUTE;
  return firstStep > now.getTime();
}

type Timing = Pick<Appointment, 'startsAt' | 'travelMinutes' | 'bufferMinutes' | 'inPerson'>;

/**
 * True when an edit moves the series (start, travel, buffer, in person), so the saved
 * appointment's due step may fire again. A title- or intensity-only edit never re-fires it.
 */
export function timingChanged(before: Timing, after: Timing): boolean {
  return (
    Date.parse(before.startsAt) !== Date.parse(after.startsAt) ||
    before.travelMinutes !== after.travelMinutes ||
    before.bufferMinutes !== after.bufferMinutes ||
    before.inPerson !== after.inPerson
  );
}

/**
 * Statuses that still get notifications: the ladder (`scheduled`, `snoozed`) or its supportive
 * version (`stuck`). `left` and `done` get nothing.
 */
export function isPlanned(appt: Pick<Appointment, 'status'>): boolean {
  return appt.status === 'scheduled' || appt.status === 'snoozed' || appt.status === 'stuck';
}

/** Statuses Home lists: everything planned, plus `left` (shown with a "Left ✓" badge). */
export function isListed(appt: Pick<Appointment, 'status'>): boolean {
  return isPlanned(appt) || appt.status === 'left';
}

/**
 * Only in-person events escalate (PLAN rule 2), so only they have an alarm, the series buttons and
 * the "I've left" / "I'm genuinely stuck" transitions. The one rule for Home, the alarm screen,
 * planning and notification responses.
 */
export function hasAlarm(appt: Pick<Appointment, 'inPerson'>): boolean {
  return appt.inPerson;
}

/**
 * "I've left" (PLAN rule 1; until v3 the button cancels the series): a planned appointment with an
 * alarm becomes `left`. Anything else is returned unchanged (the same object).
 */
export function markLeft(appt: Appointment): Appointment {
  return hasAlarm(appt) && isPlanned(appt) ? { ...appt, status: 'left' } : appt;
}

/**
 * "I'm genuinely stuck" (PLAN rule 5): the remaining series turns supportive. Only a `scheduled`
 * or `snoozed` appointment with an alarm changes, and records `stuckAt` (the supportive series is
 * the next 2 steps after it, stuck.ts); anything else is returned unchanged (the same object).
 */
export function markStuck(appt: Appointment, now: Date): Appointment {
  return hasAlarm(appt) && (appt.status === 'scheduled' || appt.status === 'snoozed')
    ? { ...appt, status: 'stuck', stuckAt: now.toISOString() }
    : appt;
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
