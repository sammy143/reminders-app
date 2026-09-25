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

## 2026-09-24 — F002 — PASS
- Did: src/types (Appointment, Intensity, Tone, status/source types); src/domain/leaveBy.ts
  `computeLeaveBy` (epoch-ms subtraction; RangeError on bad input) + 15 tests.
- Verified: verifier PASS on all 3 steps. The reviewer found nothing blocking; fix round 1 added the offset requirement on `startsAt`,
  Tone in PLAN Core model, the tone→token note in DESIGN.md and a tech-debt line for the missing boundary parser.
- Next: F003.
- Blockers/notes: 'savage' is both an Intensity and a Tone value, so watch for mix-ups in buildSeries.
  The reviewer suggested checks for later: pin a non-UTC TZ in Jest; forbid Date.now()/new Date() in domain/.

## 2026-09-24 — F003 — PASS
- Did: src/domain/series.ts `buildSeries(appointment, now)` → SeriesStep[] {step, at, tone,
  minutesFromLeaveBy}; intensity caps tone; past steps dropped (original step numbers kept);
  non-in-person gets 1 polite step, pulled forward to now if missed before start. 15 tests.
- Verified: verifier PASS twice, before and after fix round 1 (breaking the code on purpose; DST/midnight; TZ-independent).
  The reviewer found no blockers; fix round 1 added the pull-forward rule, minutesFromLeaveBy, LadderTone and the PLAN wording.
- Next: F004 insult bank. Read the "Notes for later features" in exec-plans/completed/F003.md first.
- Blockers/notes: PLAN.md intensity wording and the non-in-person pull-forward were orchestrator
  decisions. They're flagged for the user in the PR.

## 2026-09-24 — F003 — follow-up (user-requested, PR #3)
- Did: the user approved both PLAN.md rule changes. In-person events created late now fire the most recent
  missed step at now, then the future steps (no pull from startsAt on, or when a step is exactly at now);
  minutesFromLeaveBy is recomputed from `at` (exact, fractional OK; F004 formats it). 18 series tests.
- Verified: verifier PASS on the original verify steps, both new requirements and edge cases (breaking the code on purpose).
- Next: F004 insult bank.

## 2026-09-24 — F004 — PASS
- Did: src/domain/lines/{bank,cue,select}.ts. 126 lines in Nag's voice (7 tones x 3 intensities,
  6 each); formatCue ("leave in N min" / "leave now" / "N min late"); withLines(series, appt)
  picks deterministically per (id, step) and keeps lines unique within a series. scheduledTone added to series.ts.
- Verified: verifier PASS after closing a test gap (uniqueness now ignores the cue; the +k mutant is caught).
  The reviewer confirmed the content rule twice. Two fix rounds reworded ~60 lines (cue clashes, escalation
  promises, near-duplicates, body/mobility words, time-only polite lines) and added bank tests for these.
- Next: F005.
- Blockers/notes: open product question: should events that aren't in person say "leave in N min", or
  "starts in N min"? F007 must compute k for supportive steps itself (see F004 plan).

## 2026-09-24 — F004 — follow-up (user decision, PR #4)
- Did: events that aren't in person get a start cue ("starts in N min" / "starting now") computed from
  startsAt via formatStartCue; withLines takes inPerson and startsAt. Polite lines contain no leave/travel words
  (test-enforced); 6 polite lines reworded. PLAN rule 7 and DESIGN voice updated.
- Verified: verifier PASS (12 mutants caught); check.sh 109 tests.
- Next: F005.

## 2026-09-24 — F005 — PASS-PENDING-HUMAN
- Did: appointment storage (AsyncStorage + Zod, services/), Zustand store (state/), Today list +
  add/edit/delete screens from docs/design/ (README deviations respected), Nag SVG, native/web
  date pickers. Past appointments pruned on load; jest now runs in America/Los_Angeles.
- Verified: verifier PASS-PENDING-HUMAN twice. The web flow (create → reload → edit → reload → delete → reload)
  passes independently; check.sh 190 tests. Reviewer fix round 1: hydrate errors, double submit,
  a11y and ARIA state, soonest Nag line, stricter Zod, a new architecture rule (no expo-router in ui/).
- Next: the user runs the Expo Go check (steps in PR), then set passes: true and move the plan to completed/.
- Blockers/notes: Expo Go/native untestable in the cloud sandbox. Countdown shows raw minutes for
  far-off events ("starts in 912 min"), logged in tech-debt.

## 2026-09-25 — F005 — fix (user-reported, PR #5)
- Did: HomeScreen.test failed from 22:30 to midnight (real clock + 90 min crossed into tomorrow). All
  tests now use an injected Clock (src/state/clock.ts is the only real-clock read). New architecture rule:
  no Date.now()/new Date() in tests or src/, with an allowlist of clock.ts only.
- Verified: reproduced by pinning Date to 23:15. The suite passes with the real clock and with Date pinned to 23:15, 00:10 and 2027 (193 tests).
- Next: waiting on the user's Expo Go check to close F005.
