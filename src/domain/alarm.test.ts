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
    expect(view).toMatchObject({
      phase: 'active',
      tone: 'savage',
      progress: { current: 5, total: 6 },
      minutesPastLeaveBy: 7,
    });
    expect(view.line).toMatch(/7 min late\.$/);
    const templates = BANK.savage.spicy.map((t) => t.replace('{cue}', ''));
    expect(templates).toContain(view.line?.replace(/7 min late\.$/, '.'));
  });

  it('counts down before leaveBy', () => {
    expect(alarmView(appt(), at('14:25'))).toMatchObject({
      progress: { current: 2, total: 6 },
      minutesPastLeaveBy: -5,
    });
    expect(alarmView(appt(), at('14:30')).minutesPastLeaveBy).toBe(0);
    expect(Object.is(alarmView(appt(), at('14:30')).minutesPastLeaveBy, 0)).toBe(true);
  });

  describe('once stuck (supportive nags: steps 4 and 5 after stuck at 14:31)', () => {
    const stuck = (stuckAt = '2026-09-24T14:31:00Z') => appt({ status: 'stuck', stuckAt });
    const templates = BANK.supportive.spicy.map((t) => t.replace('{cue}', ''));
    // 15:00Z is 8:00 in Los Angeles (Jest's zone).
    const neutral = /(: s|S)tarts at 8:00\.$/;

    it.each([
      ['14:32', 1],
      ['14:34', 2],
      ['14:39', 2],
    ] as const)('at %s shows supportive nag %i of 2 with the neutral cue', (time, current) => {
      const view = alarmView(stuck(), at(time));
      expect(view).toMatchObject({
        phase: 'stuck',
        tone: 'supportive',
        progress: { current, total: 2 },
      });
      expect(view.line).toMatch(neutral);
      expect(view.line).not.toMatch(/leave|late|\bmin\b/i);
      expect(templates).toContain(view.line?.replace(/starts at 8:00\.$/i, '.'));
    });

    it('shows the lines the notifications carry (step 4, then step 5)', () => {
      expect(alarmView(stuck(), at('14:32')).line).not.toBe(alarmView(stuck(), at('14:34')).line);
    });

    it('has no dots when stuck came after the last step, but still a supportive line', () => {
      const view = alarmView(stuck('2026-09-24T14:41:00Z'), at('14:42'));
      expect(view).toMatchObject({ phase: 'stuck', progress: null });
      expect(view.line).toMatch(neutral);
    });
  });

  it('confirms left, and is over when nothing is left', () => {
    expect(alarmView(appt({ status: 'left' }), at('14:37'))).toMatchObject({
      phase: 'left',
      tone: 'done',
      progress: null,
      line: null,
    });
    expect(alarmView(appt(), at('15:30'))).toMatchObject({ phase: 'over', tone: 'done' });
    expect(alarmView(appt({ status: 'done' }), at('14:37')).phase).toBe('over');
  });
});
