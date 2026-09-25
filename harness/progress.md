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

## 2026-09-25 — F006 — PASS-PENDING-HUMAN
- Did: the notification series stays in sync with the OS: a pure plan and diff in domain/ (next 2 in-person series,
  20 other reminders, cap 60, series:<id>:<step> identifiers), a guarded deep-import expo-notifications
  adapter plus a web no-op in services/, and serialised sync in state/ on hydrate, save, edit, delete and foreground.
  Permission is asked on first save; a "Notifications are off" banner shows on Home.
- Verified: verifier PASS-PENDING-HUMAN twice (13 breakages caught). Reviewer: 2 blockers fixed and re-confirmed
  (the Android Expo Go import crash via DevicePushTokenAutoRegistration.fx; Android 13+ never asking).
  Round 2 kept "denied" sticky. check.sh 270 tests. The architecture check traces the expo-notifications require graph.
- Next: the user's combined Expo Go checklist for F005 + F006 (in PR). Then F007.
- Blockers/notes: device-only: foreground display, Android exact vs. inexact timing in Expo Go, iOS data.at.

## 2026-09-25 — F005 + F006 — PASS (device-verified on iOS)
- Did: the user ran the combined Expo Go checklist (PR #6) on an iPhone; every F005 + F006 step passed
  (startup, persistence across restart, native pickers, notification series timing, edit and delete behaviour,
  the permission banner).
- Verified: both set to passes: true with the note "device-verified on iOS 2026-09-25; Android untested". Exec plans
  moved to completed/.
- Next: F007 ("I've left" / "I'm genuinely stuck").
- Blockers/notes: the Android device check is outstanding (docs/tech-debt.md). The Android-specific fixes
  (deep-import loader, 13+ permission mapping) are unit-tested but not device-tested.

## 2026-09-25 — F007 — PASS-PENDING-HUMAN
- Did: "I've left" (marks left, cancels the remaining series, dismisses delivered nags) and "I'm genuinely stuck"
  (remaining steps switch to supportive lines and category) from the notification action buttons (nagSeries/nagSupportive
  categories, warm + cold-start responses) and in the app via a new alarm screen (active-alarm.png, per-tone
  contrast colours, WCAG test). Online events never reach the alarm. Moving the start time resets left/stuck only if the new
  series hasn't started. Home shows "Left ✓"/"Stuck" badges.
- Also: cherry-picked d525920 (F005/F006 passes:true etc.), which PR #6 merged without.
- Verified: verifier PASS-PENDING-HUMAN twice (21 mutants caught). The reviewer's blocker (tapping an online reminder
  opened the escalation alarm) was fixed and re-confirmed; 2 fix rounds. check.sh 365 tests.
- Next: the user's Expo Go check (PR checklist), then F008.
- Blockers/notes: device-only: Expo Go category/action buttons (esp. Android), cold-start navigation, tray clean-up.
  Open product question: should the supportive series keep ending every line in "N min late"?

## 2026-09-25 — F007 — follow-up (user-requested, PR #7)
- Did: stuck mode shortened and softened: at most 2 supportive nags (the next 2 steps after pressing, fixed via
  `stuckAt`), neutral "starts at h:mm" cue, no lateness cue; PLAN rules 5/7 updated. Harness: `npm run typecheck`
  uses tsconfig.typecheck.json (no .expo/types or expo-env.d.ts), so a stale generated router.d.ts can't break
  check.sh. A new route-literal check in check-architecture replaces typed-route checking in the gate.
- Verified: verifier PASS-PENDING-HUMAN (7 stuck breakages caught; stale-types failure reproduced with the old
  command and passing with the new; fresh-clone typecheck passes; route check fires). check.sh 382 tests.
- Next: the user's device check for F007, then F008.

## 2026-09-25 — F007 — device check round 1 (user-run, iPhone Expo Go)
- Result: steps 1, 3–9 passed; step 2 failed (no action buttons on long-press; in-app actions work).
- Did: likely cause found in code: both notification categories were registered concurrently, and
  the iOS native CategoryManager actor re-enters at `await loadCategories()`, so on a cold start the
  last write can drop one category. Fix: register sequentially, read back with getNotificationCategoriesAsync,
  retry once, warn naming any missing id, and log `[nag] notification categories: …` in dev.
  Also: a stuck appointment's Home card shows "starts at h:mm" instead of the live countdown.
- Verified: verifier PASS-PENDING-HUMAN (5 breakages caught; race confirmed from the Swift source).
  Unconfirmed on Expo Go, which ships its own scoped categories module. check.sh 388 tests.
- Next: the user re-tests step 2. If buttons still don't show with both categories logged, treat it as an
  Expo Go limitation: document it, add it to F012 verify, and mark F007 as the user specified.

## 2026-09-25 — F007 — PASS (device-verified on iOS)
- Result: the user re-tested on iPhone (Expo Go) after the category-registration fix. The log showed both categories
  (nagSeries, nagSupportive); lock-screen and Notification Centre buttons work; the stuck card shows "starts at h:mm";
  "I've left" stops the nags. Root cause confirmed: concurrent category registration raced in the iOS CategoryManager actor.
- Verified: passes: true, note "device-verified on iOS incl. notification buttons; Android untested". Plan moved
  to completed/.
- Next: F008 (Settings).
- Blockers/notes: the Android device check (F005–F007) is outstanding; the DateTimePicker `onChange` deprecation is in tech-debt.

## 2026-09-25 — F008 — PASS-PENDING-HUMAN
- Did: a Settings tab (Today | Settings tab bar via an expo-router (tabs) group) with default intensity, default buffer
  and "Mute Nag for today". Settings are persisted (settings.v1, Zod field-by-field fallback) and prefill new appointments only.
  Mute drops every nag before the next local midnight (DST-safe) and shows a Home banner with Unmute and a calm bubble line.
  A failed settings load refuses saves and skips syncs. routeExists handles route groups and ignores _/+ files, and is tested by
  node --test scripts/*.test.mjs, now a check.sh step.
- Verified: verifier PASS-PENDING-HUMAN twice (17 mutants caught on the final tree); the reviewer found no blockers,
  fixed in 1 round. check.sh 444 tests + checker tests.
- Next: the user's Expo Go check (PR checklist), then F009.
