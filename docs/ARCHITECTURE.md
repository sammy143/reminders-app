# Architecture

Layered, with dependencies pointing **one way only** (left may not import right):

```
types → domain → services → state → ui → app
```

| Layer | Path | Contains | May import |
|---|---|---|---|
| types | `src/types/` | Shared TS types (`Appointment`, `Intensity`, …) | nothing in `src/` |
| domain | `src/domain/` | Pure logic: `computeLeaveBy`, `buildSeries`, insult bank & selection | types |
| services | `src/services/` | Adapters: notifications, storage, calendar, location, lines API | types, domain |
| state | `src/state/` | Hooks/stores wiring services to the UI | types, domain, services |
| ui | `src/ui/` | Presentational components | types, domain, state |
| app | `src/app/` | Expo Router routes/screens (thin) | types, domain, state, ui |

Backend proxy (v2) lives outside the app in `server/` and never imports from `src/`.

Styling: NativeWind classes in `ui/` and `app/`, tokens from `docs/design/DESIGN.md`
(mirrored in `tailwind.config.js`). No hard-coded colors outside the config.

## Enforced mechanically (`scripts/check-architecture.mjs`)
- Import direction per the table above (relative and `@/` alias imports).
- `types/` and `domain/` import no `react`, `react-native`, or `expo*` packages — keeps
  them pure and unit-testable in plain Jest.
- `ui/` never imports `services/` directly (go through `state/`).
- `ui/` never imports `expo-router`: screens take navigation callbacks as props; routes in
  `app/` own the router (F005).
- No real-clock reads (`Date.now()`, argument-less `new Date()`) in tests or in `src/`
  (PRINCIPLES #8). Tests use a fixed time (inject `now`/a `Clock`, or `jest.useFakeTimers({ now })`);
  domain takes `now` as a parameter. The only allowed read is `systemClock` in
  `src/state/clock.ts` (the allowlist in the checker), which the store and `useNow` default to.
- Files ≤ 300 lines.
- No Anthropic API keys (`sk-ant-…`) anywhere in tracked source.
- `expo-notifications` is imported only by `src/services/notifications.ts`, and only from
  `expo-notifications/build/<file>` modules, never the package root: the root runs
  `DevicePushTokenAutoRegistration.fx`, which throws in Expo Go on Android. The checker traces
  each deep module's require graph in node_modules (static imports, `import()` and `require`,
  all platform variants, directory `index.*`) and fails if it reaches `build/index.js`, any `.fx`
  module, or the package root, if a relative dependency resolves to no file, or if the module
  no longer exists. `TRACE_NOTIFICATIONS=1 node scripts/check-architecture.mjs` prints the graphs.
  The adapter loads them lazily in a try/catch; on failure notifications are `unavailable`.
- Side-effect imports (`import 'x'`) count as imports for every rule.

Failure messages explain the fix. If a rule is wrong, change the rule and this doc in the
same commit and say why — don't work around it.

## Testing
- `domain/` is the heart: every function has unit tests (Jest), including edge times
  (midnight, DST, leave-by already passed).
- `services/` are tested behind small interfaces with fakes; no real notifications in tests.
- Tests sit next to code: `foo.ts` → `foo.test.ts`.
