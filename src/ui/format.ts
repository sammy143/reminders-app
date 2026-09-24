import { format } from 'date-fns';

/** "Thu, Sep 25 · 3:00 PM" */
export const formatStart = (date: Date) =>
  Number.isNaN(date.getTime()) ? 'Pick a time' : format(date, 'EEE, MMM d · h:mm a');

/** "3:00 PM" */
export const formatTime = (date: Date) => format(date, 'h:mm a');

/** "2:30" — short leave-by time, as in the home mockup. */
export const formatShortTime = (date: Date) => format(date, 'h:mm');

/** "Tue, Oct 24" */
export const formatDay = (date: Date) => format(date, 'EEE, MMM d');
