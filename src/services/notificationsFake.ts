import type { PlannedNotification, ScheduledNotification } from '@/domain/notificationPlan';

import type { NotificationPermission, NotificationsPort } from './notificationsPort';

export interface FakeNotifications extends NotificationsPort {
  /** Pending notifications by identifier, as the OS would hold them (same id replaces). */
  pending: Map<string, ScheduledNotification>;
  /** Permission `getPermission` reports; `requestPermission` turns `undetermined` into `answer`. */
  permission: NotificationPermission;
  answer: NotificationPermission;
  calls: { schedule: number; cancel: number; request: number; list: number };
  /** Like the OS delivering everything due at `now`: removes it from `pending`. */
  deliverUntil: (now: Date) => ScheduledNotification[];
  /** Pending identifiers sorted by time. */
  keys: () => string[];
}

/** In-memory notifications port for tests (docs/ARCHITECTURE.md "Testing"): no real notifications. */
export function createFakeNotifications(
  permission: NotificationPermission = 'granted',
): FakeNotifications {
  const fake: FakeNotifications = {
    pending: new Map(),
    permission,
    answer: 'granted',
    calls: { schedule: 0, cancel: 0, request: 0, list: 0 },
    setup: async () => {},
    getPermission: async () => fake.permission,
    requestPermission: async () => {
      fake.calls.request += 1;
      if (fake.permission === 'undetermined') fake.permission = fake.answer;
      return fake.permission;
    },
    listScheduled: async () => {
      fake.calls.list += 1;
      return [...fake.pending.values()];
    },
    schedule: async (p: PlannedNotification) => {
      fake.calls.schedule += 1;
      fake.pending.set(p.key, { id: p.key, at: p.at, body: p.body });
      return p.key;
    },
    cancel: async (id) => {
      fake.calls.cancel += 1;
      fake.pending.delete(id);
    },
    deliverUntil: (now) => {
      const due = [...fake.pending.values()].filter((n) => n.at.getTime() <= now.getTime());
      due.forEach((n) => fake.pending.delete(n.id));
      return due;
    },
    keys: () =>
      [...fake.pending.values()]
        .sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id))
        .map((n) => n.id),
  };
  return fake;
}
