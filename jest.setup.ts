// Global Jest mocks for native modules (see package.json "jest.setupFiles").
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// jest-expo stubs expo-crypto's native module; Node's crypto gives real UUIDs.
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

// No real notifications in tests (docs/ARCHITECTURE.md "Testing"). The adapter loads these deep
// modules only; importing the package root would run its Expo Go-hostile side effect, so here it throws.
jest.mock('expo-notifications', () => {
  throw new Error(
    'Import expo-notifications/build/<file> modules only (src/services/notifications.ts).',
  );
});
jest.mock('expo-notifications/build/scheduleNotificationAsync', () => ({
  scheduleNotificationAsync: jest.fn(async (r: { identifier: string }) => r.identifier),
}));
jest.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => ({
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));
jest.mock('expo-notifications/build/getAllScheduledNotificationsAsync', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
}));
jest.mock('expo-notifications/build/NotificationPermissions', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('expo-notifications/build/NotificationsHandler', () => ({
  setNotificationHandler: jest.fn(),
}));
jest.mock('expo-notifications/build/setNotificationChannelAsync', () => ({
  setNotificationChannelAsync: jest.fn(async () => null),
}));
jest.mock('expo-notifications/build/setNotificationCategoryAsync', () => ({
  setNotificationCategoryAsync: jest.fn(async (identifier: string, actions: unknown[]) => ({
    identifier,
    actions,
  })),
}));
jest.mock('expo-notifications/build/NotificationsEmitter', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
}));
jest.mock('expo-notifications/build/dismissNotificationAsync', () => ({
  dismissNotificationAsync: jest.fn(async () => {}),
}));
jest.mock('expo-notifications/build/getPresentedNotificationsAsync', () => ({
  getPresentedNotificationsAsync: jest.fn(async () => []),
}));
// Enum values copied from expo-notifications' .d.ts files.
jest.mock('expo-notifications/build/Notifications.types', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('expo-notifications/build/NotificationChannelManager.types', () => ({
  AndroidImportance: { HIGH: 6 },
}));
jest.mock('expo-notifications/build/NotificationPermissions.types', () => ({
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
}));
