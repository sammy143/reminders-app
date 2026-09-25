import type { Appointment } from '@/types';

import { BANK } from './lines/bank';
import {
  IN_PERSON_SERIES_LIMIT,
  diffSchedule,
  planNotifications as planWithSkipped,
  type PlannedNotification,
  type ScheduledNotification,
} from './notificationPlan';

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
  list.map((p) => ({ id: p.key, at: p.at, body: p.body, category: p.category }));
const noImminent = { now: NOW, keepImminentFor: new Set<string>() };

describe('stuck and left (F007)', () => {
  // Leave by NOW + 15: step 1 (NOW − 15) is due, steps 2–6 are at +5, +15, +18, +21, +25 min.
  const underway = (status: Appointment['status']) => appt('a', 45, { status });
  const supportive = BANK.supportive.spicy.map((t) => t.replace('{cue}', ''));
  const template = (body: string) =>
    body.replace(/(Leave in \d+ min|Leave now|\d+ min late)\.$/i, '.');

  it('plans the remaining steps of a stuck appointment with supportive lines and category', () => {
    const plan = planNotifications([underway('stuck')], NOW, new Set(['a']));
    expect(keys(plan)).toEqual([2, 3, 4, 5, 6].map((s) => `series:a:${s}`));
    const ladder = planNotifications([underway('scheduled')], NOW);
    expect(plan.map((p) => p.at)).toEqual(ladder.map((p) => p.at));
    for (const p of plan) {
      expect(p.category).toBe('nagSupportive');
      expect(supportive).toContain(template(p.body));
      expect(p.body).toMatch(/leave in \d+ min|leave now|\d+ min late/i);
    }
    expect(new Set(plan.map((p) => p.body)).size).toBe(plan.length);
  });

  it('never re-fires the due step of a stuck appointment (the ladder would, when just saved)', () => {
    expect(keys(planNotifications([underway('stuck')], NOW, new Set(['a'])))).not.toContain(
      'series:a:1',
    );
    expect(keys(planNotifications([underway('scheduled')], NOW, new Set(['a'])))).toContain(
      'series:a:1',
    );
  });

  it('plans nothing for a left or done appointment', () => {
    expect(planNotifications([underway('left'), underway('done')], NOW)).toEqual([]);
  });

  it('gives the ladder both buttons and other reminders none', () => {
    const plan = planNotifications([appt('a', 120), online('b', 90)], NOW);
    expect(new Set(plan.filter((p) => p.appointmentId === 'a').map((p) => p.category))).toEqual(
      new Set(['nagSeries']),
    );
    expect(plan.filter((p) => p.appointmentId === 'b').map((p) => p.category)).toEqual([null]);
  });

  it('counts a stuck series toward the in-person limit', () => {
    const list = [underway('stuck'), appt('b', 120), appt('c', 240)];
    const ids = new Set(planNotifications(list, NOW).map((p) => p.appointmentId));
    expect(ids).toEqual(new Set(['a', 'b']));
    expect(IN_PERSON_SERIES_LIMIT).toBe(2);
  });

  it('replaces a scheduled ladder with the supportive series, and cancels it when left', () => {
    const ladder = asScheduled(planNotifications([underway('scheduled')], NOW));
    const stuckPlan = planNotifications([underway('stuck')], NOW);
    const replaced = diffSchedule(stuckPlan, ladder, noImminent);
    expect(replaced.toCancel.sort()).toEqual(keys(stuckPlan).sort());
    expect(replaced.toSchedule).toEqual(stuckPlan);

    const left = diffSchedule(planNotifications([underway('left')], NOW), ladder, noImminent);
    expect(left.toCancel.sort()).toEqual(ladder.map((n) => n.id).sort());
    expect(left.toSchedule).toEqual([]);
  });

  it('reschedules a notification whose category differs (e.g. scheduled before F007)', () => {
    const plan = planNotifications([appt('a', 120)], NOW);
    const old = asScheduled(plan).map((n) => ({ ...n, category: null }));
    const { toCancel, toSchedule } = diffSchedule(plan, old, noImminent);
    expect(toCancel).toHaveLength(plan.length);
    expect(toSchedule).toEqual(plan);
  });
});
