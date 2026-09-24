import { computeLeaveBy } from './leaveBy';

describe('computeLeaveBy', () => {
  it('subtracts travel and buffer from the start time', () => {
    const leaveBy = computeLeaveBy({
      startsAt: '2026-09-24T15:00:00Z',
      travelMinutes: 25,
      bufferMinutes: 5,
    });
    expect(leaveBy.toISOString()).toBe('2026-09-24T14:30:00.000Z');
  });

  it('applies the buffer even when travel is zero', () => {
    const leaveBy = computeLeaveBy({
      startsAt: '2026-09-24T15:00:00Z',
      travelMinutes: 0,
      bufferMinutes: 5,
    });
    expect(leaveBy.toISOString()).toBe('2026-09-24T14:55:00.000Z');
  });

  it('returns the start time when travel and buffer are both zero', () => {
    const leaveBy = computeLeaveBy({
      startsAt: '2026-09-24T15:00:00Z',
      travelMinutes: 0,
      bufferMinutes: 0,
    });
    expect(leaveBy.toISOString()).toBe('2026-09-24T15:00:00.000Z');
  });

  it('crosses midnight into the previous day', () => {
    const leaveBy = computeLeaveBy({
      startsAt: '2026-09-25T00:20:00+02:00',
      travelMinutes: 30,
      bufferMinutes: 5,
    });
    expect(leaveBy.getTime()).toBe(Date.parse('2026-09-24T23:45:00+02:00'));
  });

  it('crosses a year boundary', () => {
    const leaveBy = computeLeaveBy({
      startsAt: '2027-01-01T00:10:00Z',
      travelMinutes: 15,
      bufferMinutes: 5,
    });
    expect(leaveBy.toISOString()).toBe('2026-12-31T23:50:00.000Z');
  });

  it('spans a DST change (offsets differ before and after)', () => {
    // US Pacific springs forward 2026-03-08 at 02:00 PST -> 03:00 PDT.
    const leaveBy = computeLeaveBy({
      startsAt: '2026-03-08T03:30:00-07:00',
      travelMinutes: 40,
      bufferMinutes: 5,
    });
    expect(leaveBy.getTime()).toBe(Date.parse('2026-03-08T01:45:00-08:00'));
  });

  it.each([
    ['empty', ''],
    ['garbage', 'not-a-date'],
    ['date only', '2026-09-24'],
    ['non-ISO', 'September 24, 2026 15:00'],
    ['no offset', '2026-09-24T15:00:00'],
  ])('throws RangeError on an unparseable startsAt (%s)', (_label, startsAt) => {
    expect(() => computeLeaveBy({ startsAt, travelMinutes: 10, bufferMinutes: 5 })).toThrow(
      RangeError,
    );
  });

  it.each([
    ['negative travel', -1, 5],
    ['negative buffer', 10, -5],
    ['NaN travel', NaN, 5],
    ['infinite buffer', 10, Infinity],
  ])('throws RangeError on invalid minutes (%s)', (_label, travelMinutes, bufferMinutes) => {
    expect(() =>
      computeLeaveBy({ startsAt: '2026-09-24T15:00:00Z', travelMinutes, bufferMinutes }),
    ).toThrow(RangeError);
  });
});
