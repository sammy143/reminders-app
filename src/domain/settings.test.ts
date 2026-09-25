import { draftDefaults } from './appointment';
import {
  DEFAULT_SETTINGS,
  activeMute,
  appointmentDefaults,
  isMuted,
  adjustBuffer,
  muteUntilMidnight,
} from './settings';

// Fixed times; Jest runs in America/Los_Angeles (DST ends 2026-11-01, starts 2026-03-08).
const HOUR = 3_600_000;

describe('muteUntilMidnight', () => {
  it('is the next local midnight on an ordinary day', () => {
    expect(muteUntilMidnight(new Date('2026-09-25T09:00:00-07:00')).toISOString()).toBe(
      new Date('2026-09-26T00:00:00-07:00').toISOString(),
    );
  });

  it('is the next day even a minute before midnight, and a full day right at midnight', () => {
    expect(muteUntilMidnight(new Date('2026-09-25T23:59:00-07:00')).toISOString()).toBe(
      new Date('2026-09-26T00:00:00-07:00').toISOString(),
    );
    expect(muteUntilMidnight(new Date('2026-09-26T00:00:00-07:00')).toISOString()).toBe(
      new Date('2026-09-27T00:00:00-07:00').toISOString(),
    );
  });

  it('lands on local midnight across the end of DST (a 25-hour day)', () => {
    const dayStart = new Date('2026-11-01T00:00:00-07:00');
    const until = muteUntilMidnight(new Date('2026-11-01T10:00:00-08:00'));
    expect(until.toISOString()).toBe(new Date('2026-11-02T00:00:00-08:00').toISOString());
    expect(until.getTime() - dayStart.getTime()).toBe(25 * HOUR);
    // The repeated 1:30 (PDT, then PST) is still the same day.
    expect(muteUntilMidnight(new Date('2026-11-01T01:30:00-07:00'))).toEqual(until);
    expect(muteUntilMidnight(new Date('2026-11-01T01:30:00-08:00'))).toEqual(until);
    // The evening before DST ends mutes until the midnight that is still PDT.
    expect(muteUntilMidnight(new Date('2026-10-31T22:00:00-07:00')).toISOString()).toBe(
      dayStart.toISOString(),
    );
  });

  it('lands on local midnight across the start of DST (a 23-hour day)', () => {
    const until = muteUntilMidnight(new Date('2026-03-08T12:00:00-07:00'));
    expect(until.toISOString()).toBe(new Date('2026-03-09T00:00:00-07:00').toISOString());
    expect(until.getTime() - new Date('2026-03-08T00:00:00-08:00').getTime()).toBe(23 * HOUR);
  });
});

describe('isMuted / activeMute', () => {
  const muted = { mutedUntil: '2026-11-02T00:00:00-08:00' };

  it('is muted until midnight and not from midnight on (DST end day)', () => {
    expect(isMuted(muted, new Date('2026-11-01T23:59:59-08:00'))).toBe(true);
    expect(activeMute(muted, new Date('2026-11-01T01:30:00-07:00'))?.toISOString()).toBe(
      '2026-11-02T08:00:00.000Z',
    );
    expect(isMuted(muted, new Date('2026-11-02T00:00:00-08:00'))).toBe(false);
    expect(activeMute(muted, new Date('2026-11-02T00:00:01-08:00'))).toBeNull();
  });

  it('is not muted without a mutedUntil', () => {
    expect(isMuted(DEFAULT_SETTINGS, new Date('2026-09-25T09:00:00-07:00'))).toBe(false);
  });
});

describe('defaults for new appointments', () => {
  it('start as spicy, 5 min, not muted', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      defaultIntensity: 'spicy',
      defaultBufferMinutes: 5,
      mutedUntil: null,
    });
  });

  it('feed the new-appointment draft; everything else keeps the draft defaults', () => {
    const now = new Date('2026-09-25T09:00:00-07:00');
    const draft = draftDefaults(
      now,
      appointmentDefaults({ defaultIntensity: 'savage', defaultBufferMinutes: 15 }),
    );
    expect(draft).toEqual({ ...draftDefaults(now), intensity: 'savage', bufferMinutes: 15 });
    expect(draft.travelMinutes).toBe(20);
    expect(draft.inPerson).toBe(true);
  });

  it.each([
    [5, 5, 10],
    [10, -5, 5],
    [0, -5, 0],
    [120, 5, 120],
    [115, 10, 120],
  ])('adjusts buffer %p by %p to %p, within the limits', (current, delta, next) => {
    expect(adjustBuffer(current, delta)).toBe(next);
  });
});
