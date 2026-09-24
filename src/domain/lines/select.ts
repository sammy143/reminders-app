import type { Intensity, SeriesMessage, SeriesStep, StepNumber } from '@/types';

import { scheduledTone } from '../series';
import { BANK } from './bank';
import { formatCue } from './cue';

export const CUE_PLACEHOLDER = '{cue}';

const STEPS: readonly StepNumber[] = [1, 2, 3, 4, 5, 6];

/**
 * Attaches a line from the bank to each step of a `buildSeries` result.
 *
 * Deterministic and unique within a series (docs/exec-plans F004 "Decisions"): the cell is
 * (tone, intensity); the line is `cell[(stableHash(id) + k) % cell.length]`, where `k` counts the
 * earlier *scheduled* steps (full schedule, not the filtered array) in the same cell. So the text
 * depends only on (id, step, tone, intensity), never on array position or `now`, and rebuilding
 * after steps drop out keeps each surviving step's line. The cue comes from `minutesFromLeaveBy`.
 */
export function withLines(
  series: readonly SeriesStep[],
  appt: { id: string; intensity: Intensity },
): SeriesMessage[] {
  const seed = stableHash(appt.id);
  return series.map((s) => {
    const k = STEPS.filter(
      (earlier) => earlier < s.step && scheduledTone(earlier, appt.intensity) === s.tone,
    ).length;
    const cell = BANK[s.tone][appt.intensity];
    const template = cell[(seed + k) % cell.length];
    return { ...s, text: fillCue(template, formatCue(s.minutesFromLeaveBy)) };
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
