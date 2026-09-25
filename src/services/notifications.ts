/* eslint-disable @typescript-eslint/no-require-imports -- lazy, guarded loading is the point here */
import type {
  AndroidImportance,
  NotificationChannelInput,
} from 'expo-notifications/build/NotificationChannelManager.types';
import type {
  IosAuthorizationStatus,
  NotificationPermissionsStatus,
} from 'expo-notifications/build/NotificationPermissions.types';
import type { NotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import type {
  NotificationAction,
  NotificationCategory,
  NotificationRequest,
  NotificationRequestInput,
  NotificationResponse as ExpoNotificationResponse,
  SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types';
import { z } from 'zod';

import type { NotificationResponse } from '@/domain/notificationActions';
import type { PlannedNotification, ScheduledNotification } from '@/domain/notificationPlan';

import { registerCategories } from './notificationCategoriesSetup';
import {
  unavailableNotifications,
  type NotificationPermission,
  type NotificationsPort,
} from './notificationsPort';

/** Android channel for every nag (high importance, so they pop up as heads-up notifications). */
export const CHANNEL_ID = 'nag';

/**
 * The slice of expo-notifications we use. Each function comes from its own
 * `expo-notifications/build/<file>` module, never the package root: the root's
 * `DevicePushTokenAutoRegistration.fx` side effect throws in Expo Go on Android (push was removed
 * there in SDK 53), and local notifications must keep working. scripts/check-architecture.mjs
 * enforces the deep paths and traces their require graphs (docs/ARCHITECTURE.md).
 */
export interface NotificationsApi {
  scheduleNotificationAsync: (request: NotificationRequestInput) => Promise<string>;
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  getAllScheduledNotificationsAsync: () => Promise<NotificationRequest[]>;
  getPermissionsAsync: () => Promise<NotificationPermissionsStatus>;
  requestPermissionsAsync: () => Promise<NotificationPermissionsStatus>;
  setNotificationHandler: (handler: NotificationHandler | null) => void;
  setNotificationChannelAsync: (id: string, channel: NotificationChannelInput) => Promise<unknown>;
  setNotificationCategoryAsync: (
    id: string,
    actions: NotificationAction[],
  ) => Promise<NotificationCategory>;
  getNotificationCategoriesAsync: () => Promise<NotificationCategory[]>;
  addNotificationResponseReceivedListener: (
    listener: (response: ExpoNotificationResponse) => void,
  ) => { remove: () => void };
  getLastNotificationResponse: () => ExpoNotificationResponse | null;
  clearLastNotificationResponse: () => void;
  dismissNotificationAsync: (id: string) => Promise<void>;
  getPresentedNotificationsAsync: () => Promise<{ request: { identifier: string } }[]>;
  /** `actionIdentifier` of a plain tap on the notification (not a button). */
  DEFAULT_ACTION: string;
  DATE: SchedulableTriggerInputTypes.DATE;
  HIGH_IMPORTANCE: AndroidImportance;
  /** iOS statuses that count as granted (provisional, ephemeral). */
  IOS_GRANTED_LIKE: readonly IosAuthorizationStatus[];
}

/**
 * Loads the API, or null (with one warning) when the native side isn't there. Called once, during
 * this module's evaluation (see `notifications` below for why it must stay there).
 */
export function loadNotificationsApi(): NotificationsApi | null {
  try {
    const scheduling = require('expo-notifications/build/scheduleNotificationAsync');
    const cancelling = require('expo-notifications/build/cancelScheduledNotificationAsync');
    const listing = require('expo-notifications/build/getAllScheduledNotificationsAsync');
    const permissions = require('expo-notifications/build/NotificationPermissions');
    const handler = require('expo-notifications/build/NotificationsHandler');
    const channels = require('expo-notifications/build/setNotificationChannelAsync');
    const categories = require('expo-notifications/build/setNotificationCategoryAsync');
    const readCategories = require('expo-notifications/build/getNotificationCategoriesAsync');
    const emitter = require('expo-notifications/build/NotificationsEmitter');
    const dismissing = require('expo-notifications/build/dismissNotificationAsync');
    const presented = require('expo-notifications/build/getPresentedNotificationsAsync');
    const types = require('expo-notifications/build/Notifications.types');
    const channelTypes = require('expo-notifications/build/NotificationChannelManager.types');
    const permissionTypes = require('expo-notifications/build/NotificationPermissions.types');
    const api: NotificationsApi = {
      scheduleNotificationAsync: scheduling.scheduleNotificationAsync,
      cancelScheduledNotificationAsync: cancelling.cancelScheduledNotificationAsync,
      getAllScheduledNotificationsAsync: listing.getAllScheduledNotificationsAsync,
      getPermissionsAsync: permissions.getPermissionsAsync,
      requestPermissionsAsync: permissions.requestPermissionsAsync,
      setNotificationHandler: handler.setNotificationHandler,
      setNotificationChannelAsync: channels.setNotificationChannelAsync,
      setNotificationCategoryAsync: categories.setNotificationCategoryAsync,
      getNotificationCategoriesAsync: readCategories.getNotificationCategoriesAsync,
      addNotificationResponseReceivedListener: emitter.addNotificationResponseReceivedListener,
      getLastNotificationResponse: emitter.getLastNotificationResponse,
      clearLastNotificationResponse: emitter.clearLastNotificationResponse,
      dismissNotificationAsync: dismissing.dismissNotificationAsync,
      getPresentedNotificationsAsync: presented.getPresentedNotificationsAsync,
      DEFAULT_ACTION: emitter.DEFAULT_ACTION_IDENTIFIER,
      DATE: types.SchedulableTriggerInputTypes.DATE,
      HIGH_IMPORTANCE: channelTypes.AndroidImportance.HIGH,
      IOS_GRANTED_LIKE: [
        permissionTypes.IosAuthorizationStatus.PROVISIONAL,
        permissionTypes.IosAuthorizationStatus.EPHEMERAL,
      ],
    };
    // Registered at init: without a handler, nags that fire while the app is open aren't shown.
    api.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    return api;
  } catch (error) {
    console.warn('Local notifications are unavailable on this device', error);
    return null;
  }
}

/** When the OS reports it; iOS turns DATE triggers into relative intervals, so data carries it. */
const PayloadSchema = z.object({ at: z.number().finite() });
/** Our own copy of the category: Expo Go may scope `categoryIdentifier` when it reads it back. */
const CategorySchema = z.object({ category: z.string() });
const DateTriggerSchema = z.object({ type: z.literal('date'), value: z.number().finite() });

/**
 * Builds the port on an API (or none). Every method is a no-op and permission is `unavailable`
 * when the API couldn't load, so the app stays usable (PRINCIPLES #5).
 */
export function createNotificationsPort(api: NotificationsApi | null): NotificationsPort {
  let channel: Promise<unknown> | null = null;
  let categories: Promise<unknown> | null = null;
  if (!api) return unavailableNotifications;
  return {
    // Resolves to null on iOS. On Android 13+ a channel must exist before asking permission.
    setup: async () => {
      channel ??= api
        .setNotificationChannelAsync(CHANNEL_ID, { name: 'Nags', importance: api.HIGH_IMPORTANCE })
        .catch((error: unknown) => {
          channel = null;
          throw error;
        });
      // One at a time, then verified (see registerCategories for the iOS race this avoids).
      categories ??= registerCategories(api).catch((error: unknown) => {
        categories = null; // try again on the next setup
        console.warn('Notification buttons are unavailable', error);
      });
      await Promise.all([channel, categories]);
    },
    getPermission: async () => toPermission(await api.getPermissionsAsync(), api.IOS_GRANTED_LIKE),
    requestPermission: async () =>
      toPermission(await api.requestPermissionsAsync(), api.IOS_GRANTED_LIKE),
    listScheduled: async () => (await api.getAllScheduledNotificationsAsync()).map(toScheduled),
    schedule: (planned: PlannedNotification) =>
      api.scheduleNotificationAsync({
        identifier: planned.key,
        content: {
          title: planned.title,
          body: planned.body,
          data: {
            at: planned.at.getTime(),
            ...(planned.category ? { category: planned.category } : {}),
          },
          ...(planned.category ? { categoryIdentifier: planned.category } : {}),
        },
        trigger: { type: api.DATE, date: planned.at, channelId: CHANNEL_ID },
      }),
    cancel: (id) => api.cancelScheduledNotificationAsync(id),
    dismiss: (id) => api.dismissNotificationAsync(id),
    listPresented: async () =>
      (await api.getPresentedNotificationsAsync()).map((n) => n.request.identifier),
    onResponse: (listener) => {
      const subscription = api.addNotificationResponseReceivedListener((raw) => {
        // Handled here, so iOS mustn't hand it out again as the "last response" on a later launch.
        clearLast(api);
        listener(toResponse(raw, api.DEFAULT_ACTION));
      });
      return () => subscription.remove();
    },
    takeLastResponse: () => {
      try {
        const raw = api.getLastNotificationResponse();
        if (raw) api.clearLastNotificationResponse();
        return raw ? toResponse(raw, api.DEFAULT_ACTION) : null;
      } catch (error) {
        console.warn('Could not read the notification that opened the app', error);
        return null;
      }
    },
  };
}

function clearLast(api: NotificationsApi): void {
  try {
    api.clearLastNotificationResponse();
  } catch (error) {
    console.warn('Could not clear the last notification response', error);
  }
}

/** A plain tap (the OS default action) becomes `open`; button ids pass through unchanged. */
export function toResponse(
  raw: ExpoNotificationResponse,
  defaultAction: string,
): NotificationResponse {
  const notificationId = raw.notification.request.identifier;
  const actionId = raw.actionIdentifier === defaultAction ? 'open' : raw.actionIdentifier;
  return {
    responseId: `${notificationId}|${raw.notification.date}|${actionId}`,
    notificationId,
    actionId,
  };
}

/**
 * Granted (iOS provisional/ephemeral count) → `granted`. Otherwise `canAskAgain` decides: Android
 * 13+ reports `denied` + `canAskAgain: true` before the first prompt, so that is `undetermined`.
 */
export function toPermission(
  status: NotificationPermissionsStatus,
  iosGrantedLike: readonly IosAuthorizationStatus[],
): NotificationPermission {
  const iosStatus = status.ios?.status;
  if (status.granted || (iosStatus !== undefined && iosGrantedLike.includes(iosStatus))) {
    return 'granted';
  }
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * The identifier is the key (set when scheduling), so it never depends on the payload. `at`
 * comes from an Android DATE trigger (`{ type: 'date', value }`), else from `data.at` (iOS
 * reports a relative interval), else is unknown (an invalid Date: the diff reschedules it).
 * `category` comes from `data.category`; none (e.g. scheduled before F007) → null.
 */
export function toScheduled(request: NotificationRequest): ScheduledNotification {
  const trigger = DateTriggerSchema.safeParse(request.trigger);
  const payload = PayloadSchema.safeParse(request.content.data);
  const at = trigger.success ? trigger.data.value : payload.success ? payload.data.at : NaN;
  const category = CategorySchema.safeParse(request.content.data);
  return {
    id: request.identifier,
    at: new Date(at),
    body: request.content.body ?? '',
    category: category.success ? category.data.category : null,
  };
}

/**
 * expo-notifications adapter (iOS/Android). Web uses notifications.web.ts.
 *
 * Keep this call here, at module evaluation: the deep `require`s in `loadNotificationsApi` must run
 * nested inside this module's own evaluation. If they move into a callback or a first-use getter,
 * Metro treats a native-module throw during that later require as fatal, and the try/catch no
 * longer keeps the app alive (Expo Go without the native module).
 */
export const notifications: NotificationsPort = createNotificationsPort(loadNotificationsApi());
