import type { Appointment } from '@/types';

import { alarmUnderway, alarmView } from './alarm';
import { hasAlarm } from './appointment';
import { BANK } from './lines/bank';

// startsAt 15:00Z, travel 25 + buffer 5 → leaveBy 14:30Z; steps at 14:00, 14:20, 14:30, 14:33, 14:36, 14:40.
const appt = (over: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  title: 'Dentist',
  startsAt: '2026-09-24T15:00:00Z',
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'spicy',
  status: 'scheduled',
  notificationIds: [],
  source: 'manual',
  ...over,
});
const at = (hhmm: string) => new Date(`2026-09-24T${hhmm}:00Z`);

describe('alarmUnderway', () => {
  it('is false before step 1 and true from step 1 while steps are left', () => {
    expect(alarmUnderway(appt(), at('13:59'))).toBe(false);
    expect(alarmUnderway(appt(), at('14:00'))).toBe(true);
    expect(alarmUnderway(appt(), at('14:36'))).toBe(true);
  });

  it('is false once the series is over', () => {
    expect(alarmUnderway(appt(), at('15:01'))).toBe(false);
  });

  it('includes stuck, not left or done, and only in-person events', () => {
    expect(alarmUnderway(appt({ status: 'stuck' }), at('14:36'))).toBe(true);
    expect(alarmUnderway(appt({ status: 'left' }), at('14:36'))).toBe(false);
    expect(alarmUnderway(appt({ status: 'done' }), at('14:36'))).toBe(false);
    expect(alarmUnderway(appt({ inPerson: false }), at('14:36'))).toBe(false);
  });
});

describe('hasAlarm', () => {
  it('is true only for in-person events', () => {
    expect(hasAlarm(appt())).toBe(true);
    expect(hasAlarm(appt({ inPerson: false }))).toBe(false);
  });
});

describe('alarmView', () => {
  it('is over for an event that is not in person, whatever its status', () => {
    for (const status of ['scheduled', 'stuck', 'left'] as const) {
      expect(alarmView(appt({ inPerson: false, status }), at('14:37'))).toMatchObject({
        phase: 'over',
        tone: 'done',
        line: null,
      });
    }
  });

  it('shows the current step, its tone and its line with a live cue', () => {
    const view = alarmView(appt(), at('14:37'));
    // Step 5 (14:36) is pulled to now: savage at spicy.
    expect(view).toMatchObject({ phase: 'active', tone: 'savage', step: 5, minutesPastLeaveBy: 7 });
    expect(view.line).toMatch(/7 min late\.$/);
    const templates = BANK.savage.spicy.map((t) => t.replace('{cue}', ''));
    expect(templates).toContain(view.line?.replace(/7 min late\.$/, '.'));
  });

  it('counts down before leaveBy', () => {
    expect(alarmView(appt(), at('14:25'))).toMatchObject({ step: 2, minutesPastLeaveBy: -5 });
    expect(alarmView(appt(), at('14:30')).minutesPastLeaveBy).toBe(0);
    expect(Object.is(alarmView(appt(), at('14:30')).minutesPastLeaveBy, 0)).toBe(true);
  });

  it('is supportive once stuck, with a supportive line', () => {
    const view = alarmView(appt({ status: 'stuck' }), at('14:37'));
    expect(view).toMatchObject({ phase: 'stuck', tone: 'supportive', step: 5 });
    const templates = BANK.supportive.spicy.map((t) => t.replace('{cue}', ''));
    expect(templates).toContain(view.line?.replace(/7 min late\.$/, '.'));
  });

  it('confirms left, and is over when nothing is left', () => {
    expect(alarmView(appt({ status: 'left' }), at('14:37'))).toMatchObject({
      phase: 'left',
      tone: 'done',
      step: null,
      line: null,
    });
    expect(alarmView(appt(), at('15:30'))).toMatchObject({ phase: 'over', tone: 'done' });
    expect(alarmView(appt({ status: 'done' }), at('14:37')).phase).toBe('over');
  });
});
