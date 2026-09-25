import type { Settings } from '@/types';

import { BUFFER_LIMITS, DRAFT_DEFAULTS, type AppointmentDraft } from './appointment';

/** Settings before the user changes anything: spicy, 5 min buffer (PLAN), not muted. */
export const DEFAULT_SETTINGS: Settings = {
  defaultIntensity: DRAFT_DEFAULTS.intensity,
  defaultBufferMinutes: DRAFT_DEFAULTS.bufferMinutes,
  mutedUntil: null,
};

/** The fields a new appointment's draft takes from settings (`draftDefaults`). */
export function appointmentDefaults(
  settings: Pick<Settings, 'defaultIntensity' | 'defaultBufferMinutes'>,
): Pick<AppointmentDraft, 'intensity' | 'bufferMinutes'> {
  return { intensity: settings.defaultIntensity, bufferMinutes: settings.defaultBufferMinutes };
}

/**
 * The default buffer after a stepper tap: `current + delta`, clamped to the appointment buffer
 * limits. Deltas (not absolute values) so two quick taps both count.
 */
export function adjustBuffer(current: number, delta: number): number {
  return Math.min(BUFFER_LIMITS.max, Math.max(BUFFER_LIMITS.min, current + delta));
}

/**
 * The end of "today" for "mute today" (PLAN rule 5): the next local midnight. Built from the
 * local calendar date, so it is right on days with 23 or 25 hours (DST).
 */
export function muteUntilMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** When the mute ends, while it is active at `now`; null when not muted or it has expired. */
export function activeMute(settings: Pick<Settings, 'mutedUntil'>, now: Date): Date | null {
  if (settings.mutedUntil === null) return null;
  const until = new Date(settings.mutedUntil);
  return until.getTime() > now.getTime() ? until : null;
}

/** True while "mute today" is on. It expires by time: nothing needs clearing at midnight. */
export function isMuted(settings: Pick<Settings, 'mutedUntil'>, now: Date): boolean {
  return activeMute(settings, now) !== null;
}
