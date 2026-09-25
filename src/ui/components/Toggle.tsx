import { Pressable, View } from 'react-native';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

/** iOS-style switch; ink-black when on (docs/design/README.md: indigo only for supportive mode). */
export function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <Pressable
      role="switch"
      aria-label={label}
      aria-checked={value}
      onPress={() => onChange(!value)}
      hitSlop={8}
      className={`h-7 w-12 justify-center rounded-full px-0.5 ${value ? 'bg-primary' : 'bg-line'}`}
    >
      <View
        className={`h-6 w-6 rounded-full border border-line bg-surface ${value ? 'self-end' : 'self-start'}`}
      />
    </Pressable>
  );
}
