import AsyncStorage from '@react-native-async-storage/async-storage';

import { FIRE_NOW_LEAD_MS, parseSeriesKey } from '@/domain/notificationPlan';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import { createFakeNotifications, type FakeNotifications } from '@/services/notificationsFake';
import { SETTINGS_KEY } from '@/services/settingsStore';

import { notificationsSettled, resetAppointmentsForTests, useAppointments } from './appointments';
import { SETTINGS_LOAD_ERROR, resetSettingsForTests, useSettings } from './settings';

// Fixed time (Jest runs in America/Los_Angeles). Never the real clock.
const NOW = new Date('2026-09-25T09:00:00-07:00');
const MIN = 60_000;

// The AsyncStorage mock's functions are jest.fn()s: spying on them changes them for good, so each
// test starts from the real in-memory implementations again.
const storage = {
  getItem: AsyncStorage.getItem as jest.Mock,
  setItem: AsyncStorage.setItem as jest.Mock,
};
const realGetItem = storage.getItem.getMockImplementation()!;
const realSetItem = storage.setItem.getMockImplementation()!;
const settingsReads = () => storage.getItem.mock.calls.filter(([key]) => key === SETTINGS_KEY);
const failSettingsReads = () =>
  storage.getItem.mockImplementation((key: string) =>
    key === SETTINGS_KEY ? Promise.reject(new Error('locked')) : realGetItem(key),
  );

let port: FakeNotifications;
let now = NOW;
const clock = () => now;
const settings = () => useSettings.getState();
const appointments = () => useAppointments.getState();

/** A new app session: stores forget their state and read storage again; pending nags stay. */
const restart = () => {
  resetSettingsForTests(clock);
  resetAppointmentsForTests(clock, port);
};

const add = (title: string, startsAt: string) =>
  appointments().add({
    title,
    startsAt: new Date(startsAt),
    travelMinutes: 20,
    bufferMinutes: 10,
    inPerson: true,
    intensity: 'spicy',
  });
const idsOf = (id: string) => port.keys().filter((k) => parseSeriesKey(k)?.appointmentId === id);

beforeEach(async () => {
  jest.restoreAllMocks();
  storage.getItem.mockReset().mockImplementation(realGetItem);
  storage.setItem.mockReset().mockImplementation(realSetItem);
  await AsyncStorage.clear();
  now = NOW;
  port = createFakeNotifications();
  restart();
});
afterEach(() => notificationsSettled());

describe('settings store', () => {
  it('starts with the defaults', async () => {
    await settings().hydrate();
    expect(settings().settings).toEqual(DEFAULT_SETTINGS);
    expect(settings().hydrated).toBe(true);
  });

  it('persists the defaults across a restart', async () => {
    await settings().setDefaultIntensity('savage');
    await settings().adjustDefaultBuffer(10);
    restart();
    await settings().hydrate();
    expect(settings().settings).toEqual({
      defaultIntensity: 'savage',
      defaultBufferMinutes: 15,
      mutedUntil: null,
    });
  });

  it('counts two quick buffer taps, each on top of the last', async () => {
    await settings().hydrate();
    // Both taps are made before the first save resolves.
    const taps = [settings().adjustDefaultBuffer(5), settings().adjustDefaultBuffer(5)];
    expect(settings().settings.defaultBufferMinutes).toBe(5);
    await Promise.all(taps);
    expect(settings().settings.defaultBufferMinutes).toBe(15);
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? '')).toMatchObject({
      defaultBufferMinutes: 15,
    });
  });

  it('applies changes in order and keeps the buffer within the limits', async () => {
    await Promise.all([
      settings().adjustDefaultBuffer(5),
      settings().setDefaultIntensity('mild'),
      settings().adjustDefaultBuffer(200),
    ]);
    expect(settings().settings).toMatchObject({
      defaultIntensity: 'mild',
      defaultBufferMinutes: 120,
    });
    await settings().adjustDefaultBuffer(-500);
    expect(settings().settings.defaultBufferMinutes).toBe(0);
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? '')).toEqual(
      settings().settings,
    );
  });

  it('leaves state unchanged when saving fails', async () => {
    await settings().hydrate();
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(settings().setDefaultIntensity('savage')).rejects.toThrow('disk full');
    expect(settings().settings.defaultIntensity).toBe('spicy');
    await settings().setDefaultIntensity('mild'); // the queue keeps going after a failure
    expect(settings().settings.defaultIntensity).toBe('mild');
  });

  it('never saves over settings it could not read; a change retries the load', async () => {
    const stored = { defaultIntensity: 'savage', defaultBufferMinutes: 30, mutedUntil: null };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));
    storage.setItem.mockClear();
    failSettingsReads();
    await settings().hydrate();
    expect(settings().loadError).toBe(SETTINGS_LOAD_ERROR);
    expect(settings().settings).toEqual(DEFAULT_SETTINGS);

    await expect(settings().setDefaultIntensity('mild')).rejects.toThrow(SETTINGS_LOAD_ERROR);
    await expect(settings().muteToday()).rejects.toThrow(SETTINGS_LOAD_ERROR);
    expect(settingsReads()).toHaveLength(3); // the first load, then one retry per change
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(settings().settings).toEqual(DEFAULT_SETTINGS);

    storage.getItem.mockImplementation(realGetItem);
    await settings().adjustDefaultBuffer(5); // readable again: loads, then saves on top of it
    expect(settings().loadError).toBeNull();
    expect(settings().settings).toEqual({ ...stored, defaultBufferMinutes: 35 });
  });

  it('never lets a load that finishes late overwrite a newer save', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ defaultBufferMinutes: 30 }));
    let release = () => {};
    storage.getItem.mockImplementationOnce(async (key: string) => {
      await new Promise<void>((resolve) => (release = resolve));
      return realGetItem(key);
    });
    const loading = settings().hydrate();
    const saved = settings().setDefaultIntensity('savage'); // made while the load is in flight
    release();
    await Promise.all([loading, saved]);
    await settings().hydrate(); // a later call reuses the finished load, never re-reads over it
    expect(settings().settings).toMatchObject({
      defaultIntensity: 'savage',
      defaultBufferMinutes: 30,
    });
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? '')).toMatchObject({
      defaultIntensity: 'savage',
      defaultBufferMinutes: 30,
    });
  });

  it('mutes until the next local midnight, stored with its offset', async () => {
    await settings().muteToday();
    expect(settings().settings.mutedUntil).toBe('2026-09-26T00:00:00-07:00');
    restart();
    await settings().hydrate();
    expect(settings().settings.mutedUntil).toBe('2026-09-26T00:00:00-07:00');
    await settings().unmute();
    expect(settings().settings.mutedUntil).toBeNull();
  });
});

describe('mute today and notifications', () => {
  it('leaves notifications alone while the stored mute is unreadable', async () => {
    const dinner = await add('Dinner', '2026-09-25T19:00:00-07:00');
    const breakfast = await add('Breakfast', '2026-09-26T08:00:00-07:00');
    await settings().muteToday();
    await notificationsSettled();
    const before = port.keys();
    expect(idsOf(dinner)).toEqual([]);
    expect(idsOf(breakfast)).toHaveLength(6);

    // Restart: appointments load, settings can't be read, so the mute is unknown.
    restart();
    failSettingsReads();
    const calls = { ...port.calls };
    await appointments().hydrate();
    await appointments().syncNotifications();
    expect(settings().loadError).toBe(SETTINGS_LOAD_ERROR);
    expect(port.calls.schedule).toBe(calls.schedule);
    expect(port.calls.cancel).toBe(calls.cancel);
    expect(port.keys()).toEqual(before); // dinner's nags weren't brought back

    storage.getItem.mockImplementation(realGetItem); // readable again: the next sync runs, still muted
    await appointments().syncNotifications();
    await notificationsSettled();
    expect(settings().loadError).toBeNull();
    expect(port.keys()).toEqual(before);
  });

  it('cancels today’s series on mute and re-plans only future steps on unmute', async () => {
    const today = await add('Dentist', '2026-09-25T09:40:00-07:00'); // leave by 9:10
    const tomorrow = await add('Gym', '2026-09-26T10:00:00-07:00');
    await notificationsSettled();
    // Step 2 (9:00) was due on save and fires right away; 3–6 follow.
    expect(idsOf(today)).toEqual([2, 3, 4, 5, 6].map((s) => `series:${today}:${s}`));
    expect(idsOf(tomorrow)).toHaveLength(6);
    now = new Date(NOW.getTime() + MIN);
    port.deliverUntil(now); // step 2 went out

    await settings().muteToday();
    await notificationsSettled();
    expect(idsOf(today)).toEqual([]);
    expect(idsOf(tomorrow)).toHaveLength(6); // after midnight: untouched

    await settings().unmute();
    await notificationsSettled();
    expect(idsOf(today)).toEqual([3, 4, 5, 6].map((s) => `series:${today}:${s}`));
    const earliest = Math.min(...[...port.pending.values()].map((n) => n.at.getTime()));
    expect(earliest).toBeGreaterThan(now.getTime() + FIRE_NOW_LEAD_MS); // no due re-fire
  });

  it('schedules nothing for today while muted, even a new appointment’s due step', async () => {
    await settings().muteToday();
    const soon = await add('Call back', '2026-09-25T09:20:00-07:00');
    const later = await add('Dinner', '2026-09-25T19:00:00-07:00');
    const night = await add('Night bus', '2026-09-26T00:25:00-07:00'); // leave by 23:55
    await notificationsSettled();
    expect(idsOf(soon)).toEqual([]);
    expect(idsOf(later)).toEqual([]);
    // Only the steps from midnight on (00:01 and 00:05) are scheduled.
    expect(idsOf(night)).toEqual([5, 6].map((s) => `series:${night}:${s}`));
  });

  it('keeps holding back today’s nags after a restart', async () => {
    const dinner = await add('Dinner', '2026-09-25T19:00:00-07:00');
    await settings().muteToday();
    await notificationsSettled();
    port.pending.clear();

    restart();
    await appointments().hydrate();
    await notificationsSettled();
    expect(idsOf(dinner)).toEqual([]);
  });

  it('expires at midnight: the next sync plans as usual', async () => {
    await settings().muteToday();
    const breakfast = await add('Breakfast', '2026-09-26T08:00:00-07:00');
    await notificationsSettled();
    expect(idsOf(breakfast)).toHaveLength(6);
    const nextNight = await add('Late show', '2026-09-26T23:00:00-07:00');
    await notificationsSettled();
    expect(idsOf(nextNight)).toHaveLength(6); // tomorrow evening: never muted

    now = new Date('2026-09-26T00:00:00-07:00');
    await appointments().syncNotifications();
    expect(idsOf(breakfast)).toHaveLength(6);
    expect(settings().settings.mutedUntil).toBe('2026-09-26T00:00:00-07:00'); // expired by time
  });
});
