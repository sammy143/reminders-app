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
- Files ≤ 300 lines.
- No Anthropic API keys (`sk-ant-…`) anywhere in tracked source.

Failure messages explain the fix. If a rule is wrong, change the rule and this doc in the
same commit and say why — don't work around it.

## Testing
- `domain/` is the heart: every function has unit tests (Jest), including edge times
  (midnight, DST, leave-by already passed).
- `services/` are tested behind small interfaces with fakes; no real notifications in tests.
- Tests sit next to code: `foo.ts` → `foo.test.ts`.
