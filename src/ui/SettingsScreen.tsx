import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BUFFER_LIMITS } from '@/domain/appointment';
import { isMuted } from '@/domain/settings';
import { useSettings } from '@/state/settings';
import { useNow } from '@/state/useNow';

import { IntensityChips } from './components/IntensityChips';
import { Nag } from './components/Nag';
import { Stepper } from './components/Stepper';
import { Toggle } from './components/Toggle';
import { INTENSITY_TONE, TONE } from './tone';

export const SAVE_ERROR = 'Couldn’t save. Try again.';
export const MUTE_OFF_HINT = 'Silence Nag until midnight';
export const MUTE_ON_HINT = 'Nag stays quiet until midnight';

/**
 * Settings (docs/design/screens/settings.png): default meanness and buffer for new appointments,
 * and "mute today". Supportive mode, calendar, home location, emergency escalation and the version
 * badge are out of scope (docs/design/README.md, later features).
 */
export function SettingsScreen() {
  const settings = useSettings((s) => s.settings);
  const loadError = useSettings((s) => s.loadError);
  const clock = useSettings((s) => s.clock);
  const now = useNow(15_000, clock);
  const muted = isMuted(settings, now);
  const [saveError, setSaveError] = useState(false);
  const tone = INTENSITY_TONE[settings.defaultIntensity];

  const save = (action: () => Promise<void>) => {
    setSaveError(false);
    action().catch(() => setSaveError(true));
  };
  const { setDefaultIntensity, adjustDefaultBuffer, muteToday, unmute } = useSettings.getState();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 px-4 pb-8 pt-4">
        <Text className="text-display text-ink" role="heading">
          Settings
        </Text>

        <Card>
          <View className="flex-row items-center gap-4 p-4">
            <View className="h-14 w-14 items-center justify-center rounded-card border border-line bg-bg">
              <Nag tone={tone} size={44} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-headline text-ink">Configure your tormentor.</Text>
              <Text className="text-label text-ink-muted">
                Tough love, automated schedule discipline.
              </Text>
            </View>
          </View>
        </Card>

        {loadError ? (
          <Text role="alert" className="px-1 text-label text-tone-rude">
            {loadError}
          </Text>
        ) : null}

        <View className="gap-2">
          <Card>
            <View className="gap-3 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
                  Default meanness
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <View className={`h-1.5 w-1.5 rounded-full ${TONE[tone].bg}`} />
                  <Text className={`text-caption font-medium ${TONE[tone].text}`}>
                    Current: {capitalise(settings.defaultIntensity)}
                  </Text>
                </View>
              </View>
              <IntensityChips
                value={settings.defaultIntensity}
                onChange={(v) => save(() => setDefaultIntensity(v))}
              />
            </View>
            <View className="mx-4 h-px bg-line" />
            <Stepper
              label="Default buffer"
              hint="Extra slack before you have to leave"
              value={settings.defaultBufferMinutes}
              {...BUFFER_LIMITS}
              // The stepper reports a value; the store takes the step, so quick taps add up.
              onChange={(v) => save(() => adjustDefaultBuffer(v - settings.defaultBufferMinutes))}
            />
          </Card>
          <Text className="px-1 text-caption text-ink-muted">
            New appointments start with these. Existing ones keep their own.
          </Text>
        </View>

        <Card>
          <View className="flex-row items-center justify-between gap-4 px-4 py-3.5">
            <View className="flex-1">
              <Text className="text-headline text-ink">Mute Nag for today</Text>
              <Text className="text-label text-ink-muted">
                {muted ? MUTE_ON_HINT : MUTE_OFF_HINT}
              </Text>
            </View>
            <Toggle
              label="Mute Nag for today"
              value={muted}
              onChange={(on) => save(on ? muteToday : unmute)}
            />
          </View>
        </Card>

        {saveError && !loadError ? (
          <Text role="alert" className="px-1 text-label text-tone-rude">
            {SAVE_ERROR}
          </Text>
        ) : null}

        <Text className="pt-4 text-center text-label text-ink-muted">
          Nag mocks your lateness, never you.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-card border border-line bg-surface">{children}</View>
  );
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
