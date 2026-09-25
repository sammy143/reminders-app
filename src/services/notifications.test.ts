import type { PlannedNotification } from '@/domain/notificationPlan';

import {
  CHANNEL_ID,
  createNotificationsPort,
  loadNotificationsApi,
  toPermission,
  toScheduled,
  type NotificationsApi,
} from './notifications';
import type { NotificationsPort } from './notificationsPort';

const AT = new Date('2026-09-25T15:00:00-07:00');
const IOS_GRANTED_LIKE = [3, 4];

const planned: PlannedNotification = {
  key: 'series:a1:3',
  appointmentId: 'a1',
  step: 3,
  at: AT,
  title: 'Nag',
  body: 'Leave now.',
};

type Status = Parameters<typeof toPermission>[0];
const status = (s: Partial<Record<keyof Status, unknown>>) =>
  ({ granted: false, status: 'undetermined', canAskAgain: true, expires: 'never', ...s }) as Status;

type Request = Parameters<typeof toScheduled>[0];
const request = (fields: { trigger?: unknown; data?: unknown; body?: string | null }) =>
  ({
    identifier: 'series:a1:3',
    content: {
      title: 'Nag',
      body: 'body' in fields ? fields.body : 'Leave now.',
      data: fields.data,
    },
    trigger: fields.trigger ?? null,
  }) as unknown as Request;

const fakeApi = (): jest.Mocked<NotificationsApi> =>
  ({
    scheduleNotificationAsync: jest.fn(async () => 'series:a1:3'),
    cancelScheduledNotificationAsync: jest.fn(async () => {}),
    getAllScheduledNotificationsAsync: jest.fn(async () => []),
    getPermissionsAsync: jest.fn(async () => status({ granted: true, status: 'granted' })),
    requestPermissionsAsync: jest.fn(async () => status({ granted: true, status: 'granted' })),
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
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
    expect(api).toMatchObject({ DATE: 'date', HIGH_IMPORTANCE: 6, IOS_GRANTED_LIKE: [3, 4] });
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
      content: { title: 'Nag', body: 'Leave now.', data: { at: AT.getTime() } },
      trigger: { type: 'date', date: AT, channelId: CHANNEL_ID },
    });
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

  it('lists and cancels by identifier', async () => {
    const api = fakeApi();
    api.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      request({ data: { at: AT.getTime() } }),
    ]);
    const port = createNotificationsPort(api);
    expect(await port.listScheduled()).toEqual([{ id: 'series:a1:3', at: AT, body: 'Leave now.' }]);
    await port.cancel('series:a1:3');
    expect(api.cancelScheduledNotificationAsync).toHaveBeenCalledWith('series:a1:3');
  });
});

describe('toPermission', () => {
  it.each([
    { name: 'granted', input: status({ granted: true, status: 'granted' }), expected: 'granted' },
    {
      name: 'iOS provisional',
      input: status({ ios: { status: 3 }, canAskAgain: false }),
      expected: 'granted',
    },
    { name: 'iOS never asked', input: status({ ios: { status: 0 } }), expected: 'undetermined' },
    {
      name: 'iOS denied',
      input: status({ status: 'denied', canAskAgain: false, ios: { status: 1 } }),
      expected: 'denied',
    },
    // Android 13+ (API 33) shapes: before the first prompt it already says denied.
    {
      name: 'API 33 before the first prompt, or after one no',
      input: status({ status: 'denied', canAskAgain: true, android: { importance: 3 } }),
      expected: 'undetermined',
    },
    {
      name: 'API 33 after "don\'t ask again"',
      input: status({ status: 'denied', canAskAgain: false, android: { importance: 3 } }),
      expected: 'denied',
    },
    {
      name: 'API 33 allowed',
      input: status({ status: 'granted', granted: true, android: { importance: 3 } }),
      expected: 'granted',
    },
  ])('maps $name to $expected', ({ input, expected }) => {
    expect(toPermission(input, IOS_GRANTED_LIKE)).toBe(expected);
  });
});

describe('toScheduled', () => {
  it('takes the time from an Android DATE trigger first', () => {
    const later = AT.getTime() + 60_000;
    const read = toScheduled(
      request({ trigger: { type: 'date', value: later, repeats: false }, data: { at: 1 } }),
    );
    expect(read).toEqual({ id: 'series:a1:3', at: new Date(later), body: 'Leave now.' });
  });

  it('falls back to data.at when iOS reports a relative interval', () => {
    const read = toScheduled(
      request({ trigger: { type: 'timeInterval', seconds: 120 }, data: { at: AT.getTime() } }),
    );
    expect(read.at).toEqual(AT);
  });

  it('keeps the identifier but marks the time unknown when neither says', () => {
    const read = toScheduled(request({ data: undefined, body: null }));
    expect(read.id).toBe('series:a1:3');
    expect(Number.isNaN(read.at.getTime())).toBe(true);
    expect(read.body).toBe('');
  });
});
