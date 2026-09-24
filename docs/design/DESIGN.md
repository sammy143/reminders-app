# Design system — "Calm app, angry colors"

The app itself is calm, clean, and minimal. Urgency is carried by **color that escalates with
tone** and by the character, **Nag** (working name): a round, deadpan blob mascot with
half-lidded eyes whose expression gets more irritated as tone escalates. Nag mocks the
lateness, never the person.

Mobile-first (iOS/Android), light mode first. Tokens below are Tailwind-compatible and are
mirrored in `tailwind.config.js` (NativeWind). Change them here first.

## Color

### Base
| Token | Hex | Use |
|---|---|---|
| `bg` | `#F7F7F5` | app background (warm off-white) |
| `surface` | `#FFFFFF` | cards, sheets |
| `ink` | `#1C1C1E` | primary text |
| `ink-muted` | `#6B6B70` | secondary text |
| `line` | `#E5E5E2` | dividers, input borders |
| `primary` | `#1C1C1E` | primary buttons (ink-black, white text) |

### Tone ramp (escalation) — the only saturated colors in the app
| Token | Hex | Tone / step |
|---|---|---|
| `tone-polite` | `#14B8A6` | step 1 — polite heads-up (teal) |
| `tone-firm` | `#F59E0B` | step 2 — firm (amber) |
| `tone-sarcastic` | `#F97316` | step 3 — sarcastic, "leave now" (orange) |
| `tone-rude` | `#EF4444` | step 4 — rude (red) |
| `tone-savage` | `#B91C1C` | steps 5–6 — savage/unhinged (deep red) |
| `tone-supportive` | `#6366F1` | "I'm genuinely stuck" mode (indigo) |
| `tone-done` | `#22C55E` | left on time / streak |

`unhinged` uses `tone-savage`; `tone-done` is a status colour, not a Tone.

Rules: tone colors appear as accents (status dot, left edge bar, Nag tint, countdown text),
never as full-screen backgrounds except the active-alarm screen. Intensity chips use
polite (mild), sarcastic (spicy), savage (savage).

## Typography
- Headlines: **Bricolage Grotesque** (characterful, slightly condensed). Weights 600/800.
- Body/labels: **Inter**. Weights 400/500/600.

| Level | Font | Size / line | Weight |
|---|---|---|---|
| `display` | Bricolage Grotesque | 34 / 40 | 800 |
| `title` | Bricolage Grotesque | 24 / 30 | 700 |
| `headline` | Inter | 17 / 22 | 600 |
| `body` | Inter | 15 / 21 | 400 |
| `label` | Inter | 13 / 18 | 500 |
| `caption` | Inter | 12 / 16 | 400 |
| `countdown` | Bricolage Grotesque, tabular | 48 / 52 | 800 |

## Shape & spacing
- Radius: cards 16, buttons 12, chips full.
- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48. Screen gutter 16; card padding 16.
- Elevation: cards use a 1px `line` border, no heavy shadows.

## Components
- **Appointment card:** title (headline), start time + "leave by" time (label, muted),
  left edge bar in current tone color, small Nag face at right reflecting current tone,
  in-person / online badge.
- **Countdown:** `countdown` style in current tone color, "leave in 12 min".
- **Primary action:** full-width ink-black button "I've left" (12 radius, 52 tall).
- **Secondary action:** text button "I'm genuinely stuck" in `tone-supportive`.
- **Intensity selector:** 3 pill chips — Mild / Spicy / Savage.
- **Nag bubble:** speech bubble from Nag with the current line, bubble border in tone color.

## Voice (Nag)
Deadpan, dry, blunt. Short sentences. Targets the lateness and the situation, never
identity, looks, or ability. Every line includes a practical cue: "leave in 4 min" for in-person
events, "starts in 20 min" / "starting now" for online or phone events (their one polite reminder
says nothing about leaving or travel).
