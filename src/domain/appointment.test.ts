import type { Appointment } from '@/types';

import {
  applyEdit,
  draftDefaults,
  draftFromAppointment,
  hasAlarm,
  isListed,
  isReschedule,
  isOffsetDateTime,
  isPlanned,
  markLeft,
  markStuck,
  newAppointment,
  timingChanged,
  validateAppointmentDraft,
  type AppointmentDraft,
} from './appointment';

const draft = (over: Partial<AppointmentDraft> = {}): AppointmentDraft => ({
  title: 'Dentist',
  startsAt: new Date('2026-09-25T15:00:00Z'),
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'spicy',
  ...over,
});

const EDIT_NOW = new Date('2026-09-25T14:40:00-07:00');
const EARLY = new Date('2026-09-25T08:00:00-07:00');

const fields = {
  title: '  Dentist  ',
  startsAt: '2026-09-25T15:00:00-07:00',
  travelMinutes: 25,
  bufferMinutes: 5,
  inPerson: true,
  intensity: 'savage' as const,
};

describe('draftDefaults', () => {
  it('starts one hour out, rounded up to 5 minutes, with the plan defaults', () => {
    const d = draftDefaults(new Date('2026-09-24T10:02:30Z'));
    expect(d.startsAt.toISOString()).toBe('2026-09-24T11:05:00.000Z');
    expect(d).toMatchObject({
      title: '',
      travelMinutes: 20,
      bufferMinutes: 5,
      inPerson: true,
      intensity: 'spicy',
    });
  });

  it('keeps an exact 5-minute boundary', () => {
    expect(draftDefaults(new Date('2026-09-24T10:00:00Z')).startsAt.toISOString()).toBe(
      '2026-09-24T11:00:00.000Z',
    );
  });
});

describe('validateAppointmentDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateAppointmentDraft(draft())).toEqual({});
  });

  it('requires a non-blank title', () => {
    expect(validateAppointmentDraft(draft({ title: '   ' })).title).toBeDefined();
  });

  it('rejects an invalid start', () => {
    expect(validateAppointmentDraft(draft({ startsAt: new Date(NaN) })).startsAt).toBeDefined();
  });

  it.each([-1, 601, 2.5, NaN])('rejects travel %p', (travelMinutes) => {
    expect(validateAppointmentDraft(draft({ travelMinutes })).travelMinutes).toBeDefined();
  });

  it.each([0, 600])('accepts travel %p', (travelMinutes) => {
    expect(validateAppointmentDraft(draft({ travelMinutes }))).toEqual({});
  });

  it.each([-5, 121, 1.5])('rejects buffer %p', (bufferMinutes) => {
    expect(validateAppointmentDraft(draft({ bufferMinutes })).bufferMinutes).toBeDefined();
  });
});

describe('newAppointment / applyEdit', () => {
  it('fills defaults and trims the title', () => {
    expect(newAppointment(fields, 'a1')).toEqual({
      ...fields,
      title: 'Dentist',
      id: 'a1',
      status: 'scheduled',
      source: 'manual',
      notificationIds: [],
    });
  });

  it('edits fields but keeps id, status, source and notification ids', () => {
    const appt: Appointment = {
      ...newAppointment(fields, 'a1'),
      status: 'snoozed',
      notificationIds: ['n1'],
    };
    const edited = applyEdit(appt, { ...fields, title: 'Gym ', intensity: 'mild' }, EDIT_NOW);
    expect(edited).toMatchObject({
      id: 'a1',
      status: 'snoozed',
      notificationIds: ['n1'],
      title: 'Gym',
      intensity: 'mild',
    });
  });

  // `fields` starts 15:00 (−07:00), leave by 14:30, step 1 at 14:00; the edit happens at 14:40.
  it.each(['left', 'stuck'] as const)(
    'a small start fix after %s keeps it (the series would already be under way)',
    (status) => {
      const appt: Appointment = { ...newAppointment(fields, 'a1'), status };
      const nudged = { ...fields, startsAt: '2026-09-25T15:10:00-07:00' }; // step 1 at 14:10
      expect(isReschedule(appt, nudged, EDIT_NOW)).toBe(false);
      expect(applyEdit(appt, nudged, EDIT_NOW).status).toBe(status);
    },
  );

  it.each(['left', 'stuck'] as const)(
    'moving %s to tomorrow (or later today, before its new step 1) resets it to scheduled',
    (status) => {
      const appt: Appointment = { ...newAppointment(fields, 'a1'), status };
      for (const startsAt of ['2026-09-26T15:00:00-07:00', '2026-09-25T16:00:00-07:00']) {
        expect(isReschedule(appt, { ...fields, startsAt }, EDIT_NOW)).toBe(true);
        expect(applyEdit(appt, { ...fields, startsAt }, EDIT_NOW).status).toBe('scheduled');
      }
    },
  );

  it.each(['left', 'stuck'] as const)('travel, buffer or title edits keep %s', (status) => {
    const appt: Appointment = { ...newAppointment(fields, 'a1'), status };
    for (const edit of [{ travelMinutes: 0 }, { bufferMinutes: 0 }, { title: 'Gym' }]) {
      expect(applyEdit(appt, { ...fields, ...edit }, EARLY).status).toBe(status);
    }
    // Same instant written with another offset is not a move.
    const same = { ...fields, startsAt: '2026-09-25T22:00:00Z' };
    expect(applyEdit(appt, same, EARLY).status).toBe(status);
  });

  it('never resets a scheduled or snoozed appointment', () => {
    const snoozed: Appointment = { ...newAppointment(fields, 'a1'), status: 'snoozed' };
    const moved = { ...fields, startsAt: '2026-09-26T15:00:00-07:00' };
    expect(applyEdit(snoozed, moved, EDIT_NOW).status).toBe('snoozed');
    expect(isReschedule(snoozed, moved, EDIT_NOW)).toBe(false);
  });

  it('round-trips through draftFromAppointment', () => {
    const d = draftFromAppointment(newAppointment(fields, 'a1'));
    expect(d.startsAt.toISOString()).toBe('2026-09-25T22:00:00.000Z');
    expect(d.title).toBe('Dentist');
  });
});

describe('timingChanged', () => {
  const base = newAppointment(fields, 'a');
  it.each([
    { name: 'start', edit: { startsAt: '2026-09-25T15:30:00-07:00' }, changed: true },
    { name: 'travel', edit: { travelMinutes: 30 }, changed: true },
    { name: 'buffer', edit: { bufferMinutes: 0 }, changed: true },
    { name: 'in person', edit: { inPerson: false }, changed: true },
    { name: 'title', edit: { title: 'Renamed' }, changed: false },
    { name: 'intensity', edit: { intensity: 'mild' as const }, changed: false },
    {
      name: 'same instant, other offset',
      edit: { startsAt: '2026-09-25T22:00:00Z' },
      changed: false,
    },
  ])('$name edit → $changed', ({ edit, changed }) => {
    expect(timingChanged(base, { ...base, ...edit })).toBe(changed);
  });
});

describe('status lifecycle (F007)', () => {
  const at = (status: Appointment['status']): Appointment => ({
    ...newAppointment(fields, 'a1'),
    status,
  });
  const STATUSES = ['scheduled', 'snoozed', 'stuck', 'left', 'done'] as const;

  it('plans notifications for scheduled, snoozed and stuck only', () => {
    expect(STATUSES.filter((s) => isPlanned(at(s)))).toEqual(['scheduled', 'snoozed', 'stuck']);
  });

  it('lists planned and left appointments on Home', () => {
    expect(STATUSES.filter((s) => isListed(at(s)))).toEqual([
      'scheduled',
      'snoozed',
      'stuck',
      'left',
    ]);
  });

  it('marks a planned appointment left; anything else is returned unchanged', () => {
    for (const s of ['scheduled', 'snoozed', 'stuck'] as const) {
      expect(markLeft(at(s))).toEqual({ ...at(s), status: 'left' });
    }
    for (const s of ['left', 'done'] as const) {
      const appt = at(s);
      expect(markLeft(appt)).toBe(appt);
    }
  });

  it('marks a scheduled or snoozed appointment stuck; anything else is returned unchanged', () => {
    for (const s of ['scheduled', 'snoozed'] as const) {
      expect(markStuck(at(s))).toEqual({ ...at(s), status: 'stuck' });
    }
    for (const s of ['stuck', 'left', 'done'] as const) {
      const appt = at(s);
      expect(markStuck(appt)).toBe(appt);
    }
  });

  it('leaves an event without an alarm (not in person) unchanged', () => {
    const online: Appointment = { ...at('scheduled'), inPerson: false };
    expect(markLeft(online)).toBe(online);
    expect(markStuck(online)).toBe(online);
    expect(hasAlarm(online)).toBe(false);
    expect(hasAlarm(at('scheduled'))).toBe(true);
  });

  it('does not mutate its input', () => {
    const appt = at('scheduled');
    markLeft(appt);
    markStuck(appt);
    expect(appt.status).toBe('scheduled');
  });
});

describe('isOffsetDateTime', () => {
  it.each([
    '2026-09-24T09:00:00-07:00',
    '2026-09-24T09:00Z',
    '2026-09-24T09:00:00.123+05:30',
    '2028-02-29T00:00:00Z',
  ])('accepts %s', (v) => expect(isOffsetDateTime(v)).toBe(true));

  it.each([
    '2026-09-24T09:00:00',
    '2026-02-30T09:00:00Z',
    '2026-02-29T09:00:00Z',
    '2026-13-01T09:00:00Z',
    '2026-09-24T24:00:00Z',
    '2026-09-24T09:60:00Z',
    '2026-09-24',
    'tomorrow',
  ])('rejects %s', (v) => expect(isOffsetDateTime(v)).toBe(false));
});
