import type { CardTone } from '@/domain/today';
import type { Intensity } from '@/types';

/** Tone keys the UI colours by: every tone (ladder + supportive) plus the `done` status. */
export type UiTone = CardTone;

interface ToneClasses {
  bg: string;
  tint: string;
  text: string;
  border: string;
  stroke: string;
  label: string;
}

// Full class names so Tailwind/NativeWind can see them (DESIGN.md "Tone ramp"; unhinged → savage).
export const TONE: Record<UiTone, ToneClasses> = {
  polite: {
    bg: 'bg-tone-polite',
    tint: 'bg-tone-polite/10',
    text: 'text-tone-polite',
    border: 'border-tone-polite',
    stroke: 'stroke-tone-polite',
    label: 'Polite',
  },
  firm: {
    bg: 'bg-tone-firm',
    tint: 'bg-tone-firm/10',
    text: 'text-tone-firm',
    border: 'border-tone-firm',
    stroke: 'stroke-tone-firm',
    label: 'Firm',
  },
  sarcastic: {
    bg: 'bg-tone-sarcastic',
    tint: 'bg-tone-sarcastic/10',
    text: 'text-tone-sarcastic',
    border: 'border-tone-sarcastic',
    stroke: 'stroke-tone-sarcastic',
    label: 'Sarcastic',
  },
  rude: {
    bg: 'bg-tone-rude',
    tint: 'bg-tone-rude/10',
    text: 'text-tone-rude',
    border: 'border-tone-rude',
    stroke: 'stroke-tone-rude',
    label: 'Rude',
  },
  savage: {
    bg: 'bg-tone-savage',
    tint: 'bg-tone-savage/10',
    text: 'text-tone-savage',
    border: 'border-tone-savage',
    stroke: 'stroke-tone-savage',
    label: 'Savage',
  },
  unhinged: {
    bg: 'bg-tone-savage',
    tint: 'bg-tone-savage/10',
    text: 'text-tone-savage',
    border: 'border-tone-savage',
    stroke: 'stroke-tone-savage',
    label: 'Unhinged',
  },
  supportive: {
    bg: 'bg-tone-supportive',
    tint: 'bg-tone-supportive/10',
    text: 'text-tone-supportive',
    border: 'border-tone-supportive',
    stroke: 'stroke-tone-supportive',
    label: 'Supportive',
  },
  done: {
    bg: 'bg-tone-done',
    tint: 'bg-tone-done/10',
    text: 'text-tone-done',
    border: 'border-tone-done',
    stroke: 'stroke-tone-done',
    label: 'Done',
  },
};

/** Intensity chip colours (DESIGN.md: mild → polite, spicy → sarcastic, savage → savage). */
export const INTENSITY_TONE: Record<Intensity, UiTone> = {
  mild: 'polite',
  spicy: 'sarcastic',
  savage: 'savage',
};
