// Global Jest mocks for native modules (see package.json "jest.setupFiles").
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// jest-expo stubs expo-crypto's native module; Node's crypto gives real UUIDs.
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
