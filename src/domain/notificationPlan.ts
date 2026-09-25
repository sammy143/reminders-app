import type { Appointment, SeriesMessage, StepNumber } from '@/types';

import { withLines } from './lines/select';
import { buildSeries } from './series';
import { isActive } from './today';

/** Full series for this many upcoming in-person appointments (iOS keeps only 64 pending). */
export const IN_PERSON_SERIES_LIMIT = 2;
/** Single polite reminder for this many upcoming appointments that aren't in person. */
export const OTHER_REMINDER_LIMIT = 20;
/** Hard cap on planned notifications, leaving margin under iOS's 64. The soonest win. */
export const MAX_PLANNED = 60;
/** A step that is due fires this long after `now`, so its trigger is still in the future. */
export const FIRE_NOW_LEAD_MS = 5_000;
export const NOTIFICATION_TITLE = 'Nag';
/**
 * Identifier namespace of escalation-series notifications. The diff only ever touches this
 * namespace, so other kinds (F007's snooze or roast notifications) survive every sync.
 */
export const SERIES_NAMESPACE = 'series';

export interface PlanLimits {
  inPerson: number;
  other: number;
  total: number;
}

const LIMITS: PlanLimits = {
  inPerson: IN_PERSON_SERIES_LIMIT,
  other: OTHER_REMINDER_LIMIT,
  total: MAX_PLANNED,
};

export interface PlannedNotification {
  /** `series:<appointmentId>:<step>`; the OS identifier, stable across syncs. */
  key: string;
  appointmentId: string;
  step: StepNumber;
  at: Date;
  title: string;
  body: string;
}

/** A notification the OS already holds, as the notifications service reads it back. */
export interface ScheduledNotification {
  /** OS identifier: a series key for ours, anything for other kinds. Used to cancel. */
  id: string;
  /** When it fires; an invalid Date when the OS didn't tell us (then it is rescheduled). */
  at: Date;
  body: string;
}

/** An appointment `planNotifications` couldn't plan (bad data); the rest are still planned. */
export interface SkippedAppointment {
  appointmentId: string;
  error: unknown;
}

export interface NotificationPlan {
  notifications: PlannedNotification[];
  skipped: SkippedAppointment[];
}

export interface ScheduleDiff {
  toCancel: string[];
  toSchedule: PlannedNotification[];
}

export const notificationKey = (appointmentId: string, step: StepNumber) =>
  `${SERIES_NAMESPACE}:${appointmentId}:${step}`;

const SERIES_KEY = new RegExp(`^${SERIES_NAMESPACE}:(.+):([1-6])$`);

/** The appointment and step of a series key; null for any other identifier. */
export function parseSeriesKey(key: string): { appointmentId: string; step: StepNumber } | null {
  const m = SERIES_KEY.exec(key);
  return m ? { appointmentId: m[1], step: Number(m[2]) as StepNumber } : null;
}

const MS_PER_SECOND = 1_000;

/**
 * True when an edit moves the series (start, travel, buffer, in person), so the saved
 * appointment's due step may fire again. A title- or intensity-only edit never re-fires it.
 */
export function timingChanged(
  before: Pick<Appointment, 'startsAt' | 'travelMinutes' | 'bufferMinutes' | 'inPerson'>,
  after: Pick<Appointment, 'startsAt' | 'travelMinutes' | 'bufferMinutes' | 'inPerson'>,
): boolean {
  return (
    Date.parse(before.startsAt) !== Date.parse(after.startsAt) ||
    before.travelMinutes !== after.travelMinutes ||
    before.bufferMinutes !== after.bufferMinutes ||
    before.inPerson !== after.inPerson
  );
}

/**
 * What should be scheduled right now (docs/exec-plans F006 "Approach").
 *
 * - Active appointments only, soonest start first.
 * - The next `IN_PERSON_SERIES_LIMIT` in-person appointments with steps left get their remaining
 *   series; the next `OTHER_REMINDER_LIMIT` others get their one polite reminder.
 * - A step is *due* when `at <= now` (buildSeries pulls the latest passed step to `now`). Due
 *   steps are planned only for appointments in `justSaved`: on any other sync the step has
 *   already fired (or been planned), and planning it again would repeat it. Planned times are
 *   clamped to at least `now + FIRE_NOW_LEAD_MS` and rounded up to a whole second (iOS drops
 *   milliseconds).
 * - An appointment whose series can't be built (bad data) is skipped and reported; the others
 *   are still planned.
 * - At most `MAX_PLANNED` in total; the soonest win. (With today's limits, 2 × 6 + 20 = 32 never
 *   reaches it; it guards future limits. `limits` exists so tests can exercise it.)
 */
export function planNotifications(
  appointments: readonly Appointment[],
  now: Date,
  justSaved: ReadonlySet<string> = new Set(),
  limits: PlanLimits = LIMITS,
): NotificationPlan {
  const earliest = now.getTime() + FIRE_NOW_LEAD_MS;
  const ceilSecond = (ms: number) => Math.ceil(ms / MS_PER_SECOND) * MS_PER_SECOND;
  const sorted = appointments
    .filter(isActive)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));

  const quota = { inPerson: limits.inPerson, other: limits.other };
  const planned: PlannedNotification[] = [];
  const skipped: SkippedAppointment[] = [];
  for (const appt of sorted) {
    const kind = appt.inPerson ? 'inPerson' : 'other';
    if (quota[kind] === 0) continue;
    let series: SeriesMessage[];
    try {
      series = withLines(buildSeries(appt, now), appt);
    } catch (error) {
      skipped.push({ appointmentId: appt.id, error });
      continue;
    }
    const steps = series.filter((s) => s.at.getTime() > now.getTime() || justSaved.has(appt.id));
    if (steps.length === 0) continue;
    quota[kind] -= 1;
    for (const s of steps) {
      planned.push({
        key: notificationKey(appt.id, s.step),
        appointmentId: appt.id,
        step: s.step,
        at: new Date(ceilSecond(Math.max(s.at.getTime(), earliest))),
        title: NOTIFICATION_TITLE,
        body: s.text,
      });
    }
  }
  const notifications = planned
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key))
    .slice(0, limits.total);
  return { notifications, skipped };
}

export interface DiffOptions {
  now: Date;
  /**
   * Appointments whose imminent notifications (`at <= now + FIRE_NOW_LEAD_MS`) must be left
   * alone even though they aren't planned: a due step scheduled by a save a moment ago that a
   * later sync no longer plans. Pass the active appointments that weren't just saved.
   */
  keepImminentFor: ReadonlySet<string>;
}

/**
 * Turns the OS's list into the plan, touching only the series namespace (anything else is left
 * alone). A series notification is kept only when its key, time and body all match a planned
 * one (or it is imminent, see `DiffOptions`); other series entries are cancelled, and planned
 * ones without a match are scheduled.
 */
export function diffSchedule(
  planned: readonly PlannedNotification[],
  scheduled: readonly ScheduledNotification[],
  { now, keepImminentFor }: DiffOptions,
): ScheduleDiff {
  const byKey = new Map(planned.map((p) => [p.key, p]));
  const kept = new Set<string>();
  const toCancel: string[] = [];
  const imminent = now.getTime() + FIRE_NOW_LEAD_MS;
  for (const s of scheduled) {
    const series = parseSeriesKey(s.id);
    if (!series) continue;
    const p = byKey.get(s.id);
    const matches =
      p !== undefined && !kept.has(s.id) && p.at.getTime() === s.at.getTime() && p.body === s.body;
    if (matches) {
      kept.add(s.id);
    } else if (!p && keepImminentFor.has(series.appointmentId) && s.at.getTime() <= imminent) {
      // About to fire for an unchanged appointment; cancelling it would drop a nag.
    } else {
      toCancel.push(s.id);
    }
  }
  return { toCancel, toSchedule: planned.filter((p) => !kept.has(p.key)) };
}
