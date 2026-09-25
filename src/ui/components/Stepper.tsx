import { Pressable, Text, View } from 'react-native';

interface StepperProps {
  label: string;
  /** Muted second line under the label. */
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

/** Row with − value + buttons, in minutes. Clamps to [min, max]. */
export function Stepper({ label, hint, value, min, max, step, onChange }: StepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="flex-1 pr-3">
        <Text className="text-body text-ink">{label}</Text>
        {hint ? <Text className="text-label text-ink-muted">{hint}</Text> : null}
      </View>
      <View className="flex-row items-center gap-3">
        <StepButton
          symbol="−"
          label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onPress={() => set(value - step)}
        />
        <Text
          className="w-16 text-center text-headline text-ink"
          aria-label={`${label}: ${value} min`}
        >
          {value} min
        </Text>
        <StepButton
          symbol="+"
          label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onPress={() => set(value + step)}
        />
      </View>
    </View>
  );
}

function StepButton(props: {
  symbol: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-disabled={props.disabled}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={6}
      className={`h-7 w-7 items-center justify-center rounded-full border border-line bg-bg ${props.disabled ? 'opacity-40' : ''}`}
    >
      <Text className="text-headline text-ink">{props.symbol}</Text>
    </Pressable>
  );
}
