import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { AppointmentDraft } from '@/domain/appointment';
import { FIRE_NOW_LEAD_MS, parseSeriesKey } from '@/domain/notificationPlan';
import { createFakeNotifications, type FakeNotifications } from '@/services/notificationsFake';

import { notificationsSettled, resetAppointmentsForTests, useAppointments } from './appointments';
import { useForegroundSync } from './useForegroundSync';

// Fixed time (Jest runs in America/Los_Angeles). Never the real clock.
const NOW = new Date('2026-09-25T09:00:00-07:00');
const MIN = 60_000;

const draft = (startsInMin: number, extra: Partial<AppointmentDraft> = {}): AppointmentDraft => ({
  title: 'Dentist',
  startsAt: new Date(NOW.getTime() + startsInMin * MIN),
  travelMinutes: 20,
  bufferMinutes: 10,
  inPerson: true,
  intensity: 'spicy',
  ...extra,
});

let port: FakeNotifications;
const store = () => useAppointments.getState();
const pendingFor = (id: string) =>
  [...port.pending.values()]
    .filter((n) => parseSeriesKey(n.id)?.appointmentId === id)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  port = createFakeNotifications();
  resetAppointmentsForTests(() => NOW, port);
});
afterEach(() => notificationsSettled());

describe('notification sync from the store', () => {
  it('schedules on save, reschedules on edit and cancels on delete', async () => {
    const id = await store().add(draft(120));
    await notificationsSettled();
    expect(port.keys()).toEqual([1, 2, 3, 4, 5, 6].map((s) => `series:${id}:${s}`));
    const before = pendingFor(id).map((n) => n.at.getTime());

    await store().update(id, draft(180));
    await notificationsSettled();
    expect(pendingFor(id).map((n) => n.at.getTime())).toEqual(before.map((t) => t + 60 * MIN));

    await store().remove(id);
    await notificationsSettled();
    expect(port.pending.size).toBe(0);
  });

  it('schedules series for the next two in-person appointments only', async () => {
    const first = await store().add(draft(120));
    const third = await store().add(draft(360));
    const second = await store().add(draft(240));
    await notificationsSettled();
    const scheduledIds = new Set(
      [...port.pending.values()].map((n) => parseSeriesKey(n.id)?.appointmentId),
    );
    expect(scheduledIds).toEqual(new Set([first, second]));
    expect(pendingFor(third)).toEqual([]);
  });

  it('fires the due step of an appointment saved 2 min out, then escalates', async () => {
    const id = await store().add(draft(2, { travelMinutes: 0, bufferMinutes: 0 }));
    await notificationsSettled();
    // Leave by = start: step 2 (−10 min) is pulled to now, steps 3–6 follow at 0/+3/+6/+10 min.
    expect(pendingFor(id).map((n) => [n.id, n.at.getTime() - NOW.getTime()])).toEqual([
      [`series:${id}:2`, FIRE_NOW_LEAD_MS],
      [`series:${id}:3`, 2 * MIN],
      [`series:${id}:4`, 5 * MIN],
      [`series:${id}:5`, 8 * MIN],
      [`series:${id}:6`, 12 * MIN],
    ]);
  });

  it('re-fires the due step only after a timing edit', async () => {
    const twoMinOut = draft(2, { travelMinutes: 0, bufferMinutes: 0 });
    const id = await store().add(twoMinOut);
    await notificationsSettled();
    const later = new Date(NOW.getTime() + 10_000);
    port.deliverUntil(later); // step 2 fired
    useAppointments.setState({ clock: () => later });
    const hasStep2 = () => port.pending.has(`series:${id}:2`);

    await store().update(id, { ...twoMinOut, title: 'Renamed' });
    await notificationsSettled();
    expect(hasStep2()).toBe(false);

    await store().update(id, { ...twoMinOut, title: 'Renamed', intensity: 'savage' });
    await notificationsSettled();
    expect(hasStep2()).toBe(false);
    expect(port.pending.size).toBe(4); // steps 3–6, re-worded for savage

    await store().update(id, {
      ...twoMinOut,
      title: 'Renamed',
      intensity: 'savage',
      startsAt: new Date(NOW.getTime() + 3 * MIN),
    });
    await notificationsSettled();
    expect(hasStep2()).toBe(true);
  });

  it('asks for permission on the first save, not on load', async () => {
    port.permission = 'undetermined';
    await store().hydrate();
    await notificationsSettled();
    expect(port.calls.request).toBe(0);
    expect(store().notificationPermission).toBe('undetermined');

    await store().add(draft(120));
    await notificationsSettled();
    expect(port.calls.request).toBe(1);
    expect(port.pending.size).toBe(6);
  });

  it('keeps the banner after an Android 13+ no until notifications are granted', async () => {
    // Android 13+: before and after one "no", reads say denied + canAskAgain → `undetermined`.
    port.permission = 'undetermined';
    port.answer = 'undetermined';
    const seen: (string | null)[] = [];
    const unsubscribe = useAppointments.subscribe((state, prev) => {
      if (state.notificationPermission !== prev.notificationPermission) {
        seen.push(state.notificationPermission);
      }
    });

    await store().add(draft(120));
    await notificationsSettled();
    expect(port.calls.request).toBe(1);
    expect(store().notificationPermission).toBe('denied');

    // The dialog closing brings the app back to the foreground: a sync that doesn't ask.
    await store().syncNotifications();
    expect(store().notificationPermission).toBe('denied');
    expect(port.calls.request).toBe(1);
    expect(port.pending.size).toBe(0);

    // The user allows notifications in Settings and comes back.
    port.permission = 'granted';
    await store().syncNotifications();
    expect(store().notificationPermission).toBe('granted');
    expect(port.pending.size).toBe(6);
    unsubscribe();

    expect(seen).toEqual(['undetermined', 'denied', 'granted']);
    const deniedThenUndetermined = seen.some(
      (p, i) => p === 'denied' && seen[i + 1] === 'undetermined',
    );
    expect(deniedThenUndetermined).toBe(false);
  });

  it('schedules nothing and reports it when permission is denied', async () => {
    port.permission = 'undetermined';
    port.answer = 'denied';
    const id = await store().add(draft(120));
    await notificationsSettled();
    expect(store().byId(id)).toBeDefined();
    expect(port.calls.schedule).toBe(0);
    expect(store().notificationPermission).toBe('denied');
  });

  it('saves normally when notifications are unavailable (web, or the module failed to load)', async () => {
    port.permission = 'unavailable';
    const id = await store().add(draft(120));
    await notificationsSettled();
    expect(store().byId(id)).toBeDefined();
    expect(port.calls).toMatchObject({ schedule: 0, list: 0, request: 0 });
    expect(store().notificationPermission).toBe('unavailable');
  });

  it('never blocks or loses a save when the notifications service fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    port.listScheduled = () => Promise.reject(new Error('os'));
    const id = await store().add(draft(120));
    await notificationsSettled();
    expect(store().byId(id)).toBeDefined();
    expect(JSON.parse((await AsyncStorage.getItem('appointments.v1')) ?? '[]')).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('Notification sync failed', new Error('os'));
  });

  it('does not touch notifications when stored appointments could not be read', async () => {
    // Rejects on load and again on the retry inside the sync.
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('disk'))
      .mockRejectedValueOnce(new Error('disk'));
    await store().hydrate();
    await store().syncNotifications();
    expect(store().loadError).not.toBeNull();
    expect(port.calls.list).toBe(0);
  });

  it('tops up when the app comes to the foreground', async () => {
    let listener: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      listener = fn;
      return { remove };
    });
    const first = await store().add(draft(60));
    const second = await store().add(draft(120));
    const third = await store().add(draft(180));
    await notificationsSettled();
    expect(pendingFor(third)).toEqual([]);

    const { unmount } = await renderHook(() => useForegroundSync());
    // 'first' starts at +60; by +65 the OS has delivered everything due.
    const later = new Date(NOW.getTime() + 65 * MIN);
    port.deliverUntil(later);
    useAppointments.setState({ clock: () => later });
    listener?.('background');
    await notificationsSettled();
    expect(pendingFor(third)).toEqual([]);

    listener?.('active');
    await notificationsSettled();
    expect(pendingFor(first)).toEqual([]);
    // 'second' lost only its delivered step 1 (+60); nothing already delivered comes back.
    expect(pendingFor(second).map((n) => n.id.split(':')[2])).toEqual(['2', '3', '4', '5', '6']);
    expect(pendingFor(third)).toHaveLength(6);

    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
