import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  notificationsSettled,
  resetAppointmentsForTests,
  useAppointments,
} from '@/state/appointments';
import { createFakeNotifications } from '@/state/testing';
import type { Appointment } from '@/types';

import { AlarmScreen, countdown, progressLabel, SAVE_FAILED } from './AlarmScreen';

// Fixed time (Jest runs in America/Los_Angeles). Never the real clock.
// Starts 15:00, leave by 14:30; at 14:37 step 5 (14:36, savage at spicy) has fired.
const NOW = new Date('2026-09-25T14:37:00-07:00');

const appt = (over: Partial<Appointment> = {}): Appointment => ({
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
  ...over,
});

const renderWith = async (appointments: Appointment[], hydrated = true) => {
  resetAppointmentsForTests(() => NOW, createFakeNotifications());
  await AsyncStorage.setItem('appointments.v1', JSON.stringify(appointments));
  useAppointments.setState({ hydrated, appointments });
  if (hydrated) await useAppointments.getState().hydrate();
  const onBack = jest.fn();
  await render(<AlarmScreen id="a1" onBack={onBack} />);
  return { onBack };
};

beforeEach(() => AsyncStorage.clear());
afterEach(() => notificationsSettled());

describe('AlarmScreen', () => {
  it('shows the takeover: title, countdown, current line, step and both buttons', async () => {
    await renderWith([appt()]);
    expect(screen.getByText('Dentist · 3:00 PM')).toBeTruthy();
    expect(screen.getByText('+7 min')).toBeTruthy();
    expect(screen.getByText('past your leave-by time')).toBeTruthy();
    expect(screen.getByText(/7 min late\.$/)).toBeTruthy();
    expect(screen.queryByText(/^“/)).toBeNull(); // no added quotes
    expect(screen.getByText('Step 5 of 6 · Escalation: Savage')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'I’ve left' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'I’m genuinely stuck' })).toBeTruthy();
  });

  it('"I’m genuinely stuck" shows the supportive state and hides that button', async () => {
    await renderWith([appt()]);
    await fireEvent.press(screen.getByRole('button', { name: 'I’m genuinely stuck' }));
    // Stuck at 14:37: only step 6 (14:40) is left, so one supportive nag; its line has no lateness.
    await waitFor(() => expect(screen.getByText('Supportive · 1 of 1')).toBeTruthy());
    expect(screen.getByText(/starts at 3:00\.$/i)).toBeTruthy();
    expect(screen.queryByText(/min late/)).toBeNull();
    expect(useAppointments.getState().byId('a1')?.status).toBe('stuck');
    expect(screen.queryByRole('button', { name: 'I’m genuinely stuck' })).toBeNull();
    expect(screen.getByRole('button', { name: 'I’ve left' })).toBeTruthy();
  });

  it('"I’ve left" confirms calmly, and Back leaves', async () => {
    const { onBack } = await renderWith([appt({ status: 'stuck' })]);
    await fireEvent.press(screen.getByRole('button', { name: 'I’ve left' }));
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('Left ✓'));
    expect(useAppointments.getState().byId('a1')?.status).toBe('left');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('has an accessible Back control while the alarm is active', async () => {
    const { onBack } = await renderWith([appt()]);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('says so when saving fails, and keeps the buttons', async () => {
    await renderWith([appt()]);
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    await fireEvent.press(screen.getByRole('button', { name: 'I’ve left' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(SAVE_FAILED));
    expect(screen.getByRole('button', { name: 'I’ve left' })).toBeTruthy();
    expect(useAppointments.getState().byId('a1')?.status).toBe('scheduled');
  });

  it('is calm when the series is over', async () => {
    await renderWith([appt({ startsAt: '2026-09-25T14:00:00-07:00' })]);
    expect(screen.getByRole('heading')).toHaveTextContent('Nothing to nag about');
  });

  it('handles a missing appointment', async () => {
    const { onBack } = await renderWith([]);
    expect(screen.getByText('That appointment is gone.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('countdown', () => {
  it('reads late, early and on time', () => {
    expect(countdown(6)).toEqual({ value: '+6 min', caption: 'past your leave-by time' });
    expect(countdown(-12)).toEqual({ value: '12 min', caption: 'until your leave-by time' });
    expect(countdown(0)).toEqual({ value: 'Now', caption: 'is your leave-by time' });
  });
});

describe('progressLabel', () => {
  const view = (phase: 'active' | 'stuck', progress: { current: number; total: number } | null) =>
    ({ phase, tone: 'savage', progress, line: 'x', minutesPastLeaveBy: 0 }) as const;
  it('labels the ladder and the short supportive series', () => {
    expect(progressLabel(view('active', { current: 5, total: 6 }), 'Savage')).toBe(
      'Step 5 of 6 · Escalation: Savage',
    );
    expect(progressLabel(view('stuck', { current: 1, total: 2 }), 'Supportive')).toBe(
      'Supportive · 1 of 2',
    );
    expect(progressLabel(view('stuck', null), 'Supportive')).toBe('Supportive');
  });
});
