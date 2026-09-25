import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

import type { AppointmentDraft } from '@/domain/appointment';
import type { NotificationResponse } from '@/domain/notificationActions';
import { parseSeriesKey } from '@/domain/notificationPlan';
import { toResponse } from '@/services/notifications';
import { createFakeNotifications, type FakeNotifications } from '@/services/notificationsFake';

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
const response = (id: string, actionId: string, step = 2): NotificationResponse => ({
  responseId: `series:${id}:${step}|1|${actionId}`,
  notificationId: `series:${id}:${step}`,
  actionId,
});

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

describe('notification responses: fix round 1', () => {
  const online: AppointmentDraft = {
    ...draft,
    inPerson: false,
    startsAt: new Date(NOW.getTime() + 90 * MIN),
  };

  it('an online reminder: a tap opens the editor; left and stuck are ignored', async () => {
    const id = await store().add(online);
    await notificationsSettled();
    const onOpen = jest.fn();
    await handleNotificationResponse(response(id, 'left', 1), onOpen);
    await handleNotificationResponse(response(id, 'stuck', 1), onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(store().byId(id)?.status).toBe('scheduled');
    expect(port.dismissed).toEqual([]);
    await handleNotificationResponse(response(id, 'open', 1), onOpen);
    expect(onOpen).toHaveBeenCalledWith({ screen: 'edit', appointmentId: id });
  });

  it('never rejects when navigation throws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const id = await underway();
    const onOpen = jest.fn(() => {
      throw new Error('navigator not ready');
    });
    await expect(handleNotificationResponse(response(id, 'open'), onOpen)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Could not open the appointment from a notification',
      new Error('navigator not ready'),
    );
  });

  it('a remount never re-applies a response already handled', async () => {
    const id = await underway();
    const r = { ...response(id, 'open'), responseId: `remount-${id}` };
    const onOpen = jest.fn();
    port.lastResponse = r;
    const first = await renderHook(() => useNotificationResponses(onOpen));
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    await first.unmount();
    port.lastResponse = r; // iOS handing out the same stale response again
    await renderHook(() => useNotificationResponses(onOpen));
    await notificationsSettled();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('still handles a new response on the same notification: another action, or a new delivery', async () => {
    const id = await underway();
    const onOpen = jest.fn();
    await renderHook(() => useNotificationResponses(onOpen));
    // The adapter's real mapping, so the dedupe key has its real shape.
    const raw = (actionIdentifier: string, date: number) =>
      ({
        actionIdentifier,
        notification: { date, request: { identifier: `series:${id}:2` } },
      }) as unknown as Parameters<typeof toResponse>[0];
    const DEFAULT = 'expo.modules.notifications.actions.DEFAULT';

    port.respond(toResponse(raw(DEFAULT, 1_000), DEFAULT));
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    port.respond(toResponse(raw('stuck', 1_000), DEFAULT));
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(2));
    expect(store().byId(id)?.status).toBe('stuck');
    port.respond(toResponse(raw(DEFAULT, 1_000), DEFAULT)); // the same one again: ignored
    port.respond(toResponse(raw(DEFAULT, 2_000), DEFAULT)); // same key, delivered again later
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(3));
    await notificationsSettled();
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it('store leave and stuck leave an event without an alarm unchanged', async () => {
    const id = await store().add(online);
    await notificationsSettled();
    await store().leave(id);
    await store().stuck(id);
    expect(store().byId(id)?.status).toBe('scheduled');
    expect(pendingFor(id)).toHaveLength(1);
  });
});
