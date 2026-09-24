import { Pressable, Text, View } from 'react-native';

import type { Intensity } from '@/types';

import { INTENSITY_TONE, TONE } from '../tone';

const CHIPS: { value: Intensity; label: string; hint: string }[] = [
  { value: 'mild', label: 'Mild', hint: 'Polite nudge' },
  { value: 'spicy', label: 'Spicy', hint: 'Sarcastic bite' },
  { value: 'savage', label: 'Savage', hint: 'Rude brutality' },
];

interface IntensityChipsProps {
  value: Intensity;
  onChange: (value: Intensity) => void;
}

/** Mild / Spicy / Savage selector; the selected chip takes its tone colour. */
export function IntensityChips({ value, onChange }: IntensityChipsProps) {
  return (
    <View className="flex-row gap-2" role="radiogroup" aria-label="How mean should Nag be?">
      {CHIPS.map((chip) => {
        const selected = chip.value === value;
        const t = TONE[INTENSITY_TONE[chip.value]];
        return (
          <Pressable
            key={chip.value}
            role="radio"
            aria-checked={selected}
            aria-label={`${chip.label}: ${chip.hint}`}
            onPress={() => onChange(chip.value)}
            className={`flex-1 items-center rounded-card px-2 py-2.5 ${
              selected ? `border-2 ${t.border} ${t.tint}` : 'border border-line bg-surface'
            }`}
          >
            {selected && (
              <View className={`absolute -top-2 right-2 rounded-full px-1.5 ${t.bg}`}>
                <Text className="text-[9px] font-bold uppercase text-surface">Selected</Text>
              </View>
            )}
            <View className={`mb-1.5 h-2 w-2 rounded-full ${t.bg}`} />
            <Text className="text-label font-semibold text-ink">{chip.label}</Text>
            <Text className={`text-caption ${selected ? t.text : 'text-ink-muted'}`}>
              {chip.hint}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
