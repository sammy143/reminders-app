/**
 * Practical cue for a notification (PLAN rule 7), from a step's live offset to leaveBy.
 *
 * Rounds to the nearest whole minute, ties away from zero (−24.5 → 25). Then:
 * negative → "leave in N min"; zero → "leave now"; positive → "N min late".
 * Lowercase; `fillCue` capitalises it when it starts a sentence.
 */
export function formatCue(minutesFromLeaveBy: number): string {
  const minutes = Math.sign(minutesFromLeaveBy) * Math.round(Math.abs(minutesFromLeaveBy));
  if (minutes === 0) return 'leave now';
  return minutes < 0 ? `leave in ${-minutes} min` : `${minutes} min late`;
}
