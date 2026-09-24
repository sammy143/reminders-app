import type { LadderTone } from '@/types';

import { buildSeries, scheduledTone, type SeriesInput } from './series';

// startsAt 15:00Z, travel 25 + buffer 5 → leaveBy 14:30Z.
const base: SeriesInput = {
  startsAt: '2026-09-24T15:00:00Z',
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'savage',
};
const LEAVE_BY_MS = Date.parse('2026-09-24T14:30:00Z');
const EARLY = new Date('2026-09-24T12:00:00Z');
const LADDER: LadderTone[] = ['polite', 'firm', 'sarcastic', 'rude', 'savage', 'unhinged'];

const offsetsFromLeaveBy = (steps: { at: Date }[]) =>
  steps.map(({ at }) => (at.getTime() - LEAVE_BY_MS) / 60_000);
const instants = (steps: { at: Date }[]) => steps.map(({ at }) => at.toISOString());

describe('buildSeries', () => {
  it('yields 6 steps at -30, -10, 0, +3, +6, +10 min from leaveBy for an in-person event', () => {
    const steps = buildSeries(base, EARLY);
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(offsetsFromLeaveBy(steps)).toEqual([-30, -10, 0, 3, 6, 10]);
    expect(steps.map((s) => s.minutesFromLeaveBy)).toEqual([-30, -10, 0, 3, 6, 10]);
  });

  it('uses the full tone ladder at savage intensity', () => {
    expect(buildSeries(base, EARLY).map((s) => s.tone)).toEqual(LADDER);
  });

  it('works with a non-UTC offset in startsAt', () => {
    const steps = buildSeries({ ...base, startsAt: '2026-09-24T08:00:00-07:00' }, EARLY);
    expect(steps[2].at.toISOString()).toBe('2026-09-24T14:30:00.000Z');
  });

  it('keeps absolute instants across a DST change (-07:00 → -08:00 on 2026-11-01)', () => {
    // 01:00-08:00 (second 1 AM, PST) = 09:00Z; leaveBy 08:55Z = 01:55-07:00 (PDT).
    const steps = buildSeries(
      { ...base, startsAt: '2026-11-01T01:00:00-08:00', travelMinutes: 0, bufferMinutes: 5 },
      new Date('2026-11-01T00:00:00-07:00'),
    );
    expect(instants(steps)).toEqual([
      '2026-11-01T08:25:00.000Z',
      '2026-11-01T08:45:00.000Z',
      '2026-11-01T08:55:00.000Z',
      '2026-11-01T08:58:00.000Z',
      '2026-11-01T09:01:00.000Z',
      '2026-11-01T09:05:00.000Z',
    ]);
  });

  it('keeps absolute instants across midnight', () => {
    // leaveBy = 2026-09-25T00:00+02:00 = 2026-09-24T22:00Z; step 1 is 23:30 the day before.
    const steps = buildSeries(
      { ...base, startsAt: '2026-09-25T00:10:00+02:00', travelMinutes: 5, bufferMinutes: 5 },
      new Date('2026-09-24T20:00:00+02:00'),
    );
    expect(instants(steps)).toEqual([
      '2026-09-24T21:30:00.000Z',
      '2026-09-24T21:50:00.000Z',
      '2026-09-24T22:00:00.000Z',
      '2026-09-24T22:03:00.000Z',
      '2026-09-24T22:06:00.000Z',
      '2026-09-24T22:10:00.000Z',
    ]);
  });

  it('yields a single polite step for a non-in-person event', () => {
    for (const intensity of ['mild', 'spicy', 'savage'] as const) {
      const steps = buildSeries({ ...base, inPerson: false, intensity }, EARLY);
      expect(steps).toEqual([
        {
          step: 1,
          at: new Date(LEAVE_BY_MS - 30 * 60_000),
          tone: 'polite',
          minutesFromLeaveBy: -30,
        },
      ]);
    }
  });

  it('pulls a past non-in-person reminder forward to now with its real offset', () => {
    const now = new Date('2026-09-24T14:50:00Z'); // step 1 (14:00Z) past, start at 15:00Z
    expect(buildSeries({ ...base, inPerson: false }, now)).toEqual([
      { step: 1, at: now, tone: 'polite', minutesFromLeaveBy: 20 },
    ]);
  });

  it('returns [] for a non-in-person event once startsAt is reached', () => {
    const input = { ...base, inPerson: false };
    expect(buildSeries(input, new Date('2026-09-24T15:00:00Z'))).toEqual([]);
    expect(buildSeries(input, new Date('2026-09-24T15:30:00Z'))).toEqual([]);
  });

  it('never exceeds sarcastic at mild intensity', () => {
    const tones = buildSeries({ ...base, intensity: 'mild' }, EARLY).map((s) => s.tone);
    expect(tones).toEqual(['polite', 'firm', 'sarcastic', 'sarcastic', 'sarcastic', 'sarcastic']);
  });

  it('tops out at savage at spicy intensity', () => {
    const tones = buildSeries({ ...base, intensity: 'spicy' }, EARLY).map((s) => s.tone);
    expect(tones).toEqual(['polite', 'firm', 'sarcastic', 'rude', 'savage', 'savage']);
  });

  it('never lowers the tone from one step to the next', () => {
    for (const intensity of ['mild', 'spicy', 'savage'] as const) {
      const idx = buildSeries({ ...base, intensity }, EARLY).map((s) => LADDER.indexOf(s.tone));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  });

  it('pulls the most recent passed in-person step to now, then the future steps', () => {
    const now = new Date('2026-09-24T14:34:00Z'); // leaveBy + 4 min, before startsAt
    const steps = buildSeries(base, now);
    expect(steps).toEqual([
      { step: 4, at: now, tone: 'rude', minutesFromLeaveBy: 4 },
      { step: 5, at: new Date('2026-09-24T14:36:00Z'), tone: 'savage', minutesFromLeaveBy: 6 },
      { step: 6, at: new Date('2026-09-24T14:40:00Z'), tone: 'unhinged', minutesFromLeaveBy: 10 },
    ]);
  });

  it('pulls step 1 with its real offset when now is between steps 1 and 2', () => {
    const now = new Date('2026-09-24T14:05:30Z'); // leaveBy − 24.5 min
    const steps = buildSeries(base, now);
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(steps[0]).toEqual({ step: 1, at: now, tone: 'polite', minutesFromLeaveBy: -24.5 });
    expect(steps.slice(1).map((s) => s.minutesFromLeaveBy)).toEqual([-10, 0, 3, 6, 10]);
  });

  it('skips earlier passed steps and pulls only step 6 when all are past before startsAt', () => {
    const now = new Date('2026-09-24T14:41:00Z'); // every step past, start at 15:00Z
    expect(buildSeries(base, now)).toEqual([
      { step: 6, at: now, tone: 'unhinged', minutesFromLeaveBy: 11 },
    ]);
  });

  it('does not pull once startsAt is reached', () => {
    // startsAt 15:00Z, leaveBy 14:55Z → step 5 at 15:01Z, step 6 at 15:05Z.
    const late = { ...base, travelMinutes: 0, bufferMinutes: 5 };
    expect(buildSeries(late, new Date('2026-09-24T15:02:00Z'))).toEqual([
      { step: 6, at: new Date('2026-09-24T15:05:00Z'), tone: 'unhinged', minutesFromLeaveBy: 10 },
    ]);
    expect(buildSeries(late, new Date('2026-09-24T15:06:00Z'))).toEqual([]);
    expect(buildSeries(base, new Date('2026-09-24T15:00:00Z'))).toEqual([]);
  });

  it('does not pull or duplicate when a step is exactly at now', () => {
    const steps = buildSeries(base, new Date(LEAVE_BY_MS));
    expect(steps.map((s) => s.step)).toEqual([3, 4, 5, 6]);
    expect(steps.map((s) => s.minutesFromLeaveBy)).toEqual([0, 3, 6, 10]);
  });

  it('caps the tone of a pulled step by intensity', () => {
    const now = new Date('2026-09-24T14:37:00Z'); // leaveBy + 7 → pulls step 5
    const steps = buildSeries({ ...base, intensity: 'mild' }, now);
    expect(steps.map((s) => [s.step, s.tone])).toEqual([
      [5, 'sarcastic'],
      [6, 'sarcastic'],
    ]);
  });

  it('propagates RangeError from computeLeaveBy on bad input', () => {
    expect(() => buildSeries({ ...base, startsAt: '2026-09-24T15:00:00' }, EARLY)).toThrow(
      RangeError,
    );
  });
});

describe('scheduledTone', () => {
  it('returns the capped tone of each scheduled step', () => {
    const steps = [1, 2, 3, 4, 5, 6] as const;
    expect(steps.map((n) => scheduledTone(n, 'savage'))).toEqual(LADDER);
    expect(steps.map((n) => scheduledTone(n, 'spicy'))).toEqual([...LADDER.slice(0, 5), 'savage']);
    expect(steps.map((n) => scheduledTone(n, 'mild'))).toEqual([
      ...LADDER.slice(0, 3),
      'sarcastic',
      'sarcastic',
      'sarcastic',
    ]);
  });

  it('agrees with buildSeries', () => {
    for (const intensity of ['mild', 'spicy', 'savage'] as const) {
      for (const s of buildSeries({ ...base, intensity }, EARLY)) {
        expect(scheduledTone(s.step, intensity)).toBe(s.tone);
      }
    }
  });
});
