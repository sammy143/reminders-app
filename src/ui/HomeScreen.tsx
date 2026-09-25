import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { alarmUnderway } from '@/domain/alarm';
import { activeMute } from '@/domain/settings';
import { cardStatus, groupUpcoming, nextNagLine, type DayGroup } from '@/domain/today';
import { useAppointments } from '@/state/appointments';
import { useSettings } from '@/state/settings';
import { useNow } from '@/state/useNow';
import type { Appointment } from '@/types';

import { AppointmentCard } from './components/AppointmentCard';
import { Nag } from './components/Nag';
import { NagBubble } from './components/NagBubble';
import { formatDay, formatTime } from './format';
import { TONE } from './tone';

const IDLE_LINE = 'Nothing on the clock. Enjoy it while it lasts.';
export const MUTED_LINE = 'Muted until midnight. Enjoy the quiet.';
export const NOTIFICATIONS_OFF = 'Notifications are off. Nag can’t reach you.';
export const MUTED = 'Muted until midnight';

interface HomeScreenProps {
  onAdd: () => void;
  /** Opens the editor. */
  onOpen: (id: string) => void;
  /** Opens the alarm screen: for a card whose series is under way (`alarmUnderway`). */
  onAlarm: (id: string) => void;
}

/** Today list (docs/design/screens/home.png; the streak is a later feature). */
export function HomeScreen({ onAdd, onOpen, onAlarm }: HomeScreenProps) {
  const now = useNow(
    15_000,
    useAppointments((s) => s.clock),
  );
  const appointments = useAppointments((s) => s.appointments);
  const hydrated = useAppointments((s) => s.hydrated);
  const loadError = useAppointments((s) => s.loadError);
  const notificationsOff = useAppointments((s) => s.notificationPermission === 'denied');
  const mutedUntil = activeMute(
    useSettings((s) => s.settings),
    now,
  );
  const muted = mutedUntil !== null;
  const groups = groupUpcoming(appointments, now);
  // While muted, only lines that will really be delivered (from midnight on).
  const nag = nextNagLine(appointments, now, mutedUntil);
  const nagTone = nag?.tone ?? 'done';

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-28 pt-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Text className="text-display text-ink" role="heading">
              Today
            </Text>
            <View className="rounded-full bg-line px-3 py-1">
              <Text className="text-label text-ink-muted">{formatDay(now)}</Text>
            </View>
          </View>
          <Nag tone={nagTone} size={44} />
        </View>

        <NagBubble
          tone={nagTone}
          tail="right"
          heading={nag ? `${TONE[nag.tone].label} tone` : muted ? 'Muted' : 'Idle'}
          aside={nag && nag.at.getTime() > now.getTime() ? `at ${formatTime(nag.at)}` : undefined}
          line={nag?.text ?? (muted ? MUTED_LINE : IDLE_LINE)}
        />

        {muted ? <MutedBanner /> : null}
        {notificationsOff ? (
          <View className="rounded-button border border-line bg-surface px-4 py-3">
            <Text role="status" className="text-label text-ink-muted">
              {NOTIFICATIONS_OFF}
            </Text>
          </View>
        ) : null}
        {loadError ? (
          <Text role="alert" className="text-label text-tone-rude">
            {loadError} Try reopening the app.
          </Text>
        ) : null}
        {hydrated && !loadError && groups.length === 0 ? (
          <Text className="text-body text-ink-muted">Nothing to nag you about yet.</Text>
        ) : null}
        {groups.map((group) => (
          <DaySection
            key={group.day.toISOString()}
            group={group}
            now={now}
            onOpen={(a) => (alarmUnderway(a, now) ? onAlarm : onOpen)(a.id)}
          />
        ))}
      </ScrollView>

      <Pressable
        role="button"
        aria-label="Add appointment"
        onPress={onAdd}
        className="absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary"
      >
        <Text className="text-title text-surface">+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/** "Mute today" is on (F008): a quiet, non-blocking note with a way out. */
function MutedBanner() {
  const [failed, setFailed] = useState(false);
  const unmute = () => {
    setFailed(false);
    useSettings
      .getState()
      .unmute()
      .catch(() => setFailed(true));
  };
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-button border border-line bg-surface py-1 pl-4 pr-1">
      <Text role="status" className="flex-1 text-label text-ink-muted">
        {failed ? `${MUTED}. Couldn’t unmute, try again.` : MUTED}
      </Text>
      <Pressable
        role="button"
        onPress={unmute}
        hitSlop={4}
        className="min-h-[44px] justify-center px-3"
      >
        <Text className="text-label font-semibold text-ink">Unmute</Text>
      </Pressable>
    </View>
  );
}

function DaySection(props: { group: DayGroup; now: Date; onOpen: (appt: Appointment) => void }) {
  const { group, now } = props;
  const title =
    group.daysFromToday === 0
      ? 'Schedule'
      : group.daysFromToday === 1
        ? 'Tomorrow'
        : formatDay(group.day);
  const aside = group.daysFromToday === 0 ? `${group.remaining} remaining` : formatDay(group.day);
  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between px-1">
        <Text className="text-label font-semibold uppercase tracking-wider text-ink-muted">
          {title}
        </Text>
        {group.daysFromToday === 0 || group.daysFromToday === 1 ? (
          <Text className="text-label text-ink-muted">{aside}</Text>
        ) : null}
      </View>
      {group.appointments.map((a) => (
        <AppointmentCard
          key={a.id}
          appointment={a}
          status={cardStatus(a, now)}
          onPress={() => props.onOpen(a)}
        />
      ))}
    </View>
  );
}
