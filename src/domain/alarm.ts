import type { Appointment, StepNumber, Tone } from '@/types';

import { FIRST_STEP_MINUTES, hasAlarm, isPlanned } from './appointment';
import { computeLeaveBy } from './leaveBy';
import { roundMinutes } from './lines/cue';
import { toSupportive, withLines } from './lines/select';
import { buildSeries } from './series';
import type { CardTone } from './today';

const MS_PER_MINUTE = 60_000;
export const SERIES_STEPS = 6;

/**
 * What the alarm screen shows (docs/design/screens/active-alarm.png, docs/exec-plans F007):
 * - `active`: the ladder is under way; `stuck`: the same, in supportive tone;
 * - `left`: "I've left" was pressed; `over`: nothing left to nag about (or done).
 */
export type AlarmPhase = 'active' | 'stuck' | 'left' | 'over';

export interface AlarmView {
  phase: AlarmPhase;
  /** Background tone: the next step's (as on Home), `supportive` once stuck, `done` otherwise. */
  tone: CardTone;
  /** The step the dots highlight; null when the series isn't running. */
  step: StepNumber | null;
  /** The current line with a live cue; null when the series isn't running. */
  line: string | null;
  /** Whole minutes past leaveBy, rounded like the cue (negative = still early). */
  minutesPastLeaveBy: number;
}

/**
 * True when a Home card should open the alarm screen: an in-person, planned appointment whose
 * series is under way (`now` is at or past step 1, and steps are left). Other cards open the editor.
 */
export function alarmUnderway(appt: Appointment, now: Date): boolean {
  if (!hasAlarm(appt) || !isPlanned(appt)) return false;
  const firstStep = computeLeaveBy(appt).getTime() + FIRST_STEP_MINUTES * MS_PER_MINUTE;
  return now.getTime() >= firstStep && buildSeries(appt, now).length > 0;
}

/**
 * The alarm screen's state at `now`. The line is the next step's line (buildSeries pulls a passed
 * step to `now` before the start, so that is usually the step that just fired) with the live cue.
 * An appointment without an alarm (`hasAlarm`: not in person) is always `over`.
 */
export function alarmView(appt: Appointment, now: Date): AlarmView {
  const leaveBy = computeLeaveBy(appt);
  const minutes = (now.getTime() - leaveBy.getTime()) / MS_PER_MINUTE;
  // `+ 0` turns -0 into 0.
  const base = { minutesPastLeaveBy: roundMinutes(minutes) + 0, step: null, line: null };
  if (!hasAlarm(appt)) return { ...base, phase: 'over', tone: 'done' };
  if (appt.status === 'left') return { ...base, phase: 'left', tone: 'done' };
  const next = isPlanned(appt) ? buildSeries(appt, now)[0] : undefined;
  if (!next) return { ...base, phase: 'over', tone: 'done' };
  const live = [{ ...next, at: now, minutesFromLeaveBy: minutes }];
  const stuck = appt.status === 'stuck';
  const [message] = stuck ? withLines(toSupportive(live), appt) : withLines(live, appt);
  const tone: Tone = message.tone;
  return { ...base, phase: stuck ? 'stuck' : 'active', tone, step: next.step, line: message.text };
}
