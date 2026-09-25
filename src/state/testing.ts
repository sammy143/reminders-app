/**
 * Test doubles for layers that may not import services/ (ui/ tests): see docs/ARCHITECTURE.md.
 * Never imported by app code.
 */
export { createFakeNotifications, type FakeNotifications } from '@/services/notificationsFake';
