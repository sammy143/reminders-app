import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { resetAppointmentsForTests, useAppointments } from '@/state/appointments';
import type { Appointment } from '@/types';

import { HomeScreen } from './HomeScreen';

// Fixed clocks at the day edges (Jest runs in America/Los_Angeles). Never the real clock.
const LATE_EVENING = new Date('2026-09-25T23:15:00-07:00');
const AFTER_MIDNIGHT = new Date('2026-09-26T00:10:00-07:00');

const appt = (id: string, title: string, startsAt: string): Appointment => ({
  id,
  title,
  startsAt,
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'spicy',
  status: 'scheduled',
  notificationIds: [],
  source: 'manual',
});

const renderAt = async (
  now: Date,
  appointments: Appointment[] = [],
  loadError: string | null = null,
) => {
  resetAppointmentsForTests(() => now);
  useAppointments.setState({ hydrated: true, appointments, loadError });
  const onAdd = jest.fn();
  const onOpen = jest.fn();
  await render(<HomeScreen onAdd={onAdd} onOpen={onOpen} />);
  return { onAdd, onOpen };
};

describe('HomeScreen', () => {
  it('shows the empty state and an idle Nag line with no appointments', async () => {
    await renderAt(LATE_EVENING);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Fri, Sep 25')).toBeTruthy();
    expect(screen.getByText('Nothing to nag you about yet.')).toBeTruthy();
    expect(screen.getByText(/Nothing on the clock/)).toBeTruthy();
  });

  it.each([
    {
      name: 'late evening (23:15)',
      now: LATE_EVENING,
      past: '2026-09-25T20:00:00-07:00',
      soon: '2026-09-25T23:50:00-07:00', // leave by 23:20
      next: '2026-09-26T00:45:00-07:00', // after midnight → Tomorrow
      today: 'Fri, Sep 25',
      tomorrow: 'Sat, Sep 26',
      label: 'Dentist, In person, Leave by 11:20, leave in 5 min, starts 11:50 PM',
    },
    {
      name: 'just after midnight (00:10)',
      now: AFTER_MIDNIGHT,
      past: '2026-09-26T00:05:00-07:00',
      soon: '2026-09-26T00:45:00-07:00', // leave by 00:15
      next: '2026-09-27T00:30:00-07:00',
      today: 'Sat, Sep 26',
      tomorrow: 'Sun, Sep 27',
      label: 'Dentist, In person, Leave by 12:15, leave in 5 min, starts 12:45 AM',
    },
  ])('groups by local day and counts remaining at $name', async (c) => {
    await renderAt(c.now, [
      appt('next', 'Gym', c.next),
      appt('soon', 'Dentist', c.soon),
      appt('past', 'Breakfast', c.past),
      appt('yesterday', 'Old', '2026-09-24T12:00:00-07:00'),
    ]);
    expect(screen.getByText(c.today)).toBeTruthy(); // header date pill
    expect(screen.getByText('Schedule')).toBeTruthy();
    expect(screen.getByText('1 remaining')).toBeTruthy();
    expect(screen.getByText('Tomorrow')).toBeTruthy();
    expect(screen.getByText(c.tomorrow)).toBeTruthy();
    expect(screen.queryByText('Old')).toBeNull();

    const titles = screen.getAllByText(/^(Breakfast|Dentist|Gym)$/).map((t) => t.props.children);
    expect(titles).toEqual(['Breakfast', 'Dentist', 'Gym']);

    const dentist = screen.getByRole('button', { name: c.label });
    expect(within(dentist).getByText('leave in 5 min')).toBeTruthy();
  });

  it('opens a card and adds', async () => {
    const { onAdd, onOpen } = await renderAt(AFTER_MIDNIGHT, [
      appt('a1', 'Dentist', '2026-09-26T09:00:00-07:00'),
    ]);
    await fireEvent.press(screen.getByRole('button', { name: /^Dentist,/ }));
    expect(onOpen).toHaveBeenCalledWith('a1');
    await fireEvent.press(screen.getByRole('button', { name: 'Add appointment' }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('shows a non-blocking message when stored appointments could not be loaded', async () => {
    await renderAt(LATE_EVENING, [], 'Couldn’t load saved appointments.');
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn’t load saved appointments/);
    expect(screen.getByRole('button', { name: 'Add appointment' })).toBeTruthy();
  });
});
