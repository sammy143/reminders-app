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
  // Stuck pressed at NOW unless a test says otherwise.
  const underway = (status: Appointment['status'], stuckAt = NOW) =>
    appt('a', 45, { status, ...(status === 'stuck' ? { stuckAt: stuckAt.toISOString() } : {}) });
  const supportive = BANK.supportive.spicy.map((t) => t.replace('{cue}', ''));
  // Starts 08:45 local: the neutral cue, never a countdown or lateness.
  const template = (body: string) => body.replace(/starts at 8:45\.$/i, '.');
  const at = (min: number) => new Date(NOW.getTime() + min * MIN);

  it('plans at most 2 supportive nags: the next 2 steps after stuck, with the neutral cue', () => {
    const plan = planNotifications([underway('stuck')], NOW, new Set(['a']));
    expect(keys(plan)).toEqual(['series:a:2', 'series:a:3']);
    const ladder = planNotifications([underway('scheduled')], NOW);
    expect(plan.map((p) => p.at)).toEqual(ladder.slice(0, 2).map((p) => p.at));
    for (const p of plan) {
      expect(p.category).toBe('nagSupportive');
      expect(supportive).toContain(template(p.body));
      expect(p.body).toMatch(/starts at 8:45\.$/i);
      expect(p.body).not.toMatch(/leav|late|\bmin\b|\bnow\b/i);
    }
    expect(new Set(plan.map((p) => p.body)).size).toBe(plan.length);
  });

  it('keeps the same ≤ 2 nags as time passes: never a third one', () => {
    const stuck = underway('stuck'); // steps 2 (+5) and 3 (+15)
    expect(keys(planNotifications([stuck], at(1)))).toEqual(['series:a:2', 'series:a:3']);
    expect(keys(planNotifications([stuck], at(6)))).toEqual(['series:a:3']); // 2 delivered
    expect(planNotifications([stuck], at(16))).toEqual([]); // both delivered; 4–6 dropped
    expect(planNotifications([stuck], at(22))).toEqual([]);
  });

  it('sends only what is left when stuck comes late', () => {
    // Stuck at +19: steps 5 (+21) and 6 (+25) remain.
    expect(keys(planNotifications([underway('stuck', at(19))], at(19)))).toEqual([
      'series:a:5',
      'series:a:6',
    ]);
    // Stuck at +22: only step 6.
    expect(keys(planNotifications([underway('stuck', at(22))], at(22)))).toEqual(['series:a:6']);
    // Stuck after the last step: nothing.
    expect(planNotifications([underway('stuck', at(26))], at(26))).toEqual([]);
  });

  it('cancels the dropped steps of a ladder already scheduled', () => {
    const ladder = asScheduled(planNotifications([underway('scheduled')], NOW));
    const { toCancel, toSchedule } = diffSchedule(
      planNotifications([underway('stuck')], NOW),
      ladder,
      noImminent,
    );
    expect(toCancel.sort()).toEqual(ladder.map((n) => n.id).sort());
    expect(keys(toSchedule)).toEqual(['series:a:2', 'series:a:3']);
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

  it('cancels everything when left', () => {
    const ladder = asScheduled(planNotifications([underway('scheduled')], NOW));
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
