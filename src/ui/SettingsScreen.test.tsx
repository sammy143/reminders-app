import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { notificationsSettled, resetAppointmentsForTests } from '@/state/appointments';
import { SETTINGS_LOAD_ERROR, resetSettingsForTests, useSettings } from '@/state/settings';
import { createFakeNotifications } from '@/state/testing';

import { MUTE_OFF_HINT, MUTE_ON_HINT, SAVE_ERROR, SettingsScreen } from './SettingsScreen';

// Fixed clocks (Jest runs in America/Los_Angeles). Never the real clock.
const NOW = new Date('2026-09-25T09:00:00-07:00');

const setup = async (now: Date = NOW) => {
  await AsyncStorage.clear();
  resetSettingsForTests(() => now);
  resetAppointmentsForTests(() => now, createFakeNotifications());
  await act(() => useSettings.getState().hydrate());
};
const settings = () => useSettings.getState().settings;

// The AsyncStorage mock's functions are jest.fn()s; restore the real ones for every test.
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const realGetItem = getItem.getMockImplementation()!;
const realSetItem = setItem.getMockImplementation()!;

beforeEach(() => {
  jest.restoreAllMocks();
  getItem.mockReset().mockImplementation(realGetItem);
  setItem.mockReset().mockImplementation(realSetItem);
});
afterEach(() => notificationsSettled());

describe('SettingsScreen', () => {
  it('shows the defaults and only the in-scope rows', async () => {
    await setup();
    await render(<SettingsScreen />);
    expect(
      screen.getByRole('radio', { name: 'Spicy: Sarcastic bite', checked: true }),
    ).toBeTruthy();
    expect(screen.getByText('Current: Spicy')).toBeTruthy();
    expect(screen.getByLabelText('Default buffer: 5 min')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Mute Nag for today', checked: false })).toBeTruthy();
    expect(screen.getByText(MUTE_OFF_HINT)).toBeTruthy();
    for (const outOfScope of [
      /Supportive mode/,
      /calendar/,
      /home location/,
      /Emergency/,
      /v1\./,
    ]) {
      expect(screen.queryByText(outOfScope)).toBeNull();
    }
  });

  it('saves the default meanness and buffer', async () => {
    await setup();
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText('Savage: Rude brutality'));
    await waitFor(() => expect(settings().defaultIntensity).toBe('savage'));
    expect(screen.getByText('Current: Savage')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Increase default buffer'));
    await waitFor(() => expect(screen.getByLabelText('Default buffer: 10 min')).toBeTruthy());
    expect(JSON.parse((await AsyncStorage.getItem('settings.v1')) ?? '')).toMatchObject({
      defaultIntensity: 'savage',
      defaultBufferMinutes: 10,
    });
  });

  it('mutes until midnight and unmutes', async () => {
    await setup();
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Mute Nag for today' }));
    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: 'Mute Nag for today', checked: true }),
      ).toBeTruthy(),
    );
    expect(settings().mutedUntil).toBe('2026-09-26T00:00:00-07:00');
    expect(screen.getByText(MUTE_ON_HINT)).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch', { name: 'Mute Nag for today' }));
    await waitFor(() => expect(settings().mutedUntil).toBeNull());
  });

  it('says so when a change could not be saved, and keeps the old value', async () => {
    await setup();
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText('Mild: Polite nudge'));
    await waitFor(() => expect(screen.getByText(SAVE_ERROR)).toBeTruthy());
    expect(
      screen.getByRole('radio', { name: 'Spicy: Sarcastic bite', checked: true }),
    ).toBeTruthy();
  });

  it('counts two quick buffer taps', async () => {
    await setup();
    await render(<SettingsScreen />);
    const plus = screen.getByLabelText('Increase default buffer');
    await fireEvent.press(plus);
    await fireEvent.press(plus);
    await waitFor(() => expect(settings().defaultBufferMinutes).toBe(15));
    expect(screen.getByLabelText('Default buffer: 15 min')).toBeTruthy();
  });

  it('says it could not load the settings and saves nothing over them', async () => {
    await AsyncStorage.setItem('settings.v1', JSON.stringify({ defaultIntensity: 'savage' }));
    setItem.mockClear();
    getItem.mockImplementation((key: string) =>
      key === 'settings.v1' ? Promise.reject(new Error('locked')) : realGetItem(key),
    );
    resetSettingsForTests(() => NOW);
    await act(() => useSettings.getState().hydrate());
    await render(<SettingsScreen />);
    expect(screen.getByText(SETTINGS_LOAD_ERROR)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Mild: Polite nudge'));
    await fireEvent.press(screen.getByRole('switch', { name: 'Mute Nag for today' }));
    await waitFor(() => expect(getItem).toHaveBeenCalledTimes(3));
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.queryByText(SAVE_ERROR)).toBeNull();
    expect(
      screen.getByRole('radio', { name: 'Spicy: Sarcastic bite', checked: true }),
    ).toBeTruthy();
  });
});
