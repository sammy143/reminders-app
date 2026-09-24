import type { Appointment, SeriesMessage, SeriesStep, StepNumber } from '@/types';

import { scheduledTone } from '../series';
import { BANK } from './bank';
import { formatCue, formatStartCue } from './cue';

export const CUE_PLACEHOLDER = '{cue}';

const STEPS: readonly StepNumber[] = [1, 2, 3, 4, 5, 6];
const MS_PER_MINUTE = 60_000;

export type LineInput = Pick<Appointment, 'id' | 'intensity' | 'inPerson' | 'startsAt'>;

/**
 * Attaches a line from the bank to each step of a `buildSeries` result.
 *
 * Deterministic and unique within a series (docs/exec-plans F004 "Decisions"): the cell is
 * (tone, intensity); the line is `cell[(stableHash(id) + k) % cell.length]`, where `k` counts the
 * earlier *scheduled* steps (full schedule, not the filtered array) in the same cell. So the text
 * depends only on (id, step, tone, intensity), never on array position or `now`, and rebuilding
 * after steps drop out keeps each surviving step's line.
 *
 * Cue: in-person → leave cue from `minutesFromLeaveBy` ("leave in 4 min"); otherwise → start cue
 * from `startsAt − at` ("starts in 20 min"), since there is nothing to leave for.
 * Throws RangeError if a non-in-person `startsAt` doesn't parse.
 */
export function withLines(series: readonly SeriesStep[], appt: LineInput): SeriesMessage[] {
  const seed = stableHash(appt.id);
  const startsAtMs = appt.inPerson ? NaN : Date.parse(appt.startsAt);
  if (!appt.inPerson && Number.isNaN(startsAtMs)) {
    throw new RangeError(`Invalid startsAt: "${appt.startsAt}"`);
  }
  const cueFor = (s: SeriesStep) =>
    appt.inPerson
      ? formatCue(s.minutesFromLeaveBy)
      : formatStartCue((startsAtMs - s.at.getTime()) / MS_PER_MINUTE);
  return series.map((s) => {
    const k = STEPS.filter(
      (earlier) => earlier < s.step && scheduledTone(earlier, appt.intensity) === s.tone,
    ).length;
    const cell = BANK[s.tone][appt.intensity];
    const template = cell[(seed + k) % cell.length];
    return { ...s, text: fillCue(template, cueFor(s)) };
  });
}

/** Replaces `{cue}`, capitalising the cue at the start of the text or after `.`, `!` or `?`. */
export function fillCue(template: string, cue: string): string {
  const at = template.indexOf(CUE_PLACEHOLDER);
  if (at < 0) throw new Error(`Line template has no ${CUE_PLACEHOLDER}: "${template}"`);
  const startsSentence = /(^|[.!?]\s+)$/.test(template.slice(0, at));
  const text = startsSentence ? cue.charAt(0).toUpperCase() + cue.slice(1) : cue;
  return template.slice(0, at) + text + template.slice(at + CUE_PLACEHOLDER.length);
}

/** FNV-1a 32-bit hash: small, pure and stable across runs and platforms. */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
