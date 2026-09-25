# Tech debt

Known shortcuts to repay. One line each: `- [ ] <what> — <why taken> — <feature/date>`.

- [ ] Travel time is entered manually — maps API out of scope for v1 — PLAN.md
- [ ] Bricolage Grotesque / Inter not loaded; `font-heading`/`font-body` tokens exist but screens use system font — keep F001 minimal, load via expo-font when building real UI; pair `font-heading` with display/title/countdown and add tabular-nums for countdown — F001/2026-09-24
- [ ] App icon/splash are the Expo template assets — scaffold only; replace with Nag art — F001/2026-09-24
- [x] (repaid F005: `isOffsetDateTime` in src/domain/appointment.ts, used by the Zod schema in src/services/appointmentStore.ts) computeLeaveBy's RangeError guard is the only validation of `startsAt`/minutes — no services/ boundary parser (Zod) yet; that parser must reject impossible dates like 2026-02-30, which Date.parse rolls forward — F002/2026-09-24
- [ ] Home countdown for far-off events reads in raw minutes ("starts in 1560 min") — F005 reuses the F004 cue formatter unchanged; add an hours/days form for the home screen — F005/2026-09-24
- [ ] Native date picker (`DateTimeField.tsx`: Android dialogs, iOS inline spinner) and the Nag SVG's cssInterop colours are untested on a device — the cloud sandbox has web only — F005/2026-09-24
- [ ] No Maestro E2E flow yet, although PLAN.md (Stack: "E2E tests") says to add one around F005 — the cloud sandbox has no simulator; F005's create/edit/delete/reload flow was checked ad hoc on web with Playwright (not committed) — F005/2026-09-24
- [ ] `Appointment.notificationIds` is unused (always `[]`); F006 matches scheduled notifications in the OS list by identifier (`series:<id>:<step>`) — removing it needs a storage migration (`appointments.v1` schema) — F006/2026-09-25
- [ ] Notification scheduling is untested on a device: Expo Go (Android since SDK 53 drops push; local should work), Android exact-alarm/doze delays, the iOS foreground handler and the permission prompt — the cloud sandbox has web only — F006/2026-09-25
- [ ] A due (pulled-forward) step fires again when an appointment's timing (start, travel, buffer, in person) is edited during its series; title/intensity edits never re-fire — the reconciler has no record of delivered notifications, and after a re-time the current step is the right nag anyway — F006/2026-09-25
- [ ] expo-notifications is loaded through deep `expo-notifications/build/<file>` paths (not public API) to avoid the root's Expo Go-hostile `.fx` side effect — re-verify on every SDK upgrade: `TRACE_NOTIFICATIONS=1 node scripts/check-architecture.mjs` (the checker fails if a path vanishes or its graph reaches the root/.fx); drop the workaround once only dev builds are used — F006/2026-09-25
- [ ] Android 14+ denies `SCHEDULE_EXACT_ALARM` by default, so dev builds fall back to inexact alarms until the user allows "Alarms & reminders"; no in-app prompt yet; before a Play release, revisit `SCHEDULE_EXACT_ALARM` against the Play policy on exact alarms — dev-build milestone — F006/2026-09-25
- [ ] iOS reports DATE triggers as relative intervals, so the scheduled time is read from `content.data.at`; if iOS ever drops the payload, those entries are rescheduled on each sync (churn, and an imminent pulled step could be replaced) — F006/2026-09-25
