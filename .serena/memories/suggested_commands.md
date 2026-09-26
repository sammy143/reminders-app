# Suggested commands (planned; update after scaffold)

- Dev server: `npx expo start` → scan QR in Expo Go; `w` web, `i` iOS Simulator, `a` Android emulator. Different network: `npx expo start --tunnel`.
- Add Expo libs: `npx expo install <pkg>` (not plain npm install — picks SDK-compatible versions).
- Dev build (needed for geofencing/background tasks): `eas build --profile development --platform ios|android`.
- Health check: `npx expo-doctor`.
- Darwin notes: BSD `sed -i ''` (empty suffix required); `find`/`grep` are BSD variants.
- Claude Code cloud sandbox blocks api.expo.dev → run Expo CLI there with `EXPO_OFFLINE=1`; device checks happen on the user's Mac + iPhone.
- Expo Go (signed in) refuses a LAN URL unless the Mac's Expo CLI is signed in to the same account: `npx expo login` needs a real terminal (interactive), not `!`/non-interactive.
- `npx expo start` via Claude Code's Bash backgrounds it (no QR); give the user `exp://<LAN IP>:8081` (`ipconfig getifaddr en0`).
