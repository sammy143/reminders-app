/**
 * Practical cues for a notification (PLAN rule 7). Lowercase; `fillCue` capitalises a cue that
 * starts a sentence. Both round to the nearest whole minute, ties away from zero (±24.5 → 25).
 */

/**
 * In-person cue, from a step's live offset to leaveBy:
 * negative → "leave in N min"; zero → "leave now"; positive → "N min late".
 */
export function formatCue(minutesFromLeaveBy: number): string {
  const minutes = roundMinutes(minutesFromLeaveBy);
  if (minutes === 0) return 'leave now';
  return minutes < 0 ? `leave in ${-minutes} min` : `${minutes} min late`;
}

/**
 * Cue for an event that isn't in person, from the minutes left until it starts:
 * positive → "starts in N min"; zero → "starting now". buildSeries returns nothing from startsAt
 * on, so a negative value shouldn't reach here; if it does, it also reads "starting now" rather
 * than inventing a late form for a reminder that has no escalation.
 */
export function formatStartCue(minutesToStart: number): string {
  const minutes = roundMinutes(minutesToStart);
  return minutes > 0 ? `starts in ${minutes} min` : 'starting now';
}

/** Nearest whole minute, ties away from zero (±24.5 → ±25), as every cue rounds. */
export function roundMinutes(minutes: number): number {
  return Math.sign(minutes) * Math.round(Math.abs(minutes));
}
