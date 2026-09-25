import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Appointment } from '@/types';

import {
  STORAGE_KEY,
  loadAppointments,
  parseAppointments,
  saveAppointments,
} from './appointmentStore';

const valid: Appointment = {
  id: 'a1',
  title: 'Dentist',
  startsAt: '2026-09-25T15:00:00-07:00',
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'spicy',
  status: 'scheduled',
  notificationIds: [],
  source: 'manual',
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('appointmentStore', () => {
  it('returns an empty list when nothing is stored', async () => {
    expect(await loadAppointments()).toEqual([]);
  });

  it('round-trips a saved list under appointments.v1', async () => {
    await saveAppointments([valid, { ...valid, id: 'a2', inPerson: false }]);
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '')).toHaveLength(2);
    expect(await loadAppointments()).toEqual([valid, { ...valid, id: 'a2', inPerson: false }]);
  });

  it('keeps valid entries and drops corrupt ones', async () => {
    const corrupt = [
      valid,
      { ...valid, id: 'bad-date', startsAt: '2026-02-30T09:00:00Z' },
      { ...valid, id: 'no-offset', startsAt: '2026-09-25T15:00:00' },
      { ...valid, id: 'neg', travelMinutes: -5 },
      { ...valid, id: 'intensity', intensity: 'nuclear' },
      { ...valid, id: 'blank-title', title: '   ' },
      { ...valid, id: 'far', travelMinutes: 601 },
      { ...valid, id: 'slack', bufferMinutes: 121 },
      { ...valid, id: 'a1', title: 'duplicate id' },
      { title: 'missing id' },
      null,
      'string',
      { ...valid, id: 'a3' },
    ];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(corrupt));
    expect((await loadAppointments()).map((a) => a.id)).toEqual(['a1', 'a3']);
  });

  it('trims titles and accepts the domain limits', () => {
    const raw = JSON.stringify([
      { ...valid, title: '  Dentist  ', travelMinutes: 600, bufferMinutes: 120 },
    ]);
    expect(parseAppointments(raw)).toEqual([
      { ...valid, title: 'Dentist', travelMinutes: 600, bufferMinutes: 120 },
    ]);
  });

  it('keeps the first entry when an id repeats', () => {
    const raw = JSON.stringify([valid, { ...valid, title: 'Second' }, { ...valid, id: 'a2' }]);
    expect(parseAppointments(raw).map((a) => [a.id, a.title])).toEqual([
      ['a1', 'Dentist'],
      ['a2', 'Dentist'],
    ]);
  });

  it.each(['not json{', '{"id":"a1"}', '42', 'null'])(
    'returns an empty list for unusable storage %p',
    (raw) => {
      expect(parseAppointments(raw)).toEqual([]);
    },
  );
});
