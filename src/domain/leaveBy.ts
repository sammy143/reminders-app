import type { Appointment } from '@/types';

const MS_PER_MINUTE = 60_000;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export type LeaveByInput = Pick<Appointment, 'startsAt' | 'travelMinutes' | 'bufferMinutes'>;

/**
 * `leaveBy = startsAt − travelMinutes − bufferMinutes` (docs/PLAN.md).
 *
 * `startsAt` must carry an explicit offset (`Z` or `±hh:mm`), so it names one
 * absolute instant; the result is plain epoch-ms subtraction.
 *
 * Throws RangeError on a `startsAt` that is not an offset ISO date-time, or on
 * negative/non-finite minutes.
 * Data should already be validated at the boundary (PRINCIPLES #7); this guard
 * keeps a bad value from silently producing an Invalid Date.
 */
export function computeLeaveBy({ startsAt, travelMinutes, bufferMinutes }: LeaveByInput): Date {
  const startMs = ISO_DATE_TIME.test(startsAt) ? Date.parse(startsAt) : NaN;
  if (Number.isNaN(startMs)) {
    throw new RangeError(
      `computeLeaveBy: startsAt is not an ISO date-time with offset: "${startsAt}"`,
    );
  }
  assertMinutes('travelMinutes', travelMinutes);
  assertMinutes('bufferMinutes', bufferMinutes);
  return new Date(startMs - (travelMinutes + bufferMinutes) * MS_PER_MINUTE);
}

function assertMinutes(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`computeLeaveBy: ${name} must be a finite number >= 0, got ${value}`);
  }
}
