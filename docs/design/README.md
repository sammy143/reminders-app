# Design (source of truth for how the app looks)

Produced with the Stitch MCP server (local only) in feature F000.
Stitch project: "Reminders App — Nag" (`projects/846010921996420651`), design system
`assets/16909830866868751936`.

- `DESIGN.md` — design system: colors, typography, spacing, radii as Tailwind-compatible
  tokens. `tailwind.config.js` mirrors these; change here first.
- `screens/<name>.png` + `screens/<name>.html` — Stitch exports per screen. The HTML is a
  visual reference (web/Tailwind), not code to copy into the app.

Update this folder before changing UI code; the reviewer checks UI against it.

## Screens
| File | Screen | Features |
|---|---|---|
| `screens/home.png` | Today list: Nag bubble, streak pill, appointment cards with tone edge bar, FAB | F005, F013 |
| `screens/new-appointment.png` | Add/edit form: in-person toggle, travel + buffer steppers, computed leave-by, intensity chips, preview bubble | F005 |
| `screens/active-alarm.png` | Late-to-leave takeover: full tone background, countdown, Nag, step dots, "I've left" / "I'm genuinely stuck" | F006, F007 |
| `screens/settings.png` | Default meanness, buffer, mute today, supportive mode, calendar + home rows | F008, F011, F012 |
| `screens/nag-irritated.svg` | Mascot, irritated state | all |

## Deviations — the docs win over the mockups
- **Copy is placeholder.** The new-appointment preview says "has seen worse teeth" — that
  mocks appearance and violates PRINCIPLES #2. Real lines come from the insult bank (F004).
- **Out of scope, don't build:** "Upcoming" tab in bottom nav (v1 has Today + Settings only),
  "Emergency escalation" row in settings, version badge, "Metro"/"3h buffer" on home cards.
- **Mascot is inconsistent** across screens (settings avatar differs). Use one simple vector
  Nag with expression variants per tone (calm → firm → irritated → furious); derive from
  `nag-irritated.svg`.
- Home card "Leave by 2:30 · 12 min drive": the second part should be the countdown
  ("leave in 12 min"), per DESIGN.md.
- Toggle on-color: ink-black for normal toggles, indigo only for supportive mode (as shown).
- Active alarm: text colour per tone for contrast, a white primary button, a small Back control and no
  added quote marks around Nag's line — see DESIGN.md "Alarm screen" (F007).
- Settings (F008): no version badge, supportive-mode, calendar, home-location or emergency rows; one
  Nag avatar; accurate buffer hint and a "new appointments only" caption; the existing stepper — see
  [F008 exec plan](../exec-plans/completed/F008.md) "Design deviations".
