# Tech stack

Authoritative table: `docs/PLAN.md` → "Stack" section. Verify versions against package.json once scaffolded.

Non-obvious constraints behind the choices:
- Stitch MCP is configured only on the user's Mac → design work (F000) can't run in Claude Code cloud sessions; exports in `docs/design/` are what cloud agents use.
- Stitch outputs web HTML/Tailwind → reference only; app styling is NativeWind with tokens mirrored from `docs/design/DESIGN.md` into `tailwind.config.js`.
- Anything needing native modules outside Expo Go (MMKV, geofencing/background tasks) requires an EAS dev build; v1 must stay Expo Go–compatible.
- expo-location geofencing: iOS 20 regions (relaunches app), Android 100 (does not relaunch killed app); needs "Always" permission + iOS `location` UIBackgroundModes.
- Claude API only via the Cloudflare Worker proxy in `server/`; never from the app.
