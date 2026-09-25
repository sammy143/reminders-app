import type { Appointment } from '@/types';

import { withLines } from './lines/select';
import {
  FIRE_NOW_LEAD_MS,
  IN_PERSON_SERIES_LIMIT,
  MAX_PLANNED,
  OTHER_REMINDER_LIMIT,
  diffSchedule,
  parseSeriesKey,
  planNotifications as planWithSkipped,
  timingChanged,
  type PlannedNotification,
  type ScheduledNotification,
} from './notificationPlan';
import { buildSeries } from './series';

// Fixed time (Jest runs in America/Los_Angeles). Never the real clock.
const NOW = new Date('2026-09-25T08:00:00-07:00');
const MIN = 60_000;

/** In person, starts `startsInMin` after NOW, leaves 30 min before (travel 20 + buffer 10). */
const appt = (id: string, startsInMin: number, extra: Partial<Appointment> = {}): Appointment => ({
  id,
  title: id,
  startsAt: new Date(NOW.getTime() + startsInMin * MIN).toISOString(),
  travelMinutes: 20,
  bufferMinutes: 10,
  inPerson: true,
  intensity: 'spicy',
  status: 'scheduled',
  notificationIds: [],
  source: 'manual',
  ...extra,
});
const online = (id: string, startsInMin: number) => appt(id, startsInMin, { inPerson: false });

const planNotifications = (...args: Parameters<typeof planWithSkipped>) =>
  planWithSkipped(...args).notifications;
const keys = (list: readonly { key: string }[]) => list.map((n) => n.key);
const asScheduled = (list: readonly PlannedNotification[]): ScheduledNotification[] =>
  list.map((p) => ({ id: p.key, at: p.at, body: p.body }));
const noImminent = { now: NOW, keepImminentFor: new Set<string>() };

describe('planNotifications', () => {
  it('plans the whole remaining series of an in-person appointment with its lines', () => {
    const a = appt('a', 120);
    const plan = planNotifications([a], NOW);
    const expected = withLines(buildSeries(a, NOW), a);
    expect(plan).toEqual(
      expected.map((s) => ({
        key: `series:a:${s.step}`,
        appointmentId: 'a',
        step: s.step,
        at: s.at,
        title: 'Nag',
        body: s.text,
      })),
    );
    expect(keys(plan)).toEqual([
      'series:a:1',
      'series:a:2',
      'series:a:3',
      'series:a:4',
      'series:a:5',
      'series:a:6',
    ]);
  });

  it(`gives only the next ${IN_PERSON_SERIES_LIMIT} in-person appointments a series`, () => {
    const plan = planNotifications([appt('c', 300), appt('a', 100), appt('b', 200)], NOW);
    expect(new Set(plan.map((p) => p.appointmentId))).toEqual(new Set(['a', 'b']));
    expect(plan).toHaveLength(12);
  });

  it('skips an in-person appointment with nothing left, so the next one gets its slot', () => {
    // 'over' started 5 min ago: its series is over. 'a' and 'b' get the two slots.
    const plan = planNotifications([appt('over', -5), appt('a', 100), appt('b', 200)], NOW);
    expect(new Set(plan.map((p) => p.appointmentId))).toEqual(new Set(['a', 'b']));
  });

  it(`includes the one reminder of the next ${OTHER_REMINDER_LIMIT} appointments not in person`, () => {
    const calls = Array.from({ length: 25 }, (_, i) => online(`call${i}`, 90 + i * 10));
    const plan = planNotifications([...calls, appt('a', 100)], NOW);
    const callKeys = keys(plan).filter((k) => k.startsWith('series:call'));
    expect(callKeys).toHaveLength(OTHER_REMINDER_LIMIT);
    expect(callKeys).toContain('series:call0:1');
    expect(callKeys).not.toContain(`series:call${OTHER_REMINDER_LIMIT}:1`);
    expect(keys(plan).filter((k) => k.startsWith('series:a:'))).toHaveLength(6);
  });

  it('excludes appointments that are no longer active', () => {
    const plan = planNotifications(
      [appt('left', 100, { status: 'left' }), appt('done', 120, { status: 'done' })],
      NOW,
    );
    expect(plan).toEqual([]);
  });

  it(`never plans more than ${MAX_PLANNED} with today's limits`, () => {
    const many = Array.from({ length: 40 }, (_, i) => appt(`p${i}`, 60 + i));
    const calls = Array.from({ length: 40 }, (_, i) => online(`c${i}`, 60 + i));
    expect(planNotifications([...many, ...calls], NOW).length).toBeLessThanOrEqual(MAX_PLANNED);
  });

  it('caps the total and keeps the soonest', () => {
    const list = Array.from({ length: 12 }, (_, i) => appt(`p${i}`, 90 + i * 5));
    const plan = planNotifications(list, NOW, new Set(), { inPerson: 12, other: 0, total: 60 });
    expect(plan).toHaveLength(60);
    const all = planNotifications(list, NOW, new Set(), { inPerson: 12, other: 0, total: 1000 });
    expect(all).toHaveLength(72);
    expect(plan).toEqual(all.slice(0, 60));
    const lastKept = plan[59].at.getTime();
    expect(all.slice(60).every((p) => p.at.getTime() >= lastKept)).toBe(true);
  });

  it('sorts by time, soonest first', () => {
    const plan = planNotifications([appt('late', 200), online('call', 100), appt('a', 90)], NOW);
    const times = plan.map((p) => p.at.getTime());
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });

  describe('due steps (the F003 pull-forward)', () => {
    // Starts in 28 min, leave by NOW − 2: step 3 (at leaveBy) is the latest passed, pulled to NOW.
    const late = appt('late', 28);

    it('plans the pulled step to fire a few seconds out for an appointment just saved', () => {
      const plan = planNotifications([late], NOW, new Set(['late']));
      expect(plan[0]).toMatchObject({
        key: 'series:late:3',
        at: new Date(NOW.getTime() + FIRE_NOW_LEAD_MS),
      });
      expect(plan[0].body).toMatch(/2 min late/);
      expect(keys(plan)).toEqual([
        'series:late:3',
        'series:late:4',
        'series:late:5',
        'series:late:6',
      ]);
    });

    it('leaves the due step out on other syncs, so it never repeats', () => {
      const plan = planNotifications([late], NOW);
      expect(keys(plan)).not.toContain('series:late:3');
      expect(plan.every((p) => p.at.getTime() > NOW.getTime())).toBe(true);
    });

    it('clamps a step a moment away to the lead time without calling it due', () => {
      // Leave by NOW + 2 s → step 3 is 2 s out: still future, so planned on any sync.
      const soon = appt('soon', 30, {
        startsAt: new Date(NOW.getTime() + 30 * MIN + 2_000).toISOString(),
      });
      const step3 = planNotifications([soon], NOW).find((p) => p.key === 'series:soon:3');
      expect(step3?.at).toEqual(new Date(NOW.getTime() + FIRE_NOW_LEAD_MS));
    });
  });
});

describe('diffSchedule', () => {
  const list = [appt('a', 120), online('call', 90)];
  const plan = planNotifications(list, NOW);

  it('does nothing when the OS already holds the plan', () => {
    expect(diffSchedule(plan, asScheduled(plan), noImminent)).toEqual({
      toCancel: [],
      toSchedule: [],
    });
  });

  it('schedules everything on an empty OS list', () => {
    expect(diffSchedule(plan, [], noImminent)).toEqual({ toCancel: [], toSchedule: plan });
  });

  it('cancels and reschedules an appointment whose time was edited', () => {
    const edited = planNotifications([appt('a', 150), online('call', 90)], NOW);
    const { toCancel, toSchedule } = diffSchedule(edited, asScheduled(plan), noImminent);
    expect(toCancel).toHaveLength(6);
    expect(keys(toSchedule)).toEqual(keys(edited.filter((p) => p.appointmentId === 'a')));
  });

  it('cancels and reschedules when only the text changed', () => {
    const edited = planNotifications(
      [appt('a', 120, { intensity: 'savage' }), online('call', 90)],
      NOW,
    );
    const changed = edited.filter((p, i) => p.body !== plan[i].body);
    expect(changed.length).toBeGreaterThan(0);
    const { toCancel, toSchedule } = diffSchedule(edited, asScheduled(plan), noImminent);
    expect(toSchedule).toEqual(changed);
    expect(toCancel).toHaveLength(changed.length);
  });

  it('cancels a deleted appointment and never touches other namespaces', () => {
    const old = asScheduled(plan);
    const snooze = { id: 'snooze:a:1', at: new Date(NaN), body: 'Snoozed.' };
    const roast = { id: 'roast-42', at: NOW, body: 'Nice try.' };
    const withoutA = plan.filter((p) => p.appointmentId !== 'a');
    const { toCancel, toSchedule } = diffSchedule(withoutA, [...old, snooze, roast], noImminent);
    expect(toSchedule).toEqual([]);
    expect(toCancel.sort()).toEqual(keys(plan.filter((p) => p.appointmentId === 'a')).sort());
  });

  it('reschedules an entry whose time the OS did not report', () => {
    const [first, ...rest] = asScheduled(plan);
    const unknown = { ...first, at: new Date(NaN) };
    const { toCancel, toSchedule } = diffSchedule(plan, [unknown, ...rest], noImminent);
    expect(toCancel).toEqual([first.id]);
    expect(keys(toSchedule)).toEqual([first.id]);
  });

  it('keeps an imminent unplanned notification of an unchanged appointment', () => {
    const imminent: ScheduledNotification = {
      id: 'series:a:3',
      at: new Date(NOW.getTime() + 2_000),
      body: 'Leave now.',
    };
    const keep = { now: NOW, keepImminentFor: new Set(['a']) };
    expect(diffSchedule([], [imminent], keep).toCancel).toEqual([]);
    expect(diffSchedule([], [imminent], noImminent).toCancel).toEqual(['series:a:3']);
    const later = { ...imminent, at: new Date(NOW.getTime() + 60_000) };
    expect(diffSchedule([], [later], keep).toCancel).toEqual(['series:a:3']);
  });
});

describe('series keys', () => {
  it('round-trips appointment and step, and rejects other identifiers', () => {
    expect(parseSeriesKey('series:3f2a-9:4')).toEqual({ appointmentId: '3f2a-9', step: 4 });
    expect(parseSeriesKey('snooze:3f2a-9:4')).toBeNull();
    expect(parseSeriesKey('series:3f2a-9:7')).toBeNull();
    expect(parseSeriesKey('3f2a-9:4')).toBeNull();
  });
});

describe('timingChanged', () => {
  const base = appt('a', 120);
  it.each([
    { name: 'start', edit: { startsAt: appt('a', 150).startsAt }, changed: true },
    { name: 'travel', edit: { travelMinutes: 25 }, changed: true },
    { name: 'buffer', edit: { bufferMinutes: 0 }, changed: true },
    { name: 'in person', edit: { inPerson: false }, changed: true },
    { name: 'title', edit: { title: 'Renamed' }, changed: false },
    { name: 'intensity', edit: { intensity: 'savage' as const }, changed: false },
    {
      name: 'same instant, other offset',
      edit: { startsAt: new Date(base.startsAt).toISOString().replace('Z', '+00:00') },
      changed: false,
    },
  ])('$name edit → $changed', ({ edit, changed }) => {
    expect(timingChanged(base, { ...base, ...edit })).toBe(changed);
  });
});

describe('bad data', () => {
  it('skips an appointment it cannot plan and plans the rest', () => {
    const broken = appt('broken', 100, { startsAt: 'not a date' });
    const result = planWithSkipped([broken, appt('a', 120)], NOW);
    expect(result.skipped).toEqual([{ appointmentId: 'broken', error: expect.any(RangeError) }]);
    expect(keys(result.notifications)).toHaveLength(6);
  });
});

describe('planned times', () => {
  it('rounds the fire-now time up to a whole second', () => {
    const odd = new Date(NOW.getTime() + 250);
    const late = appt('late', 28);
    const [first] = planNotifications([late], odd, new Set(['late']));
    expect(first.at.getTime()).toBe(NOW.getTime() + FIRE_NOW_LEAD_MS + 1_000);
  });
});
