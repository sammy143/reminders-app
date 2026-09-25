import { useEffect, useState } from 'react';

import { systemClock, type Clock } from './clock';

/** Current time from `clock`, refreshed every `intervalMs`. The one way UI reads the time. */
export function useNow(intervalMs = 15_000, clock: Clock = systemClock): Date {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const timer = setInterval(() => setNow(clock()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, clock]);
  return now;
}
