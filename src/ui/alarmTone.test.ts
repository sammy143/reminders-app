import { ALARM_TONE } from './alarmTone';
import { TONE, type UiTone } from './tone';

// WCAG 2.x contrast from the real tokens (tailwind.config.js mirrors DESIGN.md).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the config is CommonJS
const { colors } = require('../../tailwind.config.js').theme.extend;

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const TOKEN: Record<string, string> = {
  ink: colors.ink.DEFAULT,
  surface: colors.surface,
  ...Object.fromEntries(Object.entries(colors.tone).map(([k, v]) => [`tone-${k}`, v as string])),
};

/** `bg-ink/20` → ink at 0.2; `text-surface` → surface at 1. */
function parse(cls: string): { rgb: Rgb; alpha: number } {
  const m = /^(?:bg|text|border)-([\w-]+?)(?:\/(\d+))?$/.exec(cls);
  if (!m || !TOKEN[m[1]]) throw new Error(`Unknown colour class ${cls}`);
  return { rgb: hex(TOKEN[m[1]]), alpha: m[2] ? Number(m[2]) / 100 : 1 };
}
const over = (base: Rgb, cls: string | null): Rgb => {
  if (!cls) return base;
  const { rgb, alpha } = parse(cls);
  return base.map((v, i) => v * (1 - alpha) + rgb[i] * alpha) as Rgb;
};
const luminance = (c: Rgb) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TAKEOVER_TONES: UiTone[] = [
  'polite',
  'firm',
  'sarcastic',
  'rude',
  'savage',
  'unhinged',
  'supportive',
];

describe('alarm screen colours meet WCAG AA', () => {
  it.each(TAKEOVER_TONES)('%s', (tone) => {
    const c = ALARM_TONE[tone];
    const background = over(parse(TONE[tone].bg).rgb, c.scrim);
    const text = parse(c.text);
    expect(text.alpha).toBe(1); // no low-opacity text on the takeover
    // Caption, step label, Back, error: small text on the background (4.5:1).
    expect(contrast(text.rgb, background)).toBeGreaterThanOrEqual(4.5);
    // Countdown (48px) needs 3:1; covered by the line above.
    // Title badge and stuck button: small text on the pill.
    expect(contrast(text.rgb, over(background, c.pill))).toBeGreaterThanOrEqual(4.5);
    // Step dots are graphics: 3:1 against the background.
    expect(contrast(over(background, c.dot), background)).toBeGreaterThanOrEqual(3);
    expect(contrast(over(background, c.hollow), background)).toBeGreaterThanOrEqual(3);
    // "I've left": ink on the white button.
    expect(contrast(parse('text-ink').rgb, parse('bg-surface').rgb)).toBeGreaterThanOrEqual(4.5);
  });

  it('fails a pair that is known to be too weak (the check works)', () => {
    const background = parse('bg-tone-supportive').rgb;
    expect(contrast(parse('text-surface').rgb, background)).toBeLessThan(4.5);
  });
});
