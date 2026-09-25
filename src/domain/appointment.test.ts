import type { Appointment } from '@/types';

import {
  applyEdit,
  draftDefaults,
  draftFromAppointment,
  isOffsetDateTime,
  newAppointment,
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
    const edited = applyEdit(appt, { ...fields, title: 'Gym ', inPerson: false });
    expect(edited).toMatchObject({
      id: 'a1',
      status: 'snoozed',
      notificationIds: ['n1'],
      title: 'Gym',
      inPerson: false,
    });
  });

  it('round-trips through draftFromAppointment', () => {
    const d = draftFromAppointment(newAppointment(fields, 'a1'));
    expect(d.startsAt.toISOString()).toBe('2026-09-25T22:00:00.000Z');
    expect(d.title).toBe('Dentist');
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
