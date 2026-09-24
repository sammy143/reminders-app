import type { Intensity, SeriesStep } from '@/types';

import { buildSeries, type SeriesInput } from '../series';
import { BANK } from './bank';
import { fillCue, stableHash, withLines } from './select';

// startsAt 15:00Z, travel 25 + buffer 5 → leaveBy 14:30Z; steps at 14:00, 14:20, 14:30, 14:33, 14:36, 14:40.
const base: SeriesInput = {
  startsAt: '2026-09-24T15:00:00Z',
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'savage',
};
const EARLY = new Date('2026-09-24T12:00:00Z');
const INTENSITIES: Intensity[] = ['mild', 'spicy', 'savage'];
const CUE = /(leave in \d+ min|leave now|\d+ min late)\.$/i;
// Every minute from well before step 1 to after startsAt, plus some off-minute instants.
const NOWS = Array.from(
  { length: 70 },
  (_, i) => new Date(Date.parse('2026-09-24T13:55:00Z') + i * 60_000),
).concat([new Date('2026-09-24T14:05:30Z'), new Date('2026-09-24T14:34:59Z')]);
const IDS = ['a', 'appt-1', 'appt-2', '5f1c9e2a-7b3d-4e8f-9a01-23c4d5e6f789', ''];

const lines = (input: SeriesInput, id: string, now: Date) =>
  withLines(buildSeries(input, now), { id, intensity: input.intensity });

describe('withLines', () => {
  it('adds text to every step and keeps the step fields', () => {
    const steps = buildSeries(base, EARLY);
    const messages = withLines(steps, { id: 'appt-1', intensity: 'savage' });
    expect(messages).toHaveLength(6);
    messages.forEach((m, i) => {
      expect(m).toEqual({ ...steps[i], text: expect.any(String) });
    });
  });

  it('takes each line from the bank cell of its tone × intensity', () => {
    for (const intensity of INTENSITIES) {
      for (const m of lines({ ...base, intensity }, 'appt-1', EARLY)) {
        const templates = BANK[m.tone][intensity].map((t) => t.replace('{cue}', ''));
        expect(templates).toContain(m.text.replace(CUE, '.'));
      }
    }
  });

  it('puts a practical cue in every line, matching minutesFromLeaveBy', () => {
    const texts = lines(base, 'appt-1', EARLY).map((m) => m.text.match(CUE)?.[1]?.toLowerCase());
    expect(texts).toEqual([
      'leave in 30 min',
      'leave in 10 min',
      'leave now',
      '3 min late',
      '6 min late',
      '10 min late',
    ]);
  });

  it.each(
    INTENSITIES.flatMap((intensity) =>
      [true, false].map((inPerson) => [intensity, inPerson] as const),
    ),
  )(
    'lines are unique within a series and carry a cue (%s, inPerson=%p, incl. pulled steps)',
    (intensity, inPerson) => {
      for (const id of IDS) {
        for (const now of NOWS) {
          const messages = lines({ ...base, intensity, inPerson }, id, now);
          const texts = messages.map((m) => m.text);
          texts.forEach((t) => expect(t).toMatch(CUE));
          // Compare with the cue stripped: cues differ per step, so full texts could hide a repeat.
          const lineOnly = texts.map((t) => t.replace(CUE, ''));
          expect(new Set(lineOnly).size).toBe(lineOnly.length);
        }
      }
    },
  );

  it('keeps the same text for a step after earlier steps are dropped', () => {
    const full = lines(base, 'appt-1', EARLY);
    // now = step 3's instant: steps 3–6 remain at their scheduled times, no pull.
    const later = lines(base, 'appt-1', new Date('2026-09-24T14:30:00Z'));
    expect(later.map((m) => m.step)).toEqual([3, 4, 5, 6]);
    expect(later.map((m) => m.text)).toEqual(full.slice(2).map((m) => m.text));
  });

  it('keeps the same line for a pulled step; only the cue changes', () => {
    const full = lines(base, 'appt-1', EARLY);
    const pulled = lines(base, 'appt-1', new Date('2026-09-24T14:34:00Z'));
    expect(pulled[0].step).toBe(4);
    expect(pulled[0].text).toMatch(/4 min late\.$/);
    expect(pulled[0].text.replace(CUE, '')).toBe(full[3].text.replace(CUE, ''));
    expect(pulled.slice(1).map((m) => m.text)).toEqual(full.slice(4).map((m) => m.text));
  });

  it('does not depend on array position', () => {
    const steps = buildSeries({ ...base, intensity: 'mild' }, EARLY);
    const full = withLines(steps, { id: 'appt-1', intensity: 'mild' });
    const alone: SeriesStep[] = [steps[4]];
    expect(withLines(alone, { id: 'appt-1', intensity: 'mild' })[0].text).toBe(full[4].text);
  });

  it('is deterministic per id and varies across ids', () => {
    expect(lines(base, 'appt-1', EARLY)).toEqual(lines(base, 'appt-1', EARLY));
    const firstLines = new Set(
      Array.from({ length: 30 }, (_, i) => lines(base, `appt-${i}`, EARLY)[0].text),
    );
    expect(firstLines.size).toBeGreaterThan(1);
  });

  it('returns [] for an empty series', () => {
    expect(withLines([], { id: 'x', intensity: 'spicy' })).toEqual([]);
  });
});

describe('fillCue', () => {
  it('capitalises the cue when it starts a sentence', () => {
    expect(fillCue('Move. {cue}.', 'leave now')).toBe('Move. Leave now.');
    expect(fillCue('Really? {cue}.', '3 min late')).toBe('Really? 3 min late.');
    expect(fillCue('{cue}, please.', 'leave in 4 min')).toBe('Leave in 4 min, please.');
  });

  it('keeps the cue lowercase mid-sentence', () => {
    expect(fillCue('Gentle heads-up: {cue}.', 'leave in 4 min')).toBe(
      'Gentle heads-up: leave in 4 min.',
    );
  });

  it('throws on a template without {cue}', () => {
    expect(() => fillCue('No cue here.', 'leave now')).toThrow('{cue}');
  });
});

describe('stableHash', () => {
  it('matches FNV-1a 32-bit reference values', () => {
    expect(stableHash('')).toBe(0x811c9dc5);
    expect(stableHash('a')).toBe(0xe40c292c);
    expect(stableHash('foobar')).toBe(0xbf9cf968);
  });
});
