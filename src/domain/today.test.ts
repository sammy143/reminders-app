import type { Appointment } from '@/types';

import { BANK } from './lines/bank';
import { cardStatus, groupUpcoming, nextNagLine, previewLine, prunePast } from './today';

const appt = (over: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  title: 'Dentist',
  startsAt: '2026-09-24T15:00:00Z',
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'spicy',
  status: 'scheduled',
  notificationIds: [],
  source: 'manual',
  ...over,
});

// Local-time helpers keep grouping tests independent of the machine's time zone.
const local = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m);
const iso = (date: Date) => date.toISOString();

describe('test environment', () => {
  it('runs in America/Los_Angeles, where DST ends on 2026-11-01', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Los_Angeles');
    expect(new Date(2026, 9, 31, 12).getTimezoneOffset()).toBe(420);
    expect(new Date(2026, 10, 2, 12).getTimezoneOffset()).toBe(480);
  });
});

describe('groupUpcoming', () => {
  const now = local(24, 12);

  it('keeps today’s past appointments, drops earlier days, sorts and groups by day', () => {
    const list = [
      appt({ id: 'tomorrow', startsAt: iso(local(25, 9)) }),
      appt({ id: 'later-today', startsAt: iso(local(24, 18)) }),
      appt({ id: 'yesterday', startsAt: iso(local(23, 18)) }),
      appt({ id: 'this-morning', startsAt: iso(local(24, 8)) }),
      appt({ id: 'next-week', startsAt: iso(local(30, 8)) }),
    ];
    const groups = groupUpcoming(list, now);
    expect(
      groups.map((g) => [g.daysFromToday, g.remaining, g.appointments.map((a) => a.id)]),
    ).toEqual([
      [0, 1, ['this-morning', 'later-today']],
      [1, 1, ['tomorrow']],
      [6, 1, ['next-week']],
    ]);
  });

  it('shows scheduled, snoozed, stuck and left appointments, not done ones', () => {
    const list = [
      appt({ id: 'scheduled', startsAt: iso(local(24, 18)) }),
      appt({ id: 'snoozed', status: 'snoozed', startsAt: iso(local(24, 19)) }),
      appt({ id: 'left', status: 'left', startsAt: iso(local(24, 20)) }),
      appt({ id: 'done', status: 'done', startsAt: iso(local(24, 21)) }),
      appt({ id: 'stuck', status: 'stuck', startsAt: iso(local(24, 22)) }),
    ];
    expect(groupUpcoming(list, now)[0].appointments.map((a) => a.id)).toEqual([
      'scheduled',
      'snoozed',
      'left',
      'stuck',
    ]);
  });

  it('counts only planned appointments that have not started as remaining (not left ones)', () => {
    const list = [
      appt({ id: 'left', status: 'left', startsAt: iso(local(24, 18)) }),
      appt({ id: 'stuck', status: 'stuck', startsAt: iso(local(24, 19)) }),
      appt({ id: 'scheduled', startsAt: iso(local(24, 20)) }),
      appt({ id: 'past', startsAt: iso(local(24, 9)) }),
    ];
    const [today] = groupUpcoming(list, now);
    expect(today.appointments).toHaveLength(4);
    expect(today.remaining).toBe(2);
  });

  // Jest runs in America/Los_Angeles (jest.global-setup.js); DST ends there on 2026-11-01.
  it('counts calendar days and groups by local day across the DST change', () => {
    const halloween = new Date(2026, 9, 31, 12, 0);
    const list = [
      appt({ id: 'sun-early', startsAt: iso(new Date(2026, 10, 1, 0, 30)) }),
      appt({ id: 'sun-late', startsAt: iso(new Date(2026, 10, 1, 23, 30)) }),
      appt({ id: 'mon', startsAt: iso(new Date(2026, 10, 2, 0, 15)) }),
      appt({ id: 'tue', startsAt: iso(new Date(2026, 10, 3, 9, 0)) }),
    ];
    expect(
      groupUpcoming(list, halloween).map((g) => [g.daysFromToday, g.appointments.map((a) => a.id)]),
    ).toEqual([
      [1, ['sun-early', 'sun-late']],
      [2, ['mon']],
      [3, ['tue']],
    ]);
  });

  it('includes an appointment at local midnight today', () => {
    expect(groupUpcoming([appt({ startsAt: iso(local(24, 0)) })], now)).toHaveLength(1);
  });

  it('returns nothing for an empty list', () => {
    expect(groupUpcoming([], now)).toEqual([]);
  });
});

describe('prunePast', () => {
  it('drops appointments before local midnight today and keeps the rest', () => {
    const now = local(24, 12);
    const list = [
      appt({ id: 'yesterday-late', startsAt: iso(local(23, 23, 59)) }),
      appt({ id: 'midnight', startsAt: iso(local(24, 0)) }),
      appt({ id: 'this-morning', startsAt: iso(local(24, 8)) }),
      appt({ id: 'tomorrow', startsAt: iso(local(25, 8)) }),
    ];
    expect(prunePast(list, now).map((a) => a.id)).toEqual(['midnight', 'this-morning', 'tomorrow']);
  });
});

describe('cardStatus', () => {
  it('is done, marked left, after "I\'ve left"', () => {
    const s = cardStatus(appt({ status: 'left' }), new Date('2026-09-24T13:48:00Z'));
    expect(s).toMatchObject({ cue: null, tone: 'done', mark: 'left' });
  });

  it('keeps the countdown in the supportive tone, marked stuck, after "I\'m genuinely stuck"', () => {
    const s = cardStatus(appt({ status: 'stuck' }), new Date('2026-09-24T14:33:00Z'));
    expect(s).toMatchObject({ cue: '3 min late', tone: 'supportive', mark: 'stuck' });
  });

  it('has no mark otherwise', () => {
    expect(cardStatus(appt(), new Date('2026-09-24T14:33:00Z')).mark).toBeNull();
    expect(cardStatus(appt({ status: 'done' }), new Date('2026-09-24T14:33:00Z')).mark).toBeNull();
  });

  // leaveBy = 15:00 − 30 min = 14:30Z
  it('shows the leave countdown and the next step tone for in-person events', () => {
    const s = cardStatus(appt(), new Date('2026-09-24T13:48:00Z'));
    expect(s.leaveBy.toISOString()).toBe('2026-09-24T14:30:00.000Z');
    expect(s.cue).toBe('leave in 42 min');
    // step 1 (polite) is at 14:00, still ahead
    expect(s.tone).toBe('polite');
  });

  it('uses the pulled-forward step tone once a step has passed', () => {
    const s = cardStatus(appt(), new Date('2026-09-24T14:25:00Z'));
    expect(s.cue).toBe('leave in 5 min');
    expect(s.tone).toBe('firm');
  });

  it('reads late after leaveBy', () => {
    expect(cardStatus(appt(), new Date('2026-09-24T14:33:00Z')).cue).toBe('3 min late');
  });

  it('shows a start countdown for events that aren’t in person', () => {
    const s = cardStatus(appt({ inPerson: false }), new Date('2026-09-24T14:40:00Z'));
    expect(s).toMatchObject({ cue: 'starts in 20 min', tone: 'polite' });
  });

  it('is done once no step is left', () => {
    const s = cardStatus(appt(), new Date('2026-09-24T16:00:00Z'));
    expect(s).toMatchObject({ cue: null, tone: 'done' });
  });
});

describe('nextNagLine', () => {
  const now = new Date('2026-09-24T14:25:00Z');

  it('picks the step that fires soonest, not the earliest start', () => {
    const at = new Date('2026-09-24T12:00:00Z');
    // Starts first, but leaves late: step 1 at 12:25.
    const near = appt({ id: 'near', startsAt: '2026-09-24T13:00:00Z', travelMinutes: 0 });
    // Starts later, but a long drive: step 1 (11:55) already passed → due now.
    const far = appt({ id: 'far', startsAt: '2026-09-24T14:00:00Z', travelMinutes: 90 });
    expect(nextNagLine([near, far], at)?.appointmentId).toBe('far');
  });

  it('ignores appointments that are left or done', () => {
    expect(nextNagLine([appt({ status: 'left' }), appt({ status: 'done' })], now)).toBeNull();
  });

  it('says the next supportive nag for a stuck appointment, with the neutral cue', () => {
    // Stuck at 14:25: supportive nags at 14:30 (step 3) and 14:33 (step 4), nothing after.
    const stuck = appt({ status: 'stuck', stuckAt: now.toISOString() });
    const line = nextNagLine([stuck], now);
    expect(line).toMatchObject({ tone: 'supportive' });
    expect(line?.at.toISOString()).toBe('2026-09-24T14:30:00.000Z');
    // 15:00Z is 8:00 in Los Angeles (Jest's zone).
    const templates = BANK.supportive.spicy.map((t) => t.replace('{cue}', 'starts at 8:00'));
    expect(templates.map((t) => t.toLowerCase())).toContain(line?.text.toLowerCase());
    expect(nextNagLine([stuck], new Date('2026-09-24T14:34:00Z'))).toBeNull();
  });

  it('uses the earliest appointment that still has a step', () => {
    const list = [
      appt({ id: 'later', startsAt: '2026-09-24T18:00:00Z' }),
      appt({ id: 'over', startsAt: '2026-09-24T09:00:00Z' }),
      appt({ id: 'soon' }),
    ];
    const line = nextNagLine(list, now);
    expect(line).toMatchObject({ appointmentId: 'soon', tone: 'firm' });
    expect(line?.at.toISOString()).toBe(now.toISOString());
    expect(line?.text).toMatch(/leave in 5 min/i);
  });

  it('returns null when nothing is coming up', () => {
    expect(nextNagLine([appt({ startsAt: '2026-09-24T09:00:00Z' })], now)).toBeNull();
    expect(nextNagLine([], now)).toBeNull();
  });
});

describe('previewLine', () => {
  const input = {
    id: 'preview',
    startsAt: new Date('2026-09-24T15:00:00Z'),
    travelMinutes: 25,
    bufferMinutes: 5,
    inPerson: true,
    intensity: 'savage' as const,
  };

  it.each([
    ['mild', 'sarcastic'],
    ['spicy', 'savage'],
    ['savage', 'unhinged'],
  ] as const)('previews the harshest step for %s (%s, 10 min late)', (intensity, tone) => {
    const p = previewLine({ ...input, intensity });
    expect(p.tone).toBe(tone);
    expect(p.text).toMatch(/10 min late/i);
  });

  it('is the polite step-1 start line otherwise', () => {
    const p = previewLine({ ...input, inPerson: false });
    expect(p.tone).toBe('polite');
    expect(p.text).toMatch(/starts in 60 min/i);
  });

  it('changes with intensity', () => {
    expect(previewLine({ ...input, intensity: 'mild' }).text).not.toBe(previewLine(input).text);
  });
});
