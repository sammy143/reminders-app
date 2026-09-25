import { Pressable, Text, View } from 'react-native';

import type { CardStatus } from '@/domain/today';
import type { Appointment } from '@/types';

import { formatShortTime, formatTime } from '../format';
import { TONE } from '../tone';
import { Nag } from './Nag';

interface AppointmentCardProps {
  appointment: Appointment;
  status: CardStatus;
  onPress: () => void;
}

const MARK_BADGE = { left: 'Left ✓', stuck: 'Stuck' } as const;

/**
 * Home card: tone edge bar, title + in-person/online badge, "Leave by h:mm · <countdown>" (only
 * the countdown in the tone colour, per DESIGN.md), start time and a small Nag. Muted with no
 * subline once the series is over (F005 plan). After "I've left" the badge reads "Left ✓" (in
 * `tone-done`, not muted); after "I'm genuinely stuck" it reads "Stuck" (supportive) and the
 * subline is the neutral "starts at h:mm" instead of the countdown (F007).
 */
export function AppointmentCard({ appointment: a, status, onPress }: AppointmentCardProps) {
  const t = TONE[status.tone];
  const over = status.cue === null;
  const muted = over && status.mark !== 'left';
  const badge = status.mark ? MARK_BADGE[status.mark] : a.inPerson ? 'In person' : 'Online';
  const stuck = status.mark === 'stuck';
  // Once stuck there is no leave-by pressure: the subline is just "starts at h:mm".
  const lead = stuck ? null : a.inPerson ? `Leave by ${formatShortTime(status.leaveBy)}` : 'Online';
  const start = formatTime(new Date(a.startsAt));
  // The badge already says "Online", so an online card's label skips the repeated lead; a stuck
  // card's label ends with its start time already, so it skips the neutral cue.
  const cueLabel = over || stuck ? null : a.inPerson ? `${lead}, ${status.cue}` : status.cue;
  const label = [a.title, badge, cueLabel, `starts ${start}`].filter(Boolean).join(', ');
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      className={`flex-row overflow-hidden rounded-card border border-line bg-surface ${muted ? 'opacity-60' : ''}`}
    >
      <View className={`w-1.5 ${t.bg}`} />
      <View className="flex-1 flex-row items-start gap-3 p-4 pl-5">
        <View className="flex-1 gap-1.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-headline text-ink">{a.title}</Text>
            <View className={`rounded-full border px-2 py-0.5 ${t.border} ${t.tint}`}>
              <Text className={`text-caption font-semibold ${t.text}`}>{badge}</Text>
            </View>
          </View>
          {over ? null : (
            <Text className="text-label text-ink-muted">
              {lead ? `${lead} · ` : null}
              <Text className={`font-semibold ${t.text}`}>{status.cue}</Text>
            </Text>
          )}
        </View>
        <View className="items-end gap-2">
          <Text className="text-headline text-ink">{start}</Text>
          {over ? null : <Nag tone={status.tone} size={32} />}
        </View>
      </View>
    </Pressable>
  );
}
