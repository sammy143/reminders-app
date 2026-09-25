import type { Appointment } from '@/types';

import { diffSchedule, planNotifications, type PlannedNotification } from './notificationPlan';
import { muteUntilMidnight } from './settings';

// Fixed time (Jest runs in America/Los_Angeles). Never the real clock.
const NOW = new Date('2026-09-25T09:00:00-07:00');
const MIDNIGHT = muteUntilMidnight(NOW); // 2026-09-26T00:00:00-07:00
const MIN = 60_000;

/** In person, leaves 30 min before the start (travel 20 + buffer 10). */
const appt = (id: string, startsAt: string, extra: Partial<Appointment> = {}): Appointment => ({
  id,
  title: id,
  startsAt,
  travelMinutes: 20,
  bufferMinutes: 10,
  inPerson: true,
  intensity: 'spicy',
  status: 'scheduled',
  notificationIds: [],
  source: 'manual',
  ...extra,
});

const today = appt('today', '2026-09-25T15:00:00-07:00');
const lateTonight = appt('late', '2026-09-25T23:50:00-07:00'); // whole series before midnight
// Leave by 23:55 (see below): its series straddles midnight.
const justAfterMidnight = appt('night', '2026-09-26T00:25:00-07:00');
const tomorrow = appt('tomorrow', '2026-09-26T10:00:00-07:00');

const keys = (list: readonly { key: string }[]) => list.map((n) => n.key);
const plan = (list: Appointment[], mutedUntil: Date | null, justSaved = new Set<string>()) =>
  planNotifications(list, NOW, justSaved, { mutedUntil }).notifications;

describe('planNotifications while muted (F008)', () => {
  it('drops every notification before mutedUntil and keeps tomorrow’s', () => {
    const muted = plan([today, tomorrow], MIDNIGHT);
    expect(keys(muted)).toEqual([1, 2, 3, 4, 5, 6].map((s) => `series:tomorrow:${s}`));
    expect(muted).toEqual(
      plan([today, tomorrow], null).filter((p) => p.appointmentId === 'tomorrow'),
    );
  });

  it('splits a series that straddles midnight: steps from midnight on still nag', () => {
    // Leave by 23:55 → steps 23:25, 23:45, 23:55 (muted), 23:58 (muted), 00:01, 00:05.
    const muted = plan([justAfterMidnight], MIDNIGHT);
    expect(muted.map((p) => [p.step, p.at.getTime() >= MIDNIGHT.getTime()])).toEqual([
      [5, true],
      [6, true],
    ]);
  });

  it('keeps a notification exactly at mutedUntil', () => {
    const until = new Date('2026-09-26T00:01:00-07:00');
    expect(plan([justAfterMidnight], until).map((p) => p.step)).toEqual([5, 6]);
    const later = new Date(until.getTime() + 1);
    expect(plan([justAfterMidnight], later).map((p) => p.step)).toEqual([6]);
  });

  it('gives no series slot to a fully muted appointment, so the next one gets its series', () => {
    const muted = plan([today, lateTonight, tomorrow], MIDNIGHT);
    expect(new Set(muted.map((p) => p.appointmentId))).toEqual(new Set(['tomorrow']));
    const unmuted = plan([today, lateTonight, tomorrow], null);
    expect(new Set(unmuted.map((p) => p.appointmentId))).toEqual(new Set(['today', 'late']));
  });

  it('never fires the due step of a just-saved appointment while muted', () => {
    const soon = appt('soon', new Date(NOW.getTime() + 20 * MIN).toISOString());
    expect(plan([soon], null, new Set(['soon']))[0].at.getTime()).toBeLessThan(NOW.getTime() + MIN);
    expect(plan([soon], MIDNIGHT, new Set(['soon']))).toEqual([]);
  });

  it('drops supportive nags too', () => {
    const stuck = appt('stuck', '2026-09-25T09:40:00-07:00', {
      status: 'stuck',
      stuckAt: '2026-09-25T15:59:00.000Z',
    });
    expect(plan([stuck], null).length).toBeGreaterThan(0);
    expect(plan([stuck], MIDNIGHT)).toEqual([]);
  });

  it('plans as usual when mutedUntil is null or already past', () => {
    const past = new Date(NOW.getTime() - MIN);
    expect(plan([today, tomorrow], past)).toEqual(plan([today, tomorrow], null));
  });

  it('turns into cancels of today’s series when diffed against what is scheduled', () => {
    const scheduled = plan([today, tomorrow], null).map((p: PlannedNotification) => ({
      id: p.key,
      at: p.at,
      body: p.body,
      category: p.category,
    }));
    const { toCancel, toSchedule } = diffSchedule(plan([today, tomorrow], MIDNIGHT), scheduled, {
      now: NOW,
      keepImminentFor: new Set(),
    });
    expect(toCancel).toEqual([1, 2, 3, 4, 5, 6].map((s) => `series:today:${s}`));
    expect(toSchedule).toEqual([]);
  });
});
