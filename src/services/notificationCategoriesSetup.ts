import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategoryDefinition,
} from '@/domain/notificationCategories';

/**
 * The slice of expo-notifications that category setup needs (notifications.ts passes the real
 * one; tests pass a fake). Only notifications.ts may import expo-notifications itself.
 */
export interface CategoryApi {
  setNotificationCategoryAsync: (
    id: string,
    actions: {
      identifier: string;
      buttonTitle: string;
      options: { opensAppToForeground: boolean };
    }[],
  ) => Promise<unknown>;
  getNotificationCategoriesAsync: () => Promise<{ identifier: string }[]>;
}

/**
 * True when `id` is among the ids read back: exactly, or as a suffix, because Expo Go scopes
 * category ids with a per-project prefix (e.g. `@user/app-nagSeries`).
 */
export function hasCategory(readBack: readonly string[], id: string): boolean {
  return readBack.some((r) => r === id || r.endsWith(id));
}

/**
 * Registers the action-button categories one at a time, then reads them back.
 *
 * Sequential on purpose: on iOS, expo-notifications' `CategoryManager` is a Swift actor whose
 * `setCategory` awaits `loadCategories()` before `setNotificationCategories`. Actors are re-entrant
 * at awaits, so two concurrent calls can both read the old set and the last write wins, dropping
 * the other category (docs/exec-plans F007, device check). A category still missing after one
 * retry is reported with `console.warn`; in development the ids read back are logged once. Throws
 * only if the native calls throw (the caller logs it and keeps scheduling without buttons).
 */
export async function registerCategories(
  api: CategoryApi,
  devLog: boolean = __DEV__,
): Promise<void> {
  const register = async (defs: readonly NotificationCategoryDefinition[]) => {
    for (const c of defs) {
      await api.setNotificationCategoryAsync(
        c.id,
        // Every button opens the app, so the response handler runs even after a kill (F007).
        c.actions.map((a) => ({
          identifier: a.id,
          buttonTitle: a.title,
          options: { opensAppToForeground: true },
        })),
      );
    }
  };
  const check = async () => {
    const readBack = (await api.getNotificationCategoriesAsync()).map((c) => c.identifier);
    const missing = NOTIFICATION_CATEGORIES.filter((c) => !hasCategory(readBack, c.id));
    return { readBack, missing };
  };

  await register(NOTIFICATION_CATEGORIES);
  let result = await check();
  if (result.missing.length > 0) {
    await register(result.missing);
    result = await check();
  }
  if (devLog) {
    console.log(`[nag] notification categories: ${result.readBack.join(', ') || '(none)'}`);
  }
  if (result.missing.length > 0) {
    console.warn(
      `Notification buttons are missing for categories: ${result.missing.map((c) => c.id).join(', ')}`,
    );
  }
}
