import type { Intensity, Tone } from '@/types';

import { BANK } from './bank';
import { fillCue } from './select';

const TONES: Tone[] = ['polite', 'firm', 'sarcastic', 'rude', 'savage', 'unhinged', 'supportive'];
const INTENSITIES: Intensity[] = ['mild', 'spicy', 'savage'];
const LADDER: Tone[] = ['polite', 'firm', 'sarcastic', 'rude', 'savage', 'unhinged'];
const all = Object.values(BANK).flatMap((cells) => Object.values(cells).flat());
const CUE_FORMS = ['leave in 5 min', 'leave now', '5 min late', 'starts in 5 min', 'starting now'];
// Words any cue form uses (leave and start families). A template that uses them too reads as
// "Go now. Leave now."
const CUE_WORDS = /\bleav\w*|\bstart\w*|\bnow\b|\blate\w*|\bmin(ute)?s?\b/gi;
const countCueWords = (text: string) => text.match(CUE_WORDS)?.length ?? 0;
// Sequence or timing words that break when a polite/firm line is the only (or a pulled) reminder.
const SEQUENCE_WORDS =
  /\b(yet|urgent|no pressure|still polite|won't last|second|third|several|anymore|again|last|first|nice one)\b/i;
// Body and mobility words: lines must not assume how (or whether) the user walks or stands.
const BODY_WORDS = /\b(walk\w*|feet|foot|stand\w*|run\w*)\b/i;
// Polite is all a video or phone call gets, so polite lines talk about time, not physically leaving.
const LEAVING_OBJECTS = /\b(keys?|doors?|shoes?|coats?|wallets?|bus)\b/i;
// Polite lines also carry "starts in N min" for online/phone events: no leaving or travel words.
const LEAVING_WORDS =
  /\b(leav\w*|head(ing)?|out|go(ing|ne)?|trip\w*|commut\w*|travel\w*|driv\w*|arriv\w*|get(ting)? there|exit\w*)\b/i;

/** Lowercase, `{cue}` and punctuation stripped, split into words. */
const words = (template: string) =>
  template
    .replace('{cue}', ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
const trigrams = (template: string) => {
  const w = words(template);
  return new Set(w.slice(2).map((_, i) => w.slice(i, i + 3).join(' ')));
};
// 3-word phrases allowed to repeat within one series because they carry no joke. Empty for now;
// add here with a reason if a new line needs one (e.g. "is right there").
const TRIGRAM_ALLOWLIST = new Set<string>([]);

describe('BANK', () => {
  it('has exactly the 7 tones × 3 intensities', () => {
    expect(Object.keys(BANK).sort()).toEqual([...TONES].sort());
    for (const tone of TONES) {
      expect(Object.keys(BANK[tone]).sort()).toEqual([...INTENSITIES].sort());
    }
  });

  it.each(TONES.flatMap((tone) => INTENSITIES.map((intensity) => [tone, intensity] as const)))(
    '%s × %s has at least 6 lines',
    (tone, intensity) => {
      expect(BANK[tone][intensity].length).toBeGreaterThanOrEqual(6);
    },
  );

  it('puts {cue} exactly once in every template', () => {
    const bad = all.filter((line) => line.split('{cue}').length !== 2);
    expect(bad).toEqual([]);
  });

  it('never repeats a line anywhere in the bank', () => {
    const seen = new Set<string>();
    const dupes = all.filter((line) => (seen.has(line) ? true : (seen.add(line), false)));
    expect(dupes).toEqual([]);
  });

  it('keeps lines short and free of stray placeholders', () => {
    for (const line of all) {
      expect(line.length).toBeLessThanOrEqual(80);
      expect(line.replace('{cue}', '')).not.toMatch(/[{}]/);
    }
  });

  it('contains no strong profanity', () => {
    const banned = /\b(fuck|shit|bitch|bastard|cunt|dick|asshole|piss)/i;
    expect(all.filter((line) => banned.test(line))).toEqual([]);
  });

  it('reads well with every cue form: no cue word repeated outside the cue', () => {
    const bad = all.flatMap((template) =>
      CUE_FORMS.map((cue) => fillCue(template, cue)).filter(
        (text, i) => countCueWords(text) !== countCueWords(CUE_FORMS[i]),
      ),
    );
    expect(bad).toEqual([]);
  });

  it('keeps polite and firm lines neutral about sequence and timing', () => {
    const lines = (['polite', 'firm'] as const).flatMap((tone) =>
      INTENSITIES.flatMap((intensity) => BANK[tone][intensity]),
    );
    expect(lines.filter((line) => SEQUENCE_WORDS.test(line))).toEqual([]);
  });

  it.each(INTENSITIES)(
    'shares no 3-word phrase between lines that can fire in one %s series',
    (intensity) => {
      const lines = LADDER.flatMap((tone) => BANK[tone][intensity]);
      const clashes: string[] = [];
      lines.forEach((a, i) => {
        const grams = trigrams(a);
        for (const b of lines.slice(i + 1)) {
          for (const g of trigrams(b)) {
            if (grams.has(g) && !TRIGRAM_ALLOWLIST.has(g)) clashes.push(`"${g}": ${a} | ${b}`);
          }
        }
      });
      expect(clashes).toEqual([]);
    },
  );

  it('never uses body or mobility words', () => {
    expect(all.filter((line) => BODY_WORDS.test(line))).toEqual([]);
  });

  it('keeps polite lines about time, not about physically leaving', () => {
    const polite = INTENSITIES.flatMap((intensity) => BANK.polite[intensity]);
    expect(polite.filter((line) => LEAVING_OBJECTS.test(line))).toEqual([]);
    expect(polite.filter((line) => LEAVING_WORDS.test(line))).toEqual([]);
  });
});
