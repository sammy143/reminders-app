import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

import type { AppointmentDraft } from '@/domain/appointment';
import type { NotificationResponse } from '@/domain/notificationActions';
import { BANK } from '@/domain/lines/bank';
import { parseSeriesKey } from '@/domain/notificationPlan';
import { createFakeNotifications, type FakeNotifications } from '@/services/notificationsFake';
import type { Appointment } from '@/types';

import { notificationsSettled, resetAppointmentsForTests, useAppointments } from './appointments';
import { handleNotificationResponse, useNotificationResponses } from './useNotificationResponses';

// Fixed time (Jest runs in America/Los_Angeles). Never the real clock.
const NOW = new Date('2026-09-25T09:00:00-07:00');
const MIN = 60_000;
const LATER = new Date(NOW.getTime() + MIN);

// Starts 09:45, leave by 09:15: step 1 (08:45) is due at save, steps 2–6 at 09:05 … 09:25.
const draft: AppointmentDraft = {
  title: 'Dentist',
  startsAt: new Date(NOW.getTime() + 45 * MIN),
  travelMinutes: 20,
  bufferMinutes: 10,
  inPerson: true,
  intensity: 'spicy',
};

let port: FakeNotifications;
const store = () => useAppointments.getState();
const pendingFor = (id: string) =>
  [...port.pending.values()]
    .filter((n) => parseSeriesKey(n.id)?.appointmentId === id)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
const stored = async (): Promise<Appointment[]> =>
  JSON.parse((await AsyncStorage.getItem('appointments.v1')) ?? '[]');
const response = (id: string, actionId: string, step = 2): NotificationResponse => ({
  responseId: `series:${id}:${step}|1|${actionId}`,
  notificationId: `series:${id}:${step}`,
  actionId,
});

const alarmFor = (appointmentId: string) => ({ screen: 'alarm', appointmentId });

/** Adds the appointment, lets its due step 1 fire, and moves the clock on a minute. */
async function underway(): Promise<string> {
  const id = await store().add(draft);
  await notificationsSettled();
  expect(pendingFor(id)).toHaveLength(6);
  port.deliverUntil(new Date(NOW.getTime() + 10_000));
  useAppointments.setState({ clock: () => LATER });
  return id;
}

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  port = createFakeNotifications();
  resetAppointmentsForTests(() => NOW, port);
});
afterEach(() => notificationsSettled());

describe('store: leave and stuck', () => {
  it("I've left: persists `left` and cancels the remaining series", async () => {
    const id = await underway();
    await store().leave(id);
    await notificationsSettled();
    expect(store().byId(id)?.status).toBe('left');
    expect((await stored())[0].status).toBe('left');
    expect(pendingFor(id)).toEqual([]);
  });

  it("I'm genuinely stuck: persists `stuck`, keeps 2 supportive nags, cancels the rest; left clears them", async () => {
    const id = await underway();
    const ladder = pendingFor(id);
    await store().stuck(id);
    await notificationsSettled();
    expect((await stored())[0]).toMatchObject({ status: 'stuck', stuckAt: LATER.toISOString() });
    // Stuck at 09:01: steps 2 (09:05) and 3 (09:15) stay, supportive; 4–6 are cancelled.
    const now = pendingFor(id);
    expect(now.map((n) => n.id)).toEqual([2, 3].map((s) => `series:${id}:${s}`));
    expect(now.map((n) => n.at)).toEqual(ladder.slice(0, 2).map((n) => n.at));
    const templates = BANK.supportive.spicy.map((t) => t.replace('{cue}', ''));
    for (const n of now) {
      expect(n.category).toBe('nagSupportive');
      expect(n.body).toMatch(/starts at 9:45\.$/i);
      expect(n.body).not.toMatch(/leav|late|\bmin\b|\bnow\b/i);
      expect(templates).toContain(n.body.replace(/starts at 9:45\.$/i, '.'));
    }

    // A later sync (app back in the foreground after nag 1) never adds a third.
    port.deliverUntil(new Date(NOW.getTime() + 6 * MIN));
    useAppointments.setState({ clock: () => new Date(NOW.getTime() + 6 * MIN) });
    await store().syncNotifications();
    expect(pendingFor(id).map((n) => n.id)).toEqual([`series:${id}:3`]);

    await store().leave(id);
    await notificationsSettled();
    expect(pendingFor(id)).toEqual([]);
  });

  it("I've left after stuck cancels the supportive series too", async () => {
    const id = await underway();
    await store().stuck(id);
    await store().leave(id);
    await notificationsSettled();
    expect(store().byId(id)?.status).toBe('left');
    expect(pendingFor(id)).toEqual([]);
  });

  it('saves nothing for an unknown id or a transition that changes nothing', async () => {
    const id = await underway();
    await store().leave(id);
    // The official mock's setItem is already a jest.fn with history: start counting here.
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    setItem.mockClear();
    await store().leave(id);
    await store().stuck(id);
    await store().leave('nope');
    expect(setItem).not.toHaveBeenCalled();
    expect(store().byId(id)?.status).toBe('left');
  });

  it('a timing edit after leaving starts the series fresh', async () => {
    const id = await underway();
    await store().leave(id);
    await store().update(id, { ...draft, startsAt: new Date(NOW.getTime() + 120 * MIN) });
    await notificationsSettled();
    expect(store().byId(id)?.status).toBe('scheduled');
    expect(pendingFor(id)).toHaveLength(6);
  });
});

describe('notification responses', () => {
  it('"left" marks the appointment left, cancels, dismisses and opens the alarm', async () => {
    const id = await underway();
    const onOpen = jest.fn();
    await handleNotificationResponse(response(id, 'left'), onOpen);
    await notificationsSettled();
    expect(store().byId(id)?.status).toBe('left');
    expect(pendingFor(id)).toEqual([]);
    expect(port.dismissed).toEqual([`series:${id}:2`]);
    expect(onOpen).toHaveBeenCalledWith(alarmFor(id));
  });

  it('"stuck" switches the remaining series to supportive', async () => {
    const id = await underway();
    const onOpen = jest.fn();
    await handleNotificationResponse(response(id, 'stuck'), onOpen);
    await notificationsSettled();
    expect(store().byId(id)?.status).toBe('stuck');
    expect(new Set(pendingFor(id).map((n) => n.category))).toEqual(new Set(['nagSupportive']));
    expect(onOpen).toHaveBeenCalledWith(alarmFor(id));
  });

  it('"open" (a plain tap) only opens the alarm', async () => {
    const id = await underway();
    const onOpen = jest.fn();
    await handleNotificationResponse(response(id, 'open'), onOpen);
    expect(store().byId(id)?.status).toBe('scheduled');
    expect(port.dismissed).toEqual([]);
    expect(onOpen).toHaveBeenCalledWith(alarmFor(id));
  });

  it('ignores an unknown appointment, a foreign identifier and an unknown action', async () => {
    const id = await underway();
    const onOpen = jest.fn();
    // The official mock's setItem is already a jest.fn with history: start counting here.
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    setItem.mockClear();
    await handleNotificationResponse(response('nope', 'left'), onOpen);
    await handleNotificationResponse(
      { responseId: 'x', notificationId: 'snooze:' + id + ':1', actionId: 'left' },
      onOpen,
    );
    await handleNotificationResponse(response(id, 'snooze'), onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(port.dismissed).toEqual([]);
    expect(store().byId(id)?.status).toBe('scheduled');
  });

  it('still opens the alarm when saving fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const id = await underway();
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    const onOpen = jest.fn();
    await handleNotificationResponse(response(id, 'left'), onOpen);
    expect(store().byId(id)?.status).toBe('scheduled');
    expect(onOpen).toHaveBeenCalledWith(alarmFor(id));
    expect(warn).toHaveBeenCalled();
  });
});

describe('useNotificationResponses', () => {
  it('handles responses while the app runs, and stops on unmount', async () => {
    const id = await underway();
    const onOpen = jest.fn();
    const { unmount } = await renderHook(() => useNotificationResponses(onOpen));
    port.respond(response(id, 'stuck'));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(alarmFor(id)));
    expect(store().byId(id)?.status).toBe('stuck');
    await unmount();
    port.respond(response(id, 'left', 3));
    await notificationsSettled();
    expect(store().byId(id)?.status).toBe('stuck');
  });

  it('handles the response that launched the app (cold start) once', async () => {
    const id = await underway();
    port.lastResponse = response(id, 'left');
    const onOpen = jest.fn();
    await renderHook(() => useNotificationResponses(onOpen));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(alarmFor(id)));
    // The same response arriving through the listener as well is not handled twice.
    port.respond(response(id, 'left'));
    await notificationsSettled();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(store().byId(id)?.status).toBe('left');
    expect(port.lastResponse).toBeNull();
  });
});

describe('fix round 1', () => {
  it("I've left clears that appointment's delivered nags from the tray, and only those", async () => {
    const id = await underway();
    port.presented = [`series:${id}:1`, 'series:other:1', 'someone-else'];
    await store().leave(id);
    await waitFor(() => expect(port.dismissed).toEqual([`series:${id}:1`]));
    expect(port.presented).toEqual(['series:other:1', 'someone-else']);
  });

  it.each(['leave', 'stuck'] as const)(
    'after %s, a small start fix keeps the status; a move to tomorrow starts fresh',
    async (action) => {
      const id = await underway();
      await store()[action](id);
      const status = store().byId(id)?.status;
      // Starts 09:51 instead of 09:45: its step 1 (08:51) has passed, so this is a fix, not a reschedule.
      await store().update(id, { ...draft, startsAt: new Date(NOW.getTime() + 51 * MIN) });
      await notificationsSettled();
      expect(store().byId(id)?.status).toBe(status);
      if (action === 'leave') expect(pendingFor(id)).toEqual([]);
      else expect(pendingFor(id).every((n) => n.category === 'nagSupportive')).toBe(true);

      await store().update(id, { ...draft, startsAt: new Date(NOW.getTime() + 24 * 60 * MIN) });
      await notificationsSettled();
      expect(store().byId(id)?.status).toBe('scheduled');
      expect(pendingFor(id)).toHaveLength(6);
      expect(new Set(pendingFor(id).map((n) => n.category))).toEqual(new Set(['nagSeries']));
    },
  );

  it('a travel or buffer tweak keeps left and stuck', async () => {
    const id = await underway();
    await store().stuck(id);
    await store().update(id, { ...draft, travelMinutes: 15 });
    expect(store().byId(id)?.status).toBe('stuck');
    await store().leave(id);
    await store().update(id, { ...draft, bufferMinutes: 5 });
    await notificationsSettled();
    expect(store().byId(id)?.status).toBe('left');
    expect(pendingFor(id)).toEqual([]);
  });

  it('cancels an imminent ladder nag once stuck (it would be an insult)', async () => {
    const id = await underway();
    const imminent = new Date(LATER.getTime() + 2_000);
    port.pending.set(`series:${id}:1`, {
      id: `series:${id}:1`,
      at: imminent,
      body: 'Move.',
      category: 'nagSeries',
    });
    await store().syncNotifications();
    expect(port.pending.has(`series:${id}:1`)).toBe(true); // kept while scheduled
    await store().stuck(id);
    await notificationsSettled();
    expect(port.pending.has(`series:${id}:1`)).toBe(false);
  });
});
