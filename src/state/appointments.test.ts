import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppointmentDraft } from '@/domain/appointment';
import { STORAGE_KEY } from '@/services/appointmentStore';

import { LOAD_ERROR, resetAppointmentsForTests, toFields, useAppointments } from './appointments';

// Fixed clocks at the day edges (Jest runs in America/Los_Angeles). Never the real clock.
const LATE_EVENING = new Date('2026-09-25T23:15:00-07:00');
const AFTER_MIDNIGHT = new Date('2026-09-26T00:10:00-07:00');

const draft: AppointmentDraft = {
  title: ' Dentist ',
  startsAt: new Date('2026-09-26T15:00:00-07:00'),
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'spicy',
};

const stored = async () => JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]');

const storedAppt = (id: string, startsAt: Date) => ({
  ...toFields({ ...draft, startsAt }),
  id,
  status: 'scheduled',
  notificationIds: [],
  source: 'manual',
});

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  resetAppointmentsForTests(() => LATE_EVENING);
});

describe('toFields', () => {
  it('turns the picker Date into an ISO string with offset for the same instant', () => {
    const local = new Date(2026, 8, 25, 15, 0);
    const { startsAt } = toFields({ ...draft, startsAt: local });
    expect(startsAt).toBe('2026-09-25T15:00:00-07:00');
    expect(Date.parse(startsAt)).toBe(local.getTime());
  });

  // Jest runs in America/Los_Angeles; DST ends on 2026-11-01.
  it.each([
    [new Date(2026, 9, 31, 9, 0), '2026-10-31T09:00:00-07:00'],
    [new Date(2026, 10, 1, 0, 30), '2026-11-01T00:30:00-07:00'],
    [new Date(2026, 10, 1, 3, 0), '2026-11-01T03:00:00-08:00'],
    [new Date(2026, 10, 2, 9, 0), '2026-11-02T09:00:00-08:00'],
  ])('keeps the local offset either side of the DST change (%s)', (startsAt, expected) => {
    expect(toFields({ ...draft, startsAt }).startsAt).toBe(expected);
  });
});

describe('useAppointments', () => {
  it('adds, updates and removes, persisting every change', async () => {
    const store = useAppointments.getState();
    await store.hydrate();

    const id = await store.add(draft);
    expect(useAppointments.getState().byId(id)).toMatchObject({
      title: 'Dentist',
      status: 'scheduled',
    });
    expect(await stored()).toHaveLength(1);

    await store.update(id, { ...draft, title: 'Gym', inPerson: false, intensity: 'savage' });
    expect(useAppointments.getState().byId(id)).toMatchObject({
      id,
      title: 'Gym',
      inPerson: false,
      intensity: 'savage',
    });
    expect((await stored())[0]).toMatchObject({ id, title: 'Gym', intensity: 'savage' });

    await store.remove(id);
    expect(useAppointments.getState().appointments).toEqual([]);
    expect(await stored()).toEqual([]);
  });

  it('reloads persisted appointments after a restart', async () => {
    const id = await useAppointments.getState().add(draft);
    resetAppointmentsForTests(() => LATE_EVENING);
    expect(useAppointments.getState().byId(id)).toBeUndefined();

    await useAppointments.getState().hydrate();
    expect(useAppointments.getState().hydrated).toBe(true);
    expect(useAppointments.getState().byId(id)?.title).toBe('Dentist');
  });

  it('waits for hydration before a mutation so stored data is not overwritten', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([storedAppt('old', draft.startsAt)]));
    await useAppointments.getState().add({ ...draft, title: 'New' });
    expect((await stored()).map((a: { id: string }) => a.id)).toEqual(
      expect.arrayContaining(['old']),
    );
    expect(await stored()).toHaveLength(2);
  });

  it.each([
    {
      name: 'late evening (23:15)',
      now: LATE_EVENING,
      stored: [
        ['yesterday-late', '2026-09-24T23:59:00-07:00'],
        ['this-morning', '2026-09-25T00:00:00-07:00'],
        ['tonight', '2026-09-25T23:50:00-07:00'],
        ['after-midnight', '2026-09-26T00:30:00-07:00'],
      ],
      kept: ['this-morning', 'tonight', 'after-midnight'],
    },
    {
      name: 'just after midnight (00:10)',
      now: AFTER_MIDNIGHT,
      stored: [
        ['last-night', '2026-09-25T23:50:00-07:00'],
        ['just-now', '2026-09-26T00:05:00-07:00'],
        ['later', '2026-09-26T09:00:00-07:00'],
      ],
      kept: ['just-now', 'later'],
    },
  ])('prunes before local midnight on load and saves the result at $name', async (c) => {
    resetAppointmentsForTests(() => c.now);
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(c.stored.map(([id, at]) => storedAppt(id, new Date(at)))),
    );
    await useAppointments.getState().hydrate();
    expect(useAppointments.getState().appointments.map((a) => a.id)).toEqual(c.kept);
    expect((await stored()).map((a: { id: string }) => a.id)).toEqual(c.kept);
  });

  it('reports a load failure, refuses to overwrite storage, and retries later', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    await useAppointments.getState().hydrate();
    expect(useAppointments.getState()).toMatchObject({ hydrated: true, loadError: LOAD_ERROR });

    // getItem rejects again on the retry inside add → add fails without saving.
    getItem.mockRejectedValueOnce(new Error('disk'));
    await expect(useAppointments.getState().add(draft)).rejects.toThrow(LOAD_ERROR);
    expect(setItem).not.toHaveBeenCalled();

    // Storage is readable again → the next mutation loads first, then saves.
    await useAppointments.getState().add(draft);
    expect(useAppointments.getState().loadError).toBeNull();
    expect(await stored()).toHaveLength(1);
  });

  it('leaves state unchanged when saving fails', async () => {
    await useAppointments.getState().hydrate();
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('quota'));
    await expect(useAppointments.getState().add(draft)).rejects.toThrow('quota');
    expect(useAppointments.getState().appointments).toEqual([]);
    expect(await stored()).toEqual([]);
  });
});
