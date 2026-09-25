import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS } from '@/domain/settings';
import type { Settings } from '@/types';

import { SETTINGS_KEY, loadSettings, parseSettings, saveSettings } from './settingsStore';

const custom: Settings = {
  defaultIntensity: 'savage',
  defaultBufferMinutes: 15,
  mutedUntil: '2026-09-26T00:00:00-07:00',
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('settingsStore', () => {
  it('returns the defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings under settings.v1', async () => {
    await saveSettings(custom);
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? '')).toEqual(custom);
    expect(await loadSettings()).toEqual(custom);
  });

  it('falls back to the default field by field', () => {
    const raw = JSON.stringify({
      defaultIntensity: 'nuclear',
      defaultBufferMinutes: 15,
      mutedUntil: '2026-09-26T00:00:00-07:00',
    });
    expect(parseSettings(raw)).toEqual({ ...custom, defaultIntensity: 'spicy' });
    expect(parseSettings(JSON.stringify({ ...custom, defaultBufferMinutes: 121 }))).toEqual({
      ...custom,
      defaultBufferMinutes: 5,
    });
    expect(parseSettings(JSON.stringify({ ...custom, defaultBufferMinutes: 2.5 }))).toEqual({
      ...custom,
      defaultBufferMinutes: 5,
    });
    expect(parseSettings(JSON.stringify({ ...custom, mutedUntil: 'tonight' }))).toEqual({
      ...custom,
      mutedUntil: null,
    });
    expect(parseSettings(JSON.stringify({ ...custom, mutedUntil: '2026-09-26T00:00:00' }))).toEqual(
      { ...custom, mutedUntil: null },
    );
    expect(parseSettings(JSON.stringify({ defaultBufferMinutes: 30 }))).toEqual({
      ...DEFAULT_SETTINGS,
      defaultBufferMinutes: 30,
    });
  });

  it('keeps an expired mutedUntil (isMuted decides) and drops unknown fields', () => {
    const raw = JSON.stringify({ ...custom, mutedUntil: '2020-01-01T00:00:00Z', extra: 1 });
    expect(parseSettings(raw)).toEqual({ ...custom, mutedUntil: '2020-01-01T00:00:00Z' });
  });

  it.each(['not json{', '[]', '42', 'null', '"spicy"'])(
    'returns the defaults for unusable storage %p',
    (raw) => {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    },
  );
});
