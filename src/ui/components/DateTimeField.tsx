import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { formatStart } from '../format';

export interface DateTimeFieldProps {
  value: Date;
  onChange: (value: Date) => void;
}

/**
 * "Date & time" row. Native: Android opens the system date then time dialogs; iOS toggles an
 * inline spinner. Web uses DateTimeField.web.tsx. Values are local Dates.
 */
export function DateTimeField({ value, onChange }: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);

  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          onChange: (e, time) => {
            if (e.type === 'set' && time) onChange(time);
          },
        });
      },
    });

  return (
    <View>
      <Pressable
        role="button"
        aria-label={`Date and time: ${formatStart(value)}`}
        onPress={() => (Platform.OS === 'android' ? openAndroid() : setOpen(!open))}
        className="flex-row items-center justify-between px-4 py-3.5"
      >
        <Text className="text-label font-semibold text-ink-muted">Date & time</Text>
        <Text className="text-body text-ink">{formatStart(value)} ›</Text>
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="spinner"
          onChange={(_, date) => date && onChange(date)}
        />
      ) : null}
    </View>
  );
}
