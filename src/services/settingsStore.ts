import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { BUFFER_LIMITS, isOffsetDateTime } from '@/domain/appointment';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import type { Settings } from '@/types';

export const SETTINGS_KEY = 'settings.v1';

/**
 * Boundary parser for stored settings (PRINCIPLES #7). Each field falls back to its default on
 * its own, so one bad value never resets the others.
 */
const SettingsSchema = z.object({
  defaultIntensity: z.enum(['mild', 'spicy', 'savage']).catch(DEFAULT_SETTINGS.defaultIntensity),
  defaultBufferMinutes: z
    .number()
    .int()
    .min(BUFFER_LIMITS.min)
    .max(BUFFER_LIMITS.max)
    .catch(DEFAULT_SETTINGS.defaultBufferMinutes),
  mutedUntil: z
    .string()
    .refine(isOffsetDateTime, 'mutedUntil must be an ISO date-time with offset')
    .nullable()
    .catch(DEFAULT_SETTINGS.mutedUntil),
});

// Compile-time check that the schema and the `Settings` type describe the same shape, both ways.
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
export type SchemaMatchesSettings = Assert<Equals<z.infer<typeof SettingsSchema>, Settings>>;

/**
 * Parses stored JSON into settings. Missing or invalid fields take their defaults; unreadable
 * JSON or a non-object yields the defaults. Never throws. An expired `mutedUntil` is kept as it
 * is: `isMuted` compares it with `now`.
 */
export function parseSettings(raw: string | null): Settings {
  if (raw === null) return { ...DEFAULT_SETTINGS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ...DEFAULT_SETTINGS };
  }
  return SettingsSchema.parse(data);
}

export async function loadSettings(): Promise<Settings> {
  return parseSettings(await AsyncStorage.getItem(SETTINGS_KEY));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
