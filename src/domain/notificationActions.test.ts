import { toAppointmentAction } from './notificationActions';
import { NOTIFICATION_CATEGORIES } from './notificationCategories';

describe('toAppointmentAction', () => {
  it.each(['left', 'stuck', 'open'] as const)('reads %s on a series notification', (action) => {
    expect(toAppointmentAction({ notificationId: 'series:3f2a-9:4', actionId: action })).toEqual({
      action,
      appointmentId: '3f2a-9',
    });
  });

  it('ignores identifiers outside the series namespace', () => {
    expect(toAppointmentAction({ notificationId: 'snooze:a:1', actionId: 'left' })).toBeNull();
    expect(toAppointmentAction({ notificationId: 'someone-else', actionId: 'open' })).toBeNull();
  });

  it('ignores unknown action ids', () => {
    expect(toAppointmentAction({ notificationId: 'series:a:1', actionId: 'snooze' })).toBeNull();
    expect(
      toAppointmentAction({
        notificationId: 'series:a:1',
        actionId: 'expo.modules.notifications.actions.DEFAULT',
      }),
    ).toBeNull();
  });
});

describe('NOTIFICATION_CATEGORIES', () => {
  it("offers both buttons on the ladder and only I've left once stuck", () => {
    expect(NOTIFICATION_CATEGORIES.map((c) => [c.id, c.actions.map((a) => a.id)])).toEqual([
      ['nagSeries', ['left', 'stuck']],
      ['nagSupportive', ['left']],
    ]);
  });

  it('uses ids expo-notifications accepts (no ":" or "-")', () => {
    for (const c of NOTIFICATION_CATEGORIES) expect(c.id).not.toMatch(/[:-]/);
  });
});
