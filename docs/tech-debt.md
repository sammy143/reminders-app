# Tech debt

Known shortcuts to repay. One line each: `- [ ] <what> — <why taken> — <feature/date>`.

- [ ] Travel time is entered manually — maps API out of scope for v1 — PLAN.md
- [ ] Bricolage Grotesque / Inter not loaded; `font-heading`/`font-body` tokens exist but screens use system font — keep F001 minimal, load via expo-font when building real UI; pair `font-heading` with display/title/countdown and add tabular-nums for countdown — F001/2026-09-24
- [ ] App icon/splash are the Expo template assets — scaffold only; replace with Nag art — F001/2026-09-24
- [x] (repaid F005: `isOffsetDateTime` in src/domain/appointment.ts, used by the Zod schema in src/services/appointmentStore.ts) computeLeaveBy's RangeError guard is the only validation of `startsAt`/minutes — no services/ boundary parser (Zod) yet; that parser must reject impossible dates like 2026-02-30, which Date.parse rolls forward — F002/2026-09-24
- [ ] Home countdown for far-off events reads in raw minutes ("starts in 1560 min") — F005 reuses the F004 cue formatter unchanged; add an hours/days form for the home screen — F005/2026-09-24
- [ ] Native date picker (`DateTimeField.tsx`: Android dialogs, iOS inline spinner) and the Nag SVG's cssInterop colours are untested on a device — the cloud sandbox has web only — F005/2026-09-24
- [ ] No Maestro E2E flow yet, although PLAN.md (Stack: "E2E tests") says to add one around F005 — the cloud sandbox has no simulator; F005's create/edit/delete/reload flow was checked ad hoc on web with Playwright (not committed) — F005/2026-09-24
