import type { PlannedNotification } from '@/domain/notificationPlan';

import {
  CHANNEL_ID,
  createNotificationsPort,
  loadNotificationsApi,
  toResponse,
  type NotificationsApi,
} from './notifications';
import type { NotificationsPort } from './notificationsPort';

const AT = new Date('2026-09-25T15:00:00-07:00');
const DEFAULT = 'expo.modules.notifications.actions.DEFAULT';
const IOS_GRANTED_LIKE = [3, 4];
const granted = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };

const planned: PlannedNotification = {
  key: 'series:a1:3',
  appointmentId: 'a1',
  step: 3,
  at: AT,
  title: 'Nag',
  body: 'Leave now.',
  category: 'nagSeries',
};

type ExpoResponse = Parameters<typeof toResponse>[0];
const expoResponse = (actionIdentifier: string) =>
  ({
    actionIdentifier,
    notification: { date: 1000, request: { identifier: 'series:a1:3' } },
  }) as unknown as ExpoResponse;

const fakeApi = (): jest.Mocked<NotificationsApi> =>
  ({
    scheduleNotificationAsync: jest.fn(async () => 'series:a1:3'),
    cancelScheduledNotificationAsync: jest.fn(async () => {}),
    getAllScheduledNotificationsAsync: jest.fn(async () => []),
    getPermissionsAsync: jest.fn(async () => granted),
    requestPermissionsAsync: jest.fn(async () => granted),
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationCategoryAsync: jest.fn(async (identifier: string) => ({
      identifier,
      actions: [],
    })),
    getNotificationCategoriesAsync: jest.fn(async () => [
      { identifier: 'nagSeries', actions: [] },
      { identifier: 'nagSupportive', actions: [] },
    ]),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    getLastNotificationResponse: jest.fn(() => null),
    clearLastNotificationResponse: jest.fn(),
    dismissNotificationAsync: jest.fn(async () => {}),
    getPresentedNotificationsAsync: jest.fn(async () => []),
    DEFAULT_ACTION: DEFAULT,
    DATE: 'date',
    HIGH_IMPORTANCE: 6,
    IOS_GRANTED_LIKE,
  }) as unknown as jest.Mocked<NotificationsApi>;

describe('loadNotificationsApi', () => {
  it('loads the deep build modules and registers the foreground handler at init', () => {
    const handler = jest.requireMock('expo-notifications/build/NotificationsHandler');
    handler.setNotificationHandler.mockClear();
    const api = loadNotificationsApi();
    expect(api?.scheduleNotificationAsync).toBe(
      jest.requireMock('expo-notifications/build/scheduleNotificationAsync')
        .scheduleNotificationAsync,
    );
    expect(api).toMatchObject({
      DATE: 'date',
      HIGH_IMPORTANCE: 6,
      IOS_GRANTED_LIKE: [3, 4],
      DEFAULT_ACTION: DEFAULT,
    });
    expect(api?.setNotificationCategoryAsync).toBe(
      jest.requireMock('expo-notifications/build/setNotificationCategoryAsync')
        .setNotificationCategoryAsync,
    );
    const emitter = jest.requireMock('expo-notifications/build/NotificationsEmitter');
    expect(api?.addNotificationResponseReceivedListener).toBe(
      emitter.addNotificationResponseReceivedListener,
    );
    expect(api?.getLastNotificationResponse).toBe(emitter.getLastNotificationResponse);
    expect(handler.setNotificationHandler).toHaveBeenCalledTimes(1);
    const behaviour = handler.setNotificationHandler.mock.calls[0][0].handleNotification();
    return expect(behaviour).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });

  it('guards the package root: the jest setup makes loading it throw', () => {
    expect(() => jest.requireMock('expo-notifications')).toThrow(/build\/<file>/);
  });

  it('falls back to an unavailable no-op port when the native side is missing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let port: NotificationsPort | undefined;
    jest.resetModules(); // drop mocks cached by the test above, so the throwing one is used
    jest.isolateModules(() => {
      jest.doMock('expo-notifications/build/scheduleNotificationAsync', () => {
        throw new Error("Cannot find native module 'ExpoNotificationScheduler'");
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh module registry
      port = require('./notifications').notifications;
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'Local notifications are unavailable on this device',
      expect.any(Error),
    );

    // The app keeps working: every call resolves, nothing is asked or scheduled.
    await expect(port?.setup()).resolves.toBeUndefined();
    await expect(port?.getPermission()).resolves.toBe('unavailable');
    await expect(port?.requestPermission()).resolves.toBe('unavailable');
    await expect(port?.listScheduled()).resolves.toEqual([]);
    await expect(port?.schedule(planned)).resolves.toBe(planned.key);
    await expect(port?.cancel('x')).resolves.toBeUndefined();
    await expect(port?.dismiss('x')).resolves.toBeUndefined();
    await expect(port?.listPresented()).resolves.toEqual([]);
    expect(port?.takeLastResponse()).toBeNull();
    port?.onResponse(() => {})();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('notifications port', () => {
  it('schedules a DATE trigger on the nag channel with the key as identifier', async () => {
    const api = fakeApi();
    await createNotificationsPort(api).schedule(planned);
    expect(api.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'series:a1:3',
      content: {
        title: 'Nag',
        body: 'Leave now.',
        data: { at: AT.getTime(), category: 'nagSeries' },
        categoryIdentifier: 'nagSeries',
      },
      trigger: { type: 'date', date: AT, channelId: CHANNEL_ID },
    });
  });

  it('schedules a reminder without buttons with no category', async () => {
    const api = fakeApi();
    await createNotificationsPort(api).schedule({ ...planned, category: null });
    expect(api.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { title: 'Nag', body: 'Leave now.', data: { at: AT.getTime() } },
      }),
    );
  });

  it('creates the high-importance channel once', async () => {
    const api = fakeApi();
    const port = createNotificationsPort(api);
    await port.setup();
    await port.setup();
    expect(api.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    expect(api.setNotificationChannelAsync).toHaveBeenCalledWith(CHANNEL_ID, {
      name: 'Nags',
      importance: 6,
    });
  });

  it('registers both button categories once, every button opening the app', async () => {
    const api = fakeApi();
    const port = createNotificationsPort(api);
    await port.setup();
    await port.setup();
    const open = { opensAppToForeground: true };
    expect(api.setNotificationCategoryAsync.mock.calls).toEqual([
      [
        'nagSeries',
        [
          { identifier: 'left', buttonTitle: 'I’ve left', options: open },
          { identifier: 'stuck', buttonTitle: 'I’m genuinely stuck', options: open },
        ],
      ],
      ['nagSupportive', [{ identifier: 'left', buttonTitle: 'I’ve left', options: open }]],
    ]);
  });

  it('keeps going without buttons when categories fail, and retries on the next setup', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const api = fakeApi();
    api.setNotificationCategoryAsync.mockRejectedValueOnce(new Error('no categories'));
    const port = createNotificationsPort(api);
    await expect(port.setup()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Notification buttons are unavailable', expect.any(Error));
    await port.setup();
    // The first attempt stopped at its failing first call; the retry registers both.
    expect(api.setNotificationCategoryAsync).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('turns responses into our shape: a plain tap is "open"', () => {
    const api = fakeApi();
    const port = createNotificationsPort(api);
    const listener = jest.fn();
    const unsubscribe = port.onResponse(listener);
    const forward = api.addNotificationResponseReceivedListener.mock.calls[0][0];
    forward(expoResponse('left'));
    forward(expoResponse(DEFAULT));
    expect(listener.mock.calls).toEqual([
      [{ responseId: 'series:a1:3|1000|left', notificationId: 'series:a1:3', actionId: 'left' }],
      [{ responseId: 'series:a1:3|1000|open', notificationId: 'series:a1:3', actionId: 'open' }],
    ]);
    unsubscribe();
    const subscription = api.addNotificationResponseReceivedListener.mock.results[0].value;
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('clears the last response as the listener handles one, so iOS never hands it out again', () => {
    const api = fakeApi();
    createNotificationsPort(api).onResponse(() => {});
    const forward = api.addNotificationResponseReceivedListener.mock.calls[0][0];
    forward(expoResponse('left'));
    expect(api.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it('lists the identifiers of presented notifications', async () => {
    const api = fakeApi();
    api.getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { identifier: 'series:a1:1' } },
      { request: { identifier: 'other' } },
    ]);
    expect(await createNotificationsPort(api).listPresented()).toEqual(['series:a1:1', 'other']);
  });

  it('hands out the cold-start response once, clearing it', () => {
    const api = fakeApi();
    api.getLastNotificationResponse.mockReturnValueOnce(expoResponse('stuck'));
    const port = createNotificationsPort(api);
    expect(port.takeLastResponse()).toMatchObject({ actionId: 'stuck' });
    expect(api.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
    expect(port.takeLastResponse()).toBeNull();
  });

  it('reads no cold-start response when the native call throws', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const api = fakeApi();
    api.getLastNotificationResponse.mockImplementationOnce(() => {
      throw new Error('unavailable');
    });
    expect(createNotificationsPort(api).takeLastResponse()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('dismisses a delivered notification by identifier', async () => {
    const api = fakeApi();
    await createNotificationsPort(api).dismiss('series:a1:3');
    expect(api.dismissNotificationAsync).toHaveBeenCalledWith('series:a1:3');
  });

  it('lists and cancels by identifier', async () => {
    const api = fakeApi();
    api.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      {
        identifier: 'series:a1:3',
        content: { title: 'Nag', body: 'Leave now.', data: { at: AT.getTime() } },
        trigger: null,
      } as never,
    ]);
    const port = createNotificationsPort(api);
    expect(await port.listScheduled()).toEqual([
      { id: 'series:a1:3', at: AT, body: 'Leave now.', category: null },
    ]);
    await port.cancel('series:a1:3');
    expect(api.cancelScheduledNotificationAsync).toHaveBeenCalledWith('series:a1:3');
  });
});
