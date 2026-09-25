import { formatCue, formatStartCue, formatStartsAtCue } from './cue';

describe('formatCue', () => {
  it.each([
    [-30, 'leave in 30 min'],
    [-24.5, 'leave in 25 min'],
    [-1, 'leave in 1 min'],
    [-0.6, 'leave in 1 min'],
    [-0.4, 'leave now'],
    [0, 'leave now'],
    [0.4, 'leave now'],
    [0.5, '1 min late'],
    [1, '1 min late'],
    [11, '11 min late'],
    [3.2, '3 min late'],
  ])('%p min from leaveBy → "%s"', (minutes, cue) => {
    expect(formatCue(minutes)).toBe(cue);
  });
});

describe('formatStartCue', () => {
  it.each([
    [60, 'starts in 60 min'],
    [30, 'starts in 30 min'],
    [24.5, 'starts in 25 min'],
    [1, 'starts in 1 min'],
    [0.5, 'starts in 1 min'],
    [0.4, 'starting now'],
    [0, 'starting now'],
    [-2, 'starting now'],
  ])('%p min to start → "%s"', (minutes, cue) => {
    expect(formatStartCue(minutes)).toBe(cue);
  });
});

describe('formatStartsAtCue', () => {
  // Local times (Jest runs in America/Los_Angeles).
  it.each([
    [new Date(2026, 8, 25, 15, 0), 'starts at 3:00'],
    [new Date(2026, 8, 25, 9, 7), 'starts at 9:07'],
    [new Date(2026, 8, 25, 0, 5), 'starts at 12:05'],
    [new Date(2026, 8, 25, 12, 30), 'starts at 12:30'],
    [new Date('2026-09-25T22:45:00Z'), 'starts at 3:45'],
  ])('%s → %s', (date, cue) => {
    expect(formatStartsAtCue(date)).toBe(cue);
  });
});
