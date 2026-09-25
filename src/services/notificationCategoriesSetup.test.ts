import { hasCategory, registerCategories, type CategoryApi } from './notificationCategoriesSetup';

/** A fake whose registrations resolve only when the test says so, and whose read-back is set. */
function fakeApi(readBacks: string[][]) {
  const events: string[] = [];
  const pending: (() => void)[] = [];
  const api: jest.Mocked<CategoryApi> = {
    setNotificationCategoryAsync: jest.fn(
      (id: string, _actions: Parameters<CategoryApi['setNotificationCategoryAsync']>[1]) =>
        new Promise<unknown>((resolve) => {
          events.push(`start ${id}`);
          pending.push(() => {
            events.push(`end ${id}`);
            resolve({ identifier: id });
          });
        }),
    ),
    getNotificationCategoriesAsync: jest.fn(async () =>
      (readBacks.shift() ?? []).map((identifier) => ({ identifier })),
    ),
  };
  /** Resolves registrations as they come, until `done` settles. */
  const drive = async (done: Promise<void>) => {
    let finished = false;
    void done.finally(() => {
      finished = true;
    });
    while (!finished) {
      await new Promise<void>((r) => setImmediate(() => r()));
      pending.shift()?.();
    }
    return done;
  };
  return { api, events, drive };
}

describe('registerCategories', () => {
  afterEach(() => jest.restoreAllMocks());
  it('registers one category at a time (the next starts only after the last resolved)', async () => {
    const { api, events, drive } = fakeApi([['nagSeries', 'nagSupportive']]);
    await drive(registerCategories(api, false));
    expect(events).toEqual([
      'start nagSeries',
      'end nagSeries',
      'start nagSupportive',
      'end nagSupportive',
    ]);
    expect(api.setNotificationCategoryAsync.mock.calls.map((c) => c[1])).toEqual([
      [
        { identifier: 'left', buttonTitle: 'I’ve left', options: { opensAppToForeground: true } },
        {
          identifier: 'stuck',
          buttonTitle: 'I’m genuinely stuck',
          options: { opensAppToForeground: true },
        },
      ],
      [{ identifier: 'left', buttonTitle: 'I’ve left', options: { opensAppToForeground: true } }],
    ]);
  });

  it('re-registers a category missing from the read-back once, then stops', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { api, drive } = fakeApi([['nagSupportive'], ['nagSupportive', 'nagSeries']]);
    await drive(registerCategories(api, false));
    expect(api.setNotificationCategoryAsync.mock.calls.map((c) => c[0])).toEqual([
      'nagSeries',
      'nagSupportive',
      'nagSeries',
    ]);
    expect(api.getNotificationCategoriesAsync).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns, naming the ids, when a category is still missing after the retry', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { api, drive } = fakeApi([['nagSupportive'], ['nagSupportive']]);
    await drive(registerCategories(api, false));
    expect(api.setNotificationCategoryAsync).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith('Notification buttons are missing for categories: nagSeries');
  });

  it('counts an Expo Go scoped id as present', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { api, drive } = fakeApi([['@user/app-nagSeries', '@user/app-nagSupportive']]);
    await drive(registerCategories(api, false));
    expect(api.setNotificationCategoryAsync).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs the ids read back in development only', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const dev = fakeApi([['nagSeries', 'nagSupportive']]);
    await dev.drive(registerCategories(dev.api, true));
    expect(log).toHaveBeenCalledWith('[nag] notification categories: nagSeries, nagSupportive');
    log.mockClear();
    const prod = fakeApi([['nagSeries', 'nagSupportive']]);
    await prod.drive(registerCategories(prod.api, false));
    expect(log).not.toHaveBeenCalled();
  });
});

describe('hasCategory', () => {
  it('matches exactly or as a scoped suffix', () => {
    expect(hasCategory(['nagSeries'], 'nagSeries')).toBe(true);
    expect(hasCategory(['@user/app-nagSeries'], 'nagSeries')).toBe(true);
    expect(hasCategory(['nagSupportive'], 'nagSeries')).toBe(false);
    expect(hasCategory([], 'nagSeries')).toBe(false);
  });
});
