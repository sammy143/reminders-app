// Shared domain types. Source of truth: docs/PLAN.md "Core model" and "Escalation schedule".

export type Intensity = 'mild' | 'spicy' | 'savage';

/**
 * Tone of one notification. Steps 1–6 of the escalation schedule map to
 * polite → unhinged; `supportive` replaces the remaining series after
 * "I'm genuinely stuck" (PLAN product rule 5).
 */
export type Tone = 'polite' | 'firm' | 'sarcastic' | 'rude' | 'savage' | 'unhinged' | 'supportive';

export type AppointmentStatus = 'scheduled' | 'snoozed' | 'left' | 'stuck' | 'done';

export type AppointmentSource = 'manual' | 'calendar';

export interface Appointment {
  id: string;
  title: string;
  /** ISO 8601 date-time with offset (e.g. `2026-09-24T09:00:00-07:00`); services/ normalise picker/calendar values. */
  startsAt: string;
  /** Door-to-door travel time; entered manually in v1. */
  travelMinutes: number;
  /** Extra slack before leaving; default 5. */
  bufferMinutes: number;
  inPerson: boolean;
  intensity: Intensity;
  status: AppointmentStatus;
  /** Scheduled notification ids, kept for cancellation. */
  notificationIds: string[];
  /** Pre-generated lines (v2). */
  lines?: string[];
  source: AppointmentSource;
  calendarEventId?: string;
}

/** Tones of the escalation ladder (steps 1–6); excludes `supportive`. */
export type LadderTone = Exclude<Tone, 'supportive'>;

/** Position in the escalation schedule (docs/PLAN.md "Escalation schedule"). */
export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * One scheduled notification of a series. F004 adds `text` from the insult bank.
 *
 * Derived, never persisted: rebuild it from the appointment + `now` with `buildSeries`.
 * `step` keeps its schedule position even when earlier steps were skipped as past.
 */
export interface SeriesStep {
  step: StepNumber;
  at: Date;
  tone: LadderTone;
  /**
   * Live offset of `at` from leaveBy in minutes: `(at − leaveBy) / 60000`, exact and possibly
   * fractional. Scheduled steps get −30, −10, 0, 3, 6, 10; a step pulled forward to `now` gets its
   * real offset. F004 formats the practical cue ("leave in 4 min") from this; the domain never rounds.
   */
  minutesFromLeaveBy: number;
}
