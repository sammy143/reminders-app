import type { Appointment, Intensity, LadderTone, SeriesStep, StepNumber } from '@/types';

import { computeLeaveBy } from './leaveBy';

const MS_PER_MINUTE = 60_000;

/** Escalation schedule from docs/PLAN.md, offsets in minutes relative to leaveBy. */
const SCHEDULE: readonly { step: StepNumber; minutesFromLeaveBy: number; tone: LadderTone }[] = [
  { step: 1, minutesFromLeaveBy: -30, tone: 'polite' },
  { step: 2, minutesFromLeaveBy: -10, tone: 'firm' },
  { step: 3, minutesFromLeaveBy: 0, tone: 'sarcastic' },
  { step: 4, minutesFromLeaveBy: 3, tone: 'rude' },
  { step: 5, minutesFromLeaveBy: 6, tone: 'savage' },
  { step: 6, minutesFromLeaveBy: 10, tone: 'unhinged' },
];

/** Tone ladder, mildest first. */
const LADDER: readonly LadderTone[] = ['polite', 'firm', 'sarcastic', 'rude', 'savage', 'unhinged'];

/** Harshest tone each intensity may reach. */
const TONE_CAP: Record<Intensity, LadderTone> = {
  mild: 'sarcastic',
  spicy: 'savage',
  savage: 'unhinged',
};

export type SeriesInput = Pick<
  Appointment,
  'startsAt' | 'travelMinutes' | 'bufferMinutes' | 'inPerson' | 'intensity'
>;

/**
 * Notification steps for one appointment, per docs/PLAN.md "Escalation schedule".
 *
 * - In-person: steps 1–6 at −30, −10, 0, +3, +6, +10 min from leaveBy.
 * - Not in-person: only step 1 (polite).
 * - Intensity caps the tone: mild ≤ sarcastic, spicy ≤ savage, savage uncapped.
 * - Steps with `at >= now` are kept with their original step numbers. While `now < startsAt`,
 *   the most recent passed step (last with `at < now`) is pulled forward to `at = now` and
 *   leads the result; earlier passed steps are dropped. No pull when a step is exactly at
 *   `now` (it already fires now) or from startsAt on.
 * - `minutesFromLeaveBy` is always `(at − leaveBy) / 60000`, so a pulled step carries its real
 *   (possibly fractional) offset.
 *
 * Throws RangeError on invalid input (see computeLeaveBy).
 */
export function buildSeries(appointment: SeriesInput, now: Date): SeriesStep[] {
  const leaveByMs = computeLeaveBy(appointment).getTime();
  const nowMs = now.getTime();
  const schedule = appointment.inPerson ? SCHEDULE : SCHEDULE.slice(0, 1);

  const toStep = (step: StepNumber, tone: LadderTone, atMs: number): SeriesStep => ({
    step,
    at: new Date(atMs),
    tone: capTone(tone, appointment.intensity),
    minutesFromLeaveBy: (atMs - leaveByMs) / MS_PER_MINUTE,
  });

  const scheduled = schedule.map(({ step, minutesFromLeaveBy, tone }) => ({
    step,
    tone,
    atMs: leaveByMs + minutesFromLeaveBy * MS_PER_MINUTE,
  }));
  const future = scheduled.filter(({ atMs }) => atMs >= nowMs);
  const lastPassed = scheduled.filter(({ atMs }) => atMs < nowMs).pop();
  const steps = future.map(({ step, tone, atMs }) => toStep(step, tone, atMs));

  const stepAtNow = future.some(({ atMs }) => atMs === nowMs);
  if (lastPassed && !stepAtNow && nowMs < Date.parse(appointment.startsAt)) {
    return [toStep(lastPassed.step, lastPassed.tone, nowMs), ...steps];
  }
  return steps;
}

function capTone(tone: LadderTone, intensity: Intensity): LadderTone {
  const cap = TONE_CAP[intensity];
  return LADDER.indexOf(tone) > LADDER.indexOf(cap) ? cap : tone;
}
