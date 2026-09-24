import { fireEvent, render, screen } from '@testing-library/react-native';

import { resetAppointmentsForTests, useAppointments } from '@/state/appointments';

import { HomeScreen } from './HomeScreen';

beforeEach(() => {
  resetAppointmentsForTests();
});

describe('HomeScreen', () => {
  it('shows the empty state and an idle Nag line with no appointments', async () => {
    useAppointments.setState({ hydrated: true });
    await render(<HomeScreen onAdd={jest.fn()} onOpen={jest.fn()} />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Nothing to nag you about yet.')).toBeTruthy();
    expect(screen.getByText(/Nothing on the clock/)).toBeTruthy();
  });

  it('lists appointments with the leave-by countdown and opens them', async () => {
    const onOpen = jest.fn();
    const onAdd = jest.fn();
    const startsAt = new Date(Date.now() + 90 * 60_000);
    useAppointments.setState({
      hydrated: true,
      appointments: [
        {
          id: 'a1',
          title: 'Dentist',
          startsAt: startsAt.toISOString(),
          travelMinutes: 25,
          bufferMinutes: 5,
          inPerson: true,
          intensity: 'spicy',
          status: 'scheduled',
          notificationIds: [],
          source: 'manual',
        },
      ],
    });
    await render(<HomeScreen onAdd={onAdd} onOpen={onOpen} />);
    expect(screen.getByText('Dentist')).toBeTruthy();
    expect(screen.getByText('In person')).toBeTruthy();
    expect(screen.getByText(/^leave in (59|60) min$/)).toBeTruthy();
    expect(screen.getByText('1 remaining')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /^Dentist, In person, Leave by \d+:\d\d, leave in (59|60) min, starts \d+:\d\d [AP]M$/,
      }),
    ).toBeTruthy();
    expect(screen.queryByText('Nothing to nag you about yet.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /^Dentist,/ }));
    expect(onOpen).toHaveBeenCalledWith('a1');
    await fireEvent.press(screen.getByRole('button', { name: 'Add appointment' }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('shows a non-blocking message when stored appointments could not be loaded', async () => {
    useAppointments.setState({ hydrated: true, loadError: 'Couldn’t load saved appointments.' });
    await render(<HomeScreen onAdd={jest.fn()} onOpen={jest.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn’t load saved appointments/);
    expect(screen.getByRole('button', { name: 'Add appointment' })).toBeTruthy();
  });
});
