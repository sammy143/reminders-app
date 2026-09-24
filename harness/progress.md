# Progress log

Newest entry at the bottom. Each session appends one entry:

```
## YYYY-MM-DD — <feature-id or "harness"> — <PASS | PARTIAL | BLOCKED>
- Did: …
- Verified: <commands run / manual checks>
- Next: …
- Blockers/notes: …
```

## 2026-09-24 — harness — PASS
- Did: research + challenge round (see docs/PLAN.md); set up agent harness: AGENTS.md,
  CLAUDE.md, docs/, harness/feature_list.json (F001–F013, all failing), scripts/, .claude/.
- Verified: `bash scripts/check.sh` runs (architecture check only; no package.json yet).
- Next: F001 scaffold Expo app.
- Blockers/notes: open questions in docs/PLAN.md (character name, primary device, store release).

## 2026-09-24 — harness — PASS
- Did: stack decided (docs/PLAN.md#Stack): NativeWind, Zustand, AsyncStorage, Zod, date-fns,
  Jest/RNTL, Maestro later, Cloudflare Worker proxy. Added F000 Stitch design pass before F001.
- Verified: `bash scripts/check.sh`.
- Next: F000 — must run locally (Stitch is local-only); needs the user's pick of visual vibe.
- Blockers/notes: vibe undecided (e.g. clean/minimal + menacing character vs loud/cartoonish).

## 2026-09-24 — F000 — PASS
- Did: design system in docs/design/DESIGN.md ("calm app, angry colors", mascot Nag, working
  name); Stitch screens home, new-appointment, active-alarm, settings + nag-irritated.svg
  exported to docs/design/screens/.
- Verified: all 4 verify steps met; screens reviewed visually; user approved.
- Next: F001 scaffold Expo + NativeWind (can run in a cloud session).
- Blockers/notes: mockup deviations (placeholder copy, out-of-scope UI, inconsistent
  mascot) recorded in docs/design/README.md — docs win over mockups.

## 2026-09-24 — F001 — PASS
- Did: Expo SDK 57 scaffold (RN 0.86, TS strict, Expo Router in src/app); NativeWind 4 with
  DESIGN.md tokens in tailwind.config.js; placeholder HomeScreen in src/ui + RNTL test;
  scripts lint (expo lint + prettier), typecheck, test (jest-expo).
- Verified: verifier PASS on all 5 steps (check.sh green; web served + screenshot shows tokens).
  Reviewer: no blockers; fixed prettier/eslint scope, dropped unused @/assets alias, logged debt.
- Next: F002.
- Blockers/notes: sandbox blocks api.expo.dev, so use `EXPO_OFFLINE=1` for `npx expo install`/`start`.
  Fonts are not loaded yet and the icons are still the template's (see docs/tech-debt.md). Only tested on web, not in Expo Go.
