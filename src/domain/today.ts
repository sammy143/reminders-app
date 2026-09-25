import type { Appointment, Intensity, LadderTone, SeriesStep, StepNumber } from '@/types';

import { computeLeaveBy } from './leaveBy';
import { formatCue, formatStartCue } from './lines/cue';
import { withLines } from './lines/select';
import { buildSeries, scheduledTone } from './series';

const MS_PER_MINUTE = 60_000;

/** Tone shown on a card: the next series step's tone, or `done` when nothing is left. */
export type CardTone = LadderTone | 'done';

export interface CardStatus {
  leaveBy: Date;
  /** Live countdown ("leave in 12 min", "starts in 20 min"); null once the series is over. */
  cue: string | null;
  tone: CardTone;
}

export interface DayGroup {
  /** Local midnight of the day. */
  day: Date;
  /** 0 = today, 1 = tomorrow, … */
  daysFromToday: number;
  appointments: Appointment[];
  /** How many of them start after `now`. */
  remaining: number;
}

export interface NagLine {
  tone: LadderTone;
  text: string;
  /** When this line fires; equals `now` for a step already due. */
  at: Date;
  appointmentId: string;
}

/** Statuses that still get reminders and show on Home; `left`/`stuck`/`done` are handled later. */
export function isActive(appt: Pick<Appointment, 'status'>): boolean {
  return appt.status === 'scheduled' || appt.status === 'snoozed';
}

/**
 * Drops appointments that started before local midnight of `now`'s day. Today's past ones stay,
 * so Home can still show them.
 */
export function prunePast(list: readonly Appointment[], now: Date): Appointment[] {
  const today = startOfLocalDay(now).getTime();
  return list.filter((a) => Date.parse(a.startsAt) >= today);
}

/**
 * Active appointments from local midnight of `now`'s day onward (so today's past ones stay
 * visible), sorted by start and grouped by local day.
 */
export function groupUpcoming(list: readonly Appointment[], now: Date): DayGroup[] {
  const sorted = prunePast(list, now)
    .filter(isActive)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const groups: DayGroup[] = [];
  for (const appt of sorted) {
    const day = startOfLocalDay(new Date(appt.startsAt));
    const last = groups[groups.length - 1];
    const upcoming = Date.parse(appt.startsAt) > now.getTime() ? 1 : 0;
    if (last && last.day.getTime() === day.getTime()) {
      last.appointments.push(appt);
      last.remaining += upcoming;
    } else {
      groups.push({
        day,
        daysFromToday: localDaysBetween(now, day),
        appointments: [appt],
        remaining: upcoming,
      });
    }
  }
  return groups;
}

/** Leave-by, live countdown and tone for one card (docs/exec-plans F005 "Home list"). */
export function cardStatus(appt: Appointment, now: Date): CardStatus {
  const leaveBy = computeLeaveBy(appt);
  const next = isActive(appt) ? buildSeries(appt, now)[0] : undefined;
  if (!next) return { leaveBy, cue: null, tone: 'done' };
  const cue = appt.inPerson
    ? formatCue((now.getTime() - leaveBy.getTime()) / MS_PER_MINUTE)
    : formatStartCue((Date.parse(appt.startsAt) - now.getTime()) / MS_PER_MINUTE);
  return { leaveBy, cue, tone: next.tone };
}

/**
 * The next line Nag will say: across active appointments, the series step that fires soonest
 * (a step already due fires at `now`). Ties go to the earlier start.
 */
export function nextNagLine(list: readonly Appointment[], now: Date): NagLine | null {
  let best: NagLine | null = null;
  let bestStart = Infinity;
  for (const appt of list.filter(isActive)) {
    const [first] = withLines(buildSeries(appt, now).slice(0, 1), appt);
    if (!first) continue;
    const start = Date.parse(appt.startsAt);
    const at = first.at.getTime();
    if (!best || at < best.at.getTime() || (at === best.at.getTime() && start < bestStart)) {
      best = { tone: first.tone, text: first.text, at: first.at, appointmentId: appt.id };
      bestStart = start;
    }
  }
  return best;
}

export interface PreviewInput {
  id: string;
  startsAt: Date;
  travelMinutes: number;
  bufferMinutes: number;
  inPerson: boolean;
  intensity: Intensity;
}

/**
 * Form preview: the harshest line the chosen intensity reaches, i.e. step 6 ("10 min late"; mild →
 * sarcastic, spicy → savage, savage → unhinged). Events that aren't in person get their one
 * polite step-1 line with its start cue. Independent of `now`.
 */
export function previewLine(input: PreviewInput): { tone: LadderTone; text: string } {
  const startsAt = input.startsAt.toISOString();
  const leaveBy = computeLeaveBy({ ...input, startsAt }).getTime();
  const [step, minutesFromLeaveBy]: [StepNumber, number] = input.inPerson ? [6, 10] : [1, -30];
  const series: SeriesStep = {
    step,
    at: new Date(leaveBy + minutesFromLeaveBy * MS_PER_MINUTE),
    tone: scheduledTone(step, input.intensity),
    minutesFromLeaveBy,
  };
  const [line] = withLines([series], { ...input, startsAt });
  return { tone: line.tone, text: line.text };
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDaysBetween(now: Date, day: Date): number {
  const from = startOfLocalDay(now);
  // Calendar arithmetic, not ms / 86400000, so DST days still count as one.
  return Math.round(
    (Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000,
  );
}
