import { parseSeriesKey } from '@/domain/notificationPlan';
import { createFakeNotifications } from '@/services/notificationsFake';
import type { Appointment } from '@/types';

import { createSyncQueue, ensurePermission, nextPermission, syncNotifications } from './scheduler';

// Fixed time (Jest runs in America/Los_Angeles). Never the real clock.
const T0 = new Date('2026-09-25T08:00:00-07:00');
const MIN = 60_000;
const at = (minFromT0: number) => new Date(T0.getTime() + minFromT0 * MIN);

/** In person, leave by 30 min before the start. */
const appt = (id: string, startsInMin: number, extra: Partial<Appointment> = {}): Appointment => ({
  id,
  title: id,
  startsAt: at(startsInMin).toISOString(),
  travelMinutes: 20,
  bufferMinutes: 10,
  inPerson: true,
  intensity: 'spicy',
  status: 'scheduled',
  notificationIds: [],
  source: 'manual',
  ...extra,
});

const ids = (keys: string[]) => [...new Set(keys.map((k) => parseSeriesKey(k)?.appointmentId))];

describe('syncNotifications', () => {
  it('schedules the plan, then does nothing when run again', async () => {
    const port = createFakeNotifications();
    const list = [appt('a', 120), appt('call', 90, { inPerson: false })];
    const first = await syncNotifications(port, list, T0);
    expect(first).toEqual({ scheduled: 7, cancelled: 0, skipped: [], errors: [] });

    const before = { ...port.calls };
    expect(await syncNotifications(port, list, at(1))).toEqual({
      scheduled: 0,
      cancelled: 0,
      skipped: [],
      errors: [],
    });
    expect(port.calls.schedule).toBe(before.schedule);
    expect(port.calls.cancel).toBe(before.cancel);
  });

  it('reschedules an edited appointment and cancels a deleted one', async () => {
    const port = createFakeNotifications();
    await syncNotifications(port, [appt('a', 120), appt('b', 200)], T0);
    const oldA = [...port.pending.values()].filter(
      (n) => parseSeriesKey(n.id)?.appointmentId === 'a',
    );

    await syncNotifications(port, [appt('a', 150), appt('b', 200)], T0);
    const newA = [...port.pending.values()].filter(
      (n) => parseSeriesKey(n.id)?.appointmentId === 'a',
    );
    expect(newA.map((n) => n.at.getTime())).toEqual(oldA.map((n) => n.at.getTime() + 30 * MIN));

    await syncNotifications(port, [appt('b', 200)], T0);
    expect(ids(port.keys())).toEqual(['b']);
  });

  it('tops up on foreground: once the first event passes, the third gets its series', async () => {
    const port = createFakeNotifications();
    const list = [appt('a', 60), appt('b', 120), appt('c', 180)];
    await syncNotifications(port, list, T0);
    expect(ids(port.keys())).toEqual(['a', 'b']);

    // 'a' starts at +60; its last step fired at +40. The OS delivered everything due by +65.
    const later = at(65);
    port.deliverUntil(later);
    await syncNotifications(port, list, later);
    expect(ids(port.keys()).sort()).toEqual(['b', 'c']);
    expect(port.keys().filter((k) => k.startsWith('series:c:'))).toHaveLength(6);
  });

  it('does not repeat a delivered step on the next sync', async () => {
    const port = createFakeNotifications();
    const list = [appt('a', 60)];
    await syncNotifications(port, list, T0);
    // Step 3 (at leaveBy, +30) fired; a foreground sync a minute later must not bring it back.
    port.deliverUntil(at(31));
    await syncNotifications(port, list, at(31));
    expect(port.keys()).toEqual(['series:a:4', 'series:a:5', 'series:a:6']);
  });

  it('keeps going when one call fails and reports it', async () => {
    const port = createFakeNotifications();
    const schedule = port.schedule;
    let failed = false;
    port.schedule = (p) => {
      if (!failed) {
        failed = true;
        return Promise.reject(new Error('boom'));
      }
      return schedule(p);
    };
    const result = await syncNotifications(port, [appt('a', 120)], T0);
    expect(result.scheduled).toBe(5);
    expect(result.errors).toEqual([new Error('boom')]);
    expect(port.keys()).toHaveLength(5);
  });
});

describe('syncNotifications with other kinds and bad data', () => {
  it('leaves notifications outside the series namespace alone', async () => {
    const port = createFakeNotifications();
    port.pending.set('snooze:a:1', {
      id: 'snooze:a:1',
      at: at(5),
      body: 'Snoozed.',
      category: null,
    });
    await syncNotifications(port, [appt('a', 120)], T0);
    await syncNotifications(port, [], T0);
    expect(port.keys()).toEqual(['snooze:a:1']);
  });

  it('skips a bad appointment and syncs the rest', async () => {
    const port = createFakeNotifications();
    const broken = appt('broken', 100, { startsAt: 'not a date' });
    const result = await syncNotifications(port, [broken, appt('a', 120)], T0);
    expect(result.skipped.map((s) => s.appointmentId)).toEqual(['broken']);
    expect(ids(port.keys())).toEqual(['a']);
  });
});

describe('ensurePermission', () => {
  it('asks only when told to and never asked before', async () => {
    const port = createFakeNotifications('undetermined');
    expect(await ensurePermission(port, false)).toBe('undetermined');
    expect(port.calls.request).toBe(0);
    expect(await ensurePermission(port, true)).toBe('granted');
    expect(port.calls.request).toBe(1);
  });

  it('reports a no as denied even when Android says it may ask again', async () => {
    const port = createFakeNotifications('undetermined');
    port.answer = 'undetermined';
    expect(await ensurePermission(port, true)).toBe('denied');
  });

  it('does not ask again after a denial', async () => {
    const port = createFakeNotifications('denied');
    expect(await ensurePermission(port, true)).toBe('denied');
    expect(port.calls.request).toBe(0);
  });
});

describe('nextPermission', () => {
  it.each([
    { previous: 'denied', read: 'undetermined', shown: 'denied' },
    { previous: 'denied', read: 'granted', shown: 'granted' },
    { previous: 'denied', read: 'denied', shown: 'denied' },
    { previous: 'granted', read: 'undetermined', shown: 'undetermined' },
    { previous: null, read: 'undetermined', shown: 'undetermined' },
    { previous: 'undetermined', read: 'denied', shown: 'denied' },
  ] as const)('$previous then a $read read shows $shown', ({ previous, read, shown }) => {
    expect(nextPermission(previous, read)).toBe(shown);
  });
});

describe('createSyncQueue', () => {
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
  };

  it('runs one at a time and merges requests made mid-run into one follow-up', async () => {
    const runs: string[][] = [];
    const gates = [deferred(), deferred()];
    let active = 0;
    let maxActive = 0;
    const queue = createSyncQueue(async (justSaved) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const gate = gates[runs.length];
      runs.push([...justSaved]);
      await gate.promise;
      active -= 1;
    });

    const first = queue.request('a');
    await Promise.resolve(); // let the first run start
    const second = queue.request('b');
    const third = queue.request();
    const fourth = queue.request('c');
    expect(second).toBe(third);
    expect(third).toBe(fourth);

    gates[0].resolve();
    await first;
    gates[1].resolve();
    await second;
    await queue.idle();

    expect(runs).toEqual([['a'], ['b', 'c']]);
    expect(maxActive).toBe(1);
  });

  it('keeps working after a run fails', async () => {
    let calls = 0;
    const queue = createSyncQueue(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
    });
    await expect(queue.request()).rejects.toThrow('boom');
    await expect(queue.request()).resolves.toBeUndefined();
    await queue.idle();
    expect(calls).toBe(2);
  });
});
