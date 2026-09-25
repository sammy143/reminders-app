import type { Appointment, Tone } from '@/types';

import { FIRST_STEP_MINUTES, hasAlarm, isPlanned } from './appointment';
import { computeLeaveBy } from './leaveBy';
import { roundMinutes } from './lines/cue';
import { toSupportive, withLines } from './lines/select';
import { buildSeries } from './series';
import { supportiveSeries } from './stuck';
import type { CardTone } from './today';

const MS_PER_MINUTE = 60_000;
export const SERIES_STEPS = 6;

/**
 * What the alarm screen shows (docs/design/screens/active-alarm.png, docs/exec-plans F007):
 * - `active`: the ladder is under way; `stuck`: the short supportive series (≤ 2 nags) instead;
 * - `left`: "I've left" was pressed; `over`: nothing left to nag about (or done).
 */
export type AlarmPhase = 'active' | 'stuck' | 'left' | 'over';

export interface AlarmView {
  phase: AlarmPhase;
  /** Background tone: the next step's (as on Home), `supportive` once stuck, `done` otherwise. */
  tone: CardTone;
  /**
   * Where the dots are: step `current` of `total` (6 on the ladder; the supportive series' nag
   * `current` of its ≤ 2 once stuck). Null when the series isn't running, or when stuck came too late
   * for any supportive nag.
   */
  progress: { current: number; total: number } | null;
  /**
   * The current line: the ladder's with a live cue, or once stuck the supportive one with the
   * neutral "starts at h:mm" cue (never lateness). Null when the series isn't running.
   */
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
  const base = { minutesPastLeaveBy: roundMinutes(minutes) + 0, progress: null, line: null };
  if (!hasAlarm(appt)) return { ...base, phase: 'over', tone: 'done' };
  if (appt.status === 'left') return { ...base, phase: 'left', tone: 'done' };
  const next = isPlanned(appt) ? buildSeries(appt, now)[0] : undefined;
  if (!next) return { ...base, phase: 'over', tone: 'done' };
  const live = { ...next, at: now, minutesFromLeaveBy: minutes };
  if (appt.status !== 'stuck') {
    const [message] = withLines([live], appt);
    const tone: Tone = message.tone;
    const progress = { current: next.step, total: SERIES_STEPS };
    return { ...base, phase: 'active', tone, progress, line: message.text };
  }
  // Stuck: the next supportive nag to come (the last one once both have fired), of the fixed ≤ 2.
  const plan = supportiveSeries(appt);
  const delivered = plan.filter((s) => s.at.getTime() <= now.getTime()).length;
  const current = Math.min(delivered + 1, plan.length);
  const step = plan[current - 1] ?? toSupportive([live])[0];
  const [message] = withLines([step], appt);
  const progress = plan.length > 0 ? { current, total: plan.length } : null;
  return { ...base, phase: 'stuck', tone: 'supportive', progress, line: message.text };
}
