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
 * - In-person: up to 6 steps at −30, −10, 0, +3, +6, +10 min from leaveBy; steps with
 *   `at < now` are dropped and the rest keep their original step numbers.
 * - Not in-person: only step 1 (polite). If it is already past but `now < startsAt`, it is
 *   pulled forward to `now` (keeping `minutesFromLeaveBy: -30`); from startsAt on, `[]`.
 * - Intensity caps the tone: mild ≤ sarcastic, spicy ≤ savage, savage uncapped.
 *
 * Throws RangeError on invalid input (see computeLeaveBy).
 */
export function buildSeries(appointment: SeriesInput, now: Date): SeriesStep[] {
  const leaveByMs = computeLeaveBy(appointment).getTime();
  const nowMs = now.getTime();

  const steps = SCHEDULE.map(({ step, minutesFromLeaveBy, tone }) => ({
    step,
    at: new Date(leaveByMs + minutesFromLeaveBy * MS_PER_MINUTE),
    tone: capTone(tone, appointment.intensity),
    minutesFromLeaveBy,
  }));

  if (!appointment.inPerson) {
    const [first] = steps;
    if (first.at.getTime() >= nowMs) return [first];
    return nowMs < Date.parse(appointment.startsAt) ? [{ ...first, at: new Date(nowMs) }] : [];
  }
  return steps.filter(({ at }) => at.getTime() >= nowMs);
}

function capTone(tone: LadderTone, intensity: Intensity): LadderTone {
  const cap = TONE_CAP[intensity];
  return LADDER.indexOf(tone) > LADDER.indexOf(cap) ? cap : tone;
}
