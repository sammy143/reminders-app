import { formatISO } from 'date-fns';
import { create } from 'zustand';

import { DEFAULT_SETTINGS, adjustBuffer, muteUntilMidnight } from '@/domain/settings';
import { loadSettings, saveSettings } from '@/services/settingsStore';
import type { Intensity, Settings } from '@/types';

import { systemClock, type Clock } from './clock';

interface SettingsState {
  settings: Settings;
  /** Where "now" comes from for "mute today". Tests set a fixed one. */
  clock: Clock;
  /** True once loading finished, whether it worked or not. */
  hydrated: boolean;
  /**
   * Set when stored settings couldn't be read; a later successful load clears it. While set, the
   * defaults are shown but nothing is saved (so they never overwrite stored settings) and
   * notifications aren't synced (the stored mute is unknown).
   */
  loadError: string | null;
  /** Loads stored settings. Later calls share the same promise; after a failure the next retries. */
  hydrate: () => Promise<void>;
  setDefaultIntensity: (intensity: Intensity) => Promise<void>;
  /** A stepper tap: moves the default buffer by `delta` minutes, within the appointment limits. */
  adjustDefaultBuffer: (delta: number) => Promise<void>;
  /**
   * "Mute today" (PLAN rule 5): no nags until the next local midnight. The appointments store
   * re-syncs notifications when `mutedUntil` changes, which cancels today's series.
   */
  muteToday: () => Promise<void>;
  /** Ends the mute; the next sync re-plans the remaining future steps (never a due one). */
  unmute: () => Promise<void>;
}

export const SETTINGS_LOAD_ERROR = 'Couldn’t load your settings. Try again.';

let hydrating: Promise<void> | null = null;
let saving: Promise<void> = Promise.resolve();

export const useSettings = create<SettingsState>()((set, get) => {
  /**
   * Saves, then applies (the appointments store's pattern): if saving fails the state is left as
   * it was and the error propagates. Changes run one at a time, in order, each computed from the
   * last applied state (two quick stepper taps both count). Refused while stored settings couldn't
   * be read (the change retries the load first), so defaults never overwrite them.
   */
  const change = (patch: (current: Settings) => Partial<Settings>) => {
    const run = async () => {
      await get().hydrate();
      if (get().loadError) throw new Error(SETTINGS_LOAD_ERROR);
      const current = get().settings;
      const next = { ...current, ...patch(current) };
      await saveSettings(next);
      set({ settings: next });
    };
    const result = saving.then(run);
    saving = result.catch(() => {});
    return result;
  };

  const load = async () => {
    try {
      set({ settings: await loadSettings(), hydrated: true, loadError: null });
    } catch {
      hydrating = null;
      set({ hydrated: true, loadError: SETTINGS_LOAD_ERROR });
    }
  };

  return {
    settings: DEFAULT_SETTINGS,
    clock: systemClock,
    hydrated: false,
    loadError: null,
    hydrate: () => (hydrating ??= load()),
    setDefaultIntensity: (defaultIntensity) => change(() => ({ defaultIntensity })),
    adjustDefaultBuffer: (delta) =>
      change((current) => ({
        defaultBufferMinutes: adjustBuffer(current.defaultBufferMinutes, delta),
      })),
    muteToday: () => change(() => ({ mutedUntil: formatISO(muteUntilMidnight(get().clock())) })),
    unmute: () => change(() => ({ mutedUntil: null })),
  };
});

/**
 * Test helper: forget loaded state so the next `hydrate()` reads storage again, and use `clock`
 * as "now" (required, so tests can't fall back to the real clock).
 */
export function resetSettingsForTests(clock: Clock): void {
  hydrating = null;
  saving = Promise.resolve();
  useSettings.setState({ settings: DEFAULT_SETTINGS, hydrated: false, loadError: null, clock });
}
