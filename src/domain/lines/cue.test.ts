import { formatCue, formatStartCue } from './cue';

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
