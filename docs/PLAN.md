# Reminders App ("bully me out the door") — Plan

A reminders app for appointments whose notifications escalate from polite to insulting
until you actually leave the house. Hobby project; also a testbed for Claude cloud credits.

## Product rules

1. **Escalation ends only on departure.** "I've left" (button) = 10-min snooze + a roast for
   lying; the series is fully cancelled only by confirmed departure (geofence, v3). Until v3,
   the button cancels the series.
2. **Only in-person events bully.** Each event has `inPerson`. Events without it get one
   polite reminder.
3. **Mock the lateness, never the person.** No insults about identity, appearance, ability,
   or protected traits. Lines are tied to the moment ("the bus doesn't care about your vibes").
4. **Named character delivers the insults** (name TBD), not "the app".
5. **User control:** intensity `mild | spicy | savage`; "I'm genuinely stuck" switches the
   remaining series to supportive tone; "mute today".
6. **Cap:** max 6 notifications per event; every line in a series is unique.
7. **Every message carries a practical cue**: in-person events get a leave cue from leaveBy
   ("leave in 4 min", "leave now", "3 min late"); other events (online, phone) get a start cue
   from startsAt ("starts in 20 min", "starting now").

## Stack

Decided 2026-09-24 (defaults — change only with a note here).

| Concern | Choice | Note |
|---|---|---|
| Framework | Expo + React Native + TypeScript (strict), Expo Router | Confirm current SDK at `create-expo-app` |
| Design | **Stitch** (MCP, local only) → `docs/design/` | Web/Tailwind output is a reference, not app code |
| Styling | **NativeWind** (Tailwind for RN) | Chosen so Stitch's Tailwind classes map directly |
| State | Zustand | |
| Storage | AsyncStorage | expo-sqlite only if data gets relational; MMKV rejected (no Expo Go) |
| Validation | Zod | Parse at boundaries (PRINCIPLES #7) |
| Dates | date-fns | DST/midnight correctness |
| Notifications / calendar / location | expo-notifications · expo-calendar (v2) · expo-location + expo-task-manager (v3, dev build) | |
| Unit tests | Jest + jest-expo + React Native Testing Library | |
| E2E tests | Maestro (add around F005) | Agent-runnable YAML flows |
| Lint/format | ESLint (Expo config) + Prettier | |
| v2 backend | Cloudflare Worker proxy for Claude API | **The API key never ships in the app.** Supabase only if accounts/sync are ever wanted |

## Core model

```ts
type Intensity = 'mild' | 'spicy' | 'savage';
// Steps 1–6 of the escalation schedule, plus `supportive` after "I'm genuinely stuck".
type Tone = 'polite' | 'firm' | 'sarcastic' | 'rude' | 'savage' | 'unhinged' | 'supportive';
type AppointmentStatus = 'scheduled' | 'snoozed' | 'left' | 'stuck' | 'done';
type AppointmentSource = 'manual' | 'calendar';

interface Appointment {
  id: string;
  title: string;
  startsAt: string;          // ISO 8601 with offset; services/ normalise picker/calendar values
  travelMinutes: number;     // manual in v1
  bufferMinutes: number;     // default 5
  inPerson: boolean;
  intensity: Intensity;
  status: AppointmentStatus;
  notificationIds: string[]; // unused, always [] (F006 matches the OS list by key); drop at next storage migration
  lines?: string[];          // pre-generated insults (v2)
  source: AppointmentSource;
  calendarEventId?: string;
}
```

`leaveBy = startsAt − travelMinutes − bufferMinutes`

## Escalation schedule (relative to leaveBy)

| Step | Offset | Tone |
|---|---|---|
| 1 | −30 min | polite heads-up |
| 2 | −10 min | firm |
| 3 | 0 | sarcastic — "leave now" |
| 4 | +3 min | rude |
| 5 | +6 min | savage |
| 6 | +10 min | final, unhinged |

Intensity caps the tone per step: mild ≤ sarcastic, spicy ≤ savage, savage uncapped.
Not in-person → only step 1. If that time has already passed but the event hasn't started, it
fires immediately; once the event has started, nothing is sent. Its cue counts down to startsAt
("starts in 20 min"), not to leaveBy.
In-person events created late (some steps already passed, event not started) fire the most
recent missed step immediately, then the rest; earlier missed steps are skipped.

## Platform constraints (design around these)

- **iOS keeps only 64 pending local notifications.** Schedule series for the next
  ~2 upcoming in-person events only; top up on app foreground (and background fetch later).
- **Android 12+ exact alarms / doze** can delay notifications → test on a real device.
  expo-notifications uses exact alarms only when `canScheduleExactAlarms()`; otherwise Android
  may batch the ladder by minutes. **In Expo Go the ladder may arrive inexactly** (Expo Go's own
  permissions apply). Dev builds declare `SCHEDULE_EXACT_ALARM` (app.json); on Android 14+ it is
  denied by default and the user must allow "Alarms & reminders" in system settings (prompting for
  it is dev-build milestone work, see docs/tech-debt.md).
- Notification action button ("I've left") via `setNotificationCategoryAsync`.
- App must stay usable with notifications disabled (in-app list + banner).

## Milestones

Scope only. **Status lives in `harness/feature_list.json`** (F001–F013) — don't track progress here.

### v1 — core loop (Expo Go, one session)
- Scaffold Expo + TS + Expo Router; ESLint/Prettier; Jest.
- Appointment CRUD screens (list, add/edit) with travel minutes, in-person toggle, intensity.
- Pure scheduling module: `computeLeaveBy`, `buildSeries(appointment, now) → [{step, at, tone,
  minutesFromLeaveBy}]`, then `withLines(steps, appt)` adds `text` from the bank — unit tested.
- Hardcoded insult bank per tone × intensity, character voice.
- Schedule/cancel series with expo-notifications; respect the 64 cap (next 2 events).
- "I've left" (notification action + in-app) and "I'm genuinely stuck".
- Settings: default intensity, buffer, mute today.
- **Done when:** a test event 2 min out produces the escalating series on a real phone via
  Expo Go, and "I've left" stops it.

### v2 — Claude insults + calendar
- Serverless proxy: `POST /lines {title, intensity, tones[]}` → 6 lines; rate-limited;
      key in env. Model: latest Claude (check claude-api skill at build time).
- Generate lines at appointment create/edit; store in `lines`; fall back to bank on failure.
- Calendar import via expo-calendar: pick calendars, import upcoming events with a
      location as in-person candidates; user confirms travel minutes.
- **Done when:** a new event gets event-specific lines, and offline creation still works.

### v3 — proof of departure
- Dev build via EAS (`eas build --profile development`).
- Set home location; geofence exit (expo-location + expo-task-manager) marks `left`
      and cancels the series. Button becomes snooze-and-roast.
- Two-step "Always" location permission flow with clear rationale.
- On-time streaks + a positive message on time.
- **Done when:** walking out the door silences an active series on iOS and Android.

## Later / maybe
- Travel time from a maps API instead of manual.
- Google Calendar OAuth (only if device calendar sync isn't enough).
- Shareable "shame card" when very late.

## Open questions
- Character name and personality.
- iPhone or Android as primary test device?
- App store release, or personal use only? (Affects Apple guideline 1.1 care.)
