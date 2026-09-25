import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';

import { resetAppointmentsForTests } from '@/state/appointments';
import { resetSettingsForTests } from '@/state/settings';
import { createFakeNotifications } from '@/state/testing';

import { NewAppointmentScreen } from './NewAppointmentScreen';

// Fixed time (Jest runs in America/Los_Angeles). Never the real clock.
const NOW = new Date('2026-09-25T09:00:00-07:00');
const getItem = AsyncStorage.getItem as jest.Mock;
const realGetItem = getItem.getMockImplementation()!;

beforeEach(async () => {
  getItem.mockReset().mockImplementation(realGetItem);
  await AsyncStorage.clear();
  resetSettingsForTests(() => NOW);
  resetAppointmentsForTests(() => NOW, createFakeNotifications());
});

describe('NewAppointmentScreen (the /appointment/new route)', () => {
  it('opens with the stored defaults (Savage, 15 min)', async () => {
    await AsyncStorage.setItem(
      'settings.v1',
      JSON.stringify({ defaultIntensity: 'savage', defaultBufferMinutes: 15, mutedUntil: null }),
    );
    await render(<NewAppointmentScreen onClose={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'New appointment' })).toBeTruthy(),
    );
    expect(
      screen.getByRole('radio', { name: 'Savage: Rude brutality', checked: true }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Buffer before arrival: 15 min')).toBeTruthy();
    expect(screen.getByLabelText('Travel time: 20 min')).toBeTruthy();
  });

  it('shows a blank screen until the settings have loaded', async () => {
    let release = () => {};
    getItem.mockImplementationOnce(async (key: string) => {
      await new Promise<void>((resolve) => (release = resolve));
      return realGetItem(key);
    });
    await render(<NewAppointmentScreen onClose={jest.fn()} />);
    expect(screen.getByTestId('new-appointment-loading')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'New appointment' })).toBeNull();
    await act(async () => release());
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'New appointment' })).toBeTruthy(),
    );
    expect(
      screen.getByRole('radio', { name: 'Spicy: Sarcastic bite', checked: true }),
    ).toBeTruthy();
  });
});
