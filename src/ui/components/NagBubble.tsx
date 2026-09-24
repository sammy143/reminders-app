import { Text, View } from 'react-native';

import { TONE, type UiTone } from '../tone';
import { Nag } from './Nag';

interface NagBubbleProps {
  tone: UiTone;
  /** Upper-case header after "NAG •", e.g. "FIRM TONE". */
  heading: string;
  /** Right-aligned note, e.g. "leave in 42 min". */
  aside?: string;
  line: string;
  /** Horizontal position of the tail: under the header avatar (right) or the form chips (left). */
  tail?: 'left' | 'right';
}

/** Speech bubble from Nag with the current line; border in the tone colour. */
export function NagBubble({ tone, heading, aside, line, tail = 'left' }: NagBubbleProps) {
  const t = TONE[tone];
  return (
    <View className={`rounded-card border-2 bg-surface p-4 ${t.border}`}>
      <View
        className={`absolute -top-2 h-3.5 w-3.5 rotate-45 border-l-2 border-t-2 bg-surface ${t.border} ${
          tail === 'left' ? 'left-8' : 'right-12'
        }`}
      />
      <View className="flex-row gap-3">
        <Nag tone={tone} size={32} />
        <View className="flex-1 gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className={`text-label font-bold uppercase tracking-wider ${t.text}`}>
              • Nag • {heading}
            </Text>
            {aside ? <Text className="text-label text-ink-muted">{aside}</Text> : null}
          </View>
          <Text className="text-body text-ink">“{line}”</Text>
        </View>
      </View>
    </View>
  );
}
