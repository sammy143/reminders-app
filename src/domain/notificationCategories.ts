/**
 * Notification action buttons (F007). The ids travel through the OS and come back in a
 * response (notificationActions.ts); the adapter in services/ only translates these definitions.
 */
export type NotificationActionId = 'left' | 'stuck';

/**
 * Category ids. expo-notifications warns against `:` and `-` in them, so they are camelCase
 * (docs/exec-plans F007 "Decisions").
 */
export type NotificationCategoryId = 'nagSeries' | 'nagSupportive';

export const SERIES_CATEGORY: NotificationCategoryId = 'nagSeries';
export const SUPPORTIVE_CATEGORY: NotificationCategoryId = 'nagSupportive';

export const LEFT_TITLE = 'I’ve left';
export const STUCK_TITLE = 'I’m genuinely stuck';

export interface NotificationCategoryDefinition {
  id: NotificationCategoryId;
  actions: readonly { id: NotificationActionId; title: string }[];
}

/**
 * The ladder offers both buttons; once stuck, only "I've left" (stuck can't be undone in v1).
 * Both open the app so the handler always runs, even after the app was killed (F007 Decisions).
 */
export const NOTIFICATION_CATEGORIES: readonly NotificationCategoryDefinition[] = [
  {
    id: SERIES_CATEGORY,
    actions: [
      { id: 'left', title: LEFT_TITLE },
      { id: 'stuck', title: STUCK_TITLE },
    ],
  },
  { id: SUPPORTIVE_CATEGORY, actions: [{ id: 'left', title: LEFT_TITLE }] },
];
