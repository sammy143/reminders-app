# Suggested commands (planned; update after scaffold)

- Dev server: `npx expo start` → scan QR in Expo Go; `w` web, `i` iOS Simulator, `a` Android emulator. Different network: `npx expo start --tunnel`.
- Add Expo libs: `npx expo install <pkg>` (not plain npm install — picks SDK-compatible versions).
- Dev build (needed for geofencing/background tasks): `eas build --profile development --platform ios|android`.
- Health check: `npx expo-doctor`.
- Darwin notes: BSD `sed -i ''` (empty suffix required); `find`/`grep` are BSD variants.
