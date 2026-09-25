import { toPermission, toScheduled } from './notifications';

const AT = new Date('2026-09-25T15:00:00-07:00');
const IOS_GRANTED_LIKE = [3, 4];

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
    expect(read).toEqual({
      id: 'series:a1:3',
      at: new Date(later),
      body: 'Leave now.',
      category: null,
    });
  });

  it('falls back to data.at when iOS reports a relative interval', () => {
    const read = toScheduled(
      request({ trigger: { type: 'timeInterval', seconds: 120 }, data: { at: AT.getTime() } }),
    );
    expect(read.at).toEqual(AT);
  });

  it('reads the category from our payload', () => {
    const read = toScheduled(request({ data: { at: AT.getTime(), category: 'nagSupportive' } }));
    expect(read.category).toBe('nagSupportive');
  });

  it('keeps the identifier but marks the time unknown when neither says', () => {
    const read = toScheduled(request({ data: undefined, body: null }));
    expect(read.id).toBe('series:a1:3');
    expect(Number.isNaN(read.at.getTime())).toBe(true);
    expect(read.body).toBe('');
  });
});
