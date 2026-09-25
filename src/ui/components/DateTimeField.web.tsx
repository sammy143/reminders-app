import { format, isValid, parseISO } from 'date-fns';
import { Text, View } from 'react-native';

import type { DateTimeFieldProps } from './DateTimeField';

/** Web "Date & time" row: a native `datetime-local` input, read as local time. */
export function DateTimeField({ value, onChange }: DateTimeFieldProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3.5">
      <Text className="text-label font-semibold text-ink-muted">Date & time</Text>
      <input
        type="datetime-local"
        aria-label="Date and time"
        value={isValid(value) ? format(value, "yyyy-MM-dd'T'HH:mm") : ''}
        onChange={(e) => {
          const next = parseISO(e.target.value);
          onChange(isValid(next) ? next : new Date(NaN));
        }}
        className="border-0 bg-transparent text-right text-body text-ink"
      />
    </View>
  );
}
