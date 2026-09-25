import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  notificationsSettled,
  resetAppointmentsForTests,
  useAppointments,
} from '@/state/appointments';
import { resetSettingsForTests, useSettings } from '@/state/settings';
import { createFakeNotifications } from '@/state/testing';
import type { Appointment } from '@/types';

import { HomeScreen, MUTED, MUTED_LINE } from './HomeScreen';

// Fixed clocks (Jest runs in America/Los_Angeles). Never the real clock.
const NOW = new Date('2026-09-25T09:00:00-07:00');
const AFTER_MIDNIGHT = new Date('2026-09-26T00:10:00-07:00');

const appt = (id: string, startsAt: string): Appointment => ({
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
});
// Leave by 9:10: step 2 is due now (9:00). Gym leaves by 9:00 tomorrow: step 1 at 8:30.
const dentist = appt('Dentist', '2026-09-25T09:40:00-07:00');
const gym = appt('Gym', '2026-09-26T09:30:00-07:00');

/** Stored appointments and settings, loaded the way the app loads them. */
const renderHome = async (now: Date, appointments: Appointment[], mutedUntil: string | null) => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('appointments.v1', JSON.stringify(appointments));
  await AsyncStorage.setItem('settings.v1', JSON.stringify({ mutedUntil }));
  resetSettingsForTests(() => now);
  resetAppointmentsForTests(() => now, createFakeNotifications());
  await act(() => useAppointments.getState().hydrate());
  await render(<HomeScreen onAdd={jest.fn()} onOpen={jest.fn()} onAlarm={jest.fn()} />);
  await act(() => notificationsSettled()); // the first sync also loads the settings
};
const TONIGHT = '2026-09-26T00:00:00-07:00';

afterEach(() => notificationsSettled());

describe('Home while muted', () => {
  it('shows the banner and a calm line instead of today’s nag', async () => {
    await renderHome(NOW, [dentist], TONIGHT);
    expect(screen.getByText(MUTED)).toBeTruthy();
    expect(screen.getByText(MUTED_LINE)).toBeTruthy();
  });

  it('shows the next nag that will really be delivered (after midnight)', async () => {
    await renderHome(NOW, [dentist, gym], TONIGHT);
    expect(screen.queryByText(MUTED_LINE)).toBeNull();
    expect(screen.getByText('at 8:30 AM')).toBeTruthy(); // Gym's step 1, tomorrow (leave by 9:00)
  });

  it('Unmute clears the banner and brings today’s nag back', async () => {
    await renderHome(NOW, [dentist], TONIGHT);
    await fireEvent.press(screen.getByRole('button', { name: 'Unmute' }));
    await waitFor(() => expect(screen.queryByText(MUTED)).toBeNull());
    expect(useSettings.getState().settings.mutedUntil).toBeNull();
    expect(screen.queryByText(MUTED_LINE)).toBeNull();
    expect(screen.getByText(/Firm tone/i)).toBeTruthy();
  });

  it('shows no banner once the mute has expired', async () => {
    await renderHome(AFTER_MIDNIGHT, [], TONIGHT);
    expect(screen.queryByText(MUTED)).toBeNull();
    expect(screen.queryByText(MUTED_LINE)).toBeNull();
  });
});
