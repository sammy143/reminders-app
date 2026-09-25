import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { AppointmentDraft } from '@/domain/appointment';

import { AppointmentForm } from './AppointmentForm';

const initial: AppointmentDraft = {
  title: '',
  startsAt: new Date(2026, 8, 25, 15, 0),
  travelMinutes: 20,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'spicy',
};

const renderForm = async (props: Partial<Parameters<typeof AppointmentForm>[0]> = {}) => {
  const onSubmit = jest.fn(async (_draft: AppointmentDraft) => {});
  const onCancel = jest.fn();
  await render(
    <AppointmentForm
      heading="New appointment"
      initial={initial}
      previewId="preview"
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSubmit, onCancel };
};

describe('AppointmentForm', () => {
  it('blocks submit and shows an error when the title is blank', async () => {
    const { onSubmit } = await renderForm();
    await fireEvent.press(screen.getByText('Save appointment →'));
    expect(screen.getByText('Give it a title.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Dentist');
    expect(screen.queryByText('Give it a title.')).toBeNull();
  });

  it('submits every edited field', async () => {
    const { onSubmit } = await renderForm();
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Dentist');
    await fireEvent.press(screen.getByLabelText('Increase travel time'));
    await fireEvent.press(screen.getByLabelText('Decrease buffer before arrival'));
    expect(
      screen.getByRole('radio', { name: 'Spicy: Sarcastic bite', checked: true }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Savage: Rude brutality'));
    expect(
      screen.getByRole('radio', { name: 'Savage: Rude brutality', checked: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Spicy: Sarcastic bite', checked: false }),
    ).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'In person', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch', { name: 'In person' }));
    expect(screen.getByRole('switch', { name: 'In person', checked: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({
      ...initial,
      title: 'Dentist',
      travelMinutes: 25,
      bufferMinutes: 0,
      intensity: 'savage',
      inPerson: false,
    });
  });

  it('shows the computed leave-by time and a real bank preview line', async () => {
    await renderForm();
    // 15:00 − 20 − 5
    expect(screen.getByText('2:35 PM')).toBeTruthy();
    // Spicy tops out at savage tone on step 6, "10 min late".
    expect(screen.getByText(/spicy preview/i)).toBeTruthy();
    expect(screen.getByText(/10 min late/i)).toBeTruthy();
    expect(screen.queryByText(/teeth/)).toBeNull();
  });

  it('clamps steppers at their limits', async () => {
    await renderForm({ initial: { ...initial, bufferMinutes: 0 } });
    await fireEvent.press(screen.getByLabelText('Decrease buffer before arrival'));
    expect(screen.getByText('0 min')).toBeTruthy();
  });

  it('cancels', async () => {
    const { onCancel } = await renderForm();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('deletes only after a second tap', async () => {
    const onDelete = jest.fn(async () => {});
    await renderForm({ onDelete });
    await fireEvent.press(screen.getByText('Delete appointment'));
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Tap again to delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('submits once when Save is pressed twice, and disables both Save buttons meanwhile', async () => {
    let finish!: () => void;
    const onSubmit = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    await renderForm({ onSubmit, initial: { ...initial, title: 'Dentist' } });
    const save = screen.getByRole('button', { name: 'Save appointment' });
    await fireEvent.press(save);
    await fireEvent.press(save);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save appointment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await act(async () => finish());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save appointment' })).toBeEnabled(),
    );
  });

  it('shows a message and stays open when saving fails', async () => {
    const onSubmit = jest.fn(async () => {
      throw new Error('disk full');
    });
    await renderForm({ onSubmit, initial: { ...initial, title: 'Dentist' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Save appointment' }));
    expect(await screen.findByText('Couldn’t save. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save appointment' })).toBeEnabled();
  });
});
