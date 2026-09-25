import type { UiTone } from './tone';

/**
 * Colours on the alarm takeover's full tone background (DESIGN.md "Alarm screen"). Each tone
 * gets the text colour that meets WCAG AA on it: ink on the light tones (polite, firm, sarcastic,
 * rude), white on the dark ones (savage, supportive). Supportive also gets a 10% ink scrim, since
 * white on plain indigo is 4.47:1. Pills (the title badge, the stuck button) use the opposite colour
 * at low opacity, which only raises contrast. alarmTone.test.ts checks every pair against
 * tailwind.config.js, so these class strings are the source of truth.
 */
export interface AlarmColours {
  /** Text and countdown, always at full opacity. */
  text: string;
  /** Translucent pill behind small text: the title badge and the stuck button. */
  pill: string;
  /** Filled step dots and the ring around the current one. */
  dot: string;
  /** Border of a step dot not reached yet. */
  hollow: string;
  /** Overlay that darkens the tone background, or null. */
  scrim: string | null;
}

const ON_LIGHT = {
  text: 'text-ink',
  pill: 'bg-surface/30',
  dot: 'bg-ink',
  hollow: 'border-ink',
  scrim: null,
} as const;
const ON_DARK = {
  text: 'text-surface',
  pill: 'bg-ink/20',
  dot: 'bg-surface',
  hollow: 'border-surface',
  scrim: null,
} as const;

export const ALARM_TONE: Record<UiTone, AlarmColours> = {
  polite: ON_LIGHT,
  firm: ON_LIGHT,
  sarcastic: ON_LIGHT,
  rude: ON_LIGHT,
  savage: ON_DARK,
  unhinged: ON_DARK,
  supportive: { ...ON_DARK, scrim: 'bg-ink/10' },
  done: ON_LIGHT,
};
