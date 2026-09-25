import type { Appointment, SupportiveStep } from '@/types';

import { toSupportive } from './lines/select';
import { buildSeries } from './series';

/** "I'm genuinely stuck" sends at most this many supportive nags (PLAN rule 5). */
export const SUPPORTIVE_LIMIT = 2;

/**
 * The whole supportive series of a stuck appointment, fixed from the moment "I'm genuinely stuck"
 * was pressed: the next `SUPPORTIVE_LIMIT` escalation steps scheduled after `stuckAt`, in
 * supportive tone. Steps due at that moment are not included (they already fired), and later ones
 * are dropped. It doesn't move as time passes, so re-planning never adds a third nag; callers
 * filter by `now`. Without a `stuckAt` (stored before it existed) it counts from the first step.
 * Throws RangeError on invalid timing (see buildSeries).
 */
export function supportiveSeries(
  appt: Pick<
    Appointment,
    'startsAt' | 'travelMinutes' | 'bufferMinutes' | 'inPerson' | 'intensity' | 'stuckAt'
  >,
): SupportiveStep[] {
  const from = appt.stuckAt ? new Date(appt.stuckAt) : new Date(0);
  const after = buildSeries(appt, from).filter((s) => s.at.getTime() > from.getTime());
  return toSupportive(after.slice(0, SUPPORTIVE_LIMIT));
}
