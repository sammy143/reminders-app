import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { alarmView, type AlarmView } from '@/domain/alarm';
import { LEFT_TITLE, STUCK_TITLE } from '@/domain/notificationCategories';
import { useAppointments } from '@/state/appointments';
import { useNow } from '@/state/useNow';
import type { Appointment } from '@/types';

import { Nag } from './components/Nag';
import { ALARM_TONE, type AlarmColours } from './alarmTone';
import { formatTime } from './format';
import { TONE } from './tone';

export const SAVE_FAILED = 'Couldn’t save. Try again.';

interface AlarmScreenProps {
  id: string;
  /** Leaves the screen (the Back control, or after "I've left" / when there's nothing to show). */
  onBack: () => void;
}

/**
 * Late-to-leave takeover (docs/design/screens/active-alarm.png; docs/exec-plans F007): full tone
 * background, countdown, Nag, the current line, step dots, "I've left" and "I'm genuinely stuck".
 * Stuck shows the supportive state; left or over shows a calm confirmation with a Back button.
 * Text colours per tone come from `ALARM_TONE` (WCAG AA on every tone background).
 */
export function AlarmScreen({ id, onBack }: AlarmScreenProps) {
  const now = useNow(
    5_000,
    useAppointments((s) => s.clock),
  );
  const appt = useAppointments((s) => s.appointments.find((a) => a.id === id));
  const hydrated = useAppointments((s) => s.hydrated);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);

  if (!appt) {
    return (
      <Calm
        title={hydrated ? 'That appointment is gone.' : 'Loading…'}
        onBack={hydrated ? onBack : undefined}
      />
    );
  }

  const view = alarmView(appt, now);
  if (view.phase === 'left') {
    return (
      <Calm
        tone="done"
        title="Left ✓"
        body={`Nag’s done nagging about ${appt.title}. Go get there.`}
        onBack={onBack}
      />
    );
  }
  if (view.phase === 'over') {
    return (
      <Calm
        title="Nothing to nag about"
        body={`The series for ${appt.title} is over.`}
        onBack={onBack}
      />
    );
  }

  const act = async (action: 'leave' | 'stuck') => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      await useAppointments.getState()[action](appt.id);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <Takeover
      appt={appt}
      view={view}
      pending={pending}
      error={error}
      onBack={onBack}
      onLeft={() => void act('leave')}
      onStuck={() => void act('stuck')}
    />
  );
}

interface TakeoverProps {
  appt: Appointment;
  view: AlarmView;
  pending: boolean;
  error: boolean;
  onBack: () => void;
  onLeft: () => void;
  onStuck: () => void;
}

function Takeover({ appt, view, pending, error, onBack, onLeft, onStuck }: TakeoverProps) {
  const t = TONE[view.tone];
  const c = ALARM_TONE[view.tone];
  const stuck = view.phase === 'stuck';
  const { value, caption } = countdown(view.minutesPastLeaveBy);
  const stepLabel = progressLabel(view, t.label);
  return (
    <SafeAreaView className={`flex-1 ${t.bg}`} edges={['top', 'bottom']}>
      {c.scrim ? <View className={`absolute inset-0 ${c.scrim}`} aria-hidden /> : null}
      <View className="flex-1 justify-between px-6 pb-4 pt-1">
        <View className="flex-row items-center">
          <Pressable
            role="button"
            aria-label="Back to Today"
            onPress={onBack}
            hitSlop={8}
            className="min-h-[44px] w-16 justify-center"
          >
            <Text className={`text-label font-semibold ${c.text}`}>‹ Back</Text>
          </Pressable>
          <View className="flex-1 items-center">
            <View className={`rounded-full px-3.5 py-1.5 ${c.pill}`}>
              <Text className={`text-label font-semibold uppercase tracking-wider ${c.text}`}>
                {appt.title} · {formatTime(new Date(appt.startsAt))}
              </Text>
            </View>
          </View>
          <View className="w-16" />
        </View>

        <View className="items-center gap-5">
          <View className="items-center gap-1">
            <Text role="timer" className={`text-countdown ${c.text}`}>
              {value}
            </Text>
            <Text className={`text-body font-medium ${c.text}`}>{caption}</Text>
          </View>
          <Nag tone={view.tone} size={144} />
          <View className="w-full">
            <View className="-mb-2 h-3.5 w-3.5 rotate-45 self-center bg-surface" />
            <View className="rounded-card bg-surface p-4">
              <Text className="text-body text-ink">{view.line}</Text>
            </View>
          </View>
          <View className="items-center gap-2">
            {view.progress ? <StepDots {...view.progress} colours={c} /> : null}
            <Text className={`text-caption font-semibold uppercase tracking-wider ${c.text}`}>
              {stepLabel}
            </Text>
          </View>
        </View>

        <View className="items-center gap-3">
          {error ? (
            <Text role="alert" className={`text-label font-semibold ${c.text}`}>
              {SAVE_FAILED}
            </Text>
          ) : null}
          <Pressable
            role="button"
            aria-label={LEFT_TITLE}
            aria-disabled={pending}
            disabled={pending}
            onPress={onLeft}
            className="h-[52px] w-full flex-row items-center justify-center gap-2 rounded-button bg-surface"
          >
            <Text className="text-headline text-ink">{LEFT_TITLE}</Text>
            <Text className="text-headline text-ink">→</Text>
          </Pressable>
          {stuck ? null : (
            <Pressable
              role="button"
              aria-label={STUCK_TITLE}
              aria-disabled={pending}
              disabled={pending}
              onPress={onStuck}
              className={`min-h-[44px] justify-center rounded-full px-4 ${c.pill}`}
            >
              <Text className={`text-label font-semibold ${c.text}`}>{STUCK_TITLE}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * "Step 5 of 6 · Escalation: Savage" on the ladder; "Supportive · 1 of 2" once stuck (or just
 * "Supportive" when stuck came too late for any supportive nag).
 */
export function progressLabel(view: AlarmView, toneLabel: string): string {
  const p = view.progress;
  if (view.phase === 'stuck') return p ? `Supportive · ${p.current} of ${p.total}` : 'Supportive';
  return p ? `Step ${p.current} of ${p.total} · Escalation: ${toneLabel}` : '';
}

/** Dots: filled up to the current step, which also gets a ring (as in the mockup). */
function StepDots(props: { current: number; total: number; colours: AlarmColours }) {
  const { current: step, total, colours: c } = props;
  return (
    <View className="flex-row items-center gap-2" aria-hidden>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <View
          key={n}
          className={`items-center justify-center rounded-full ${
            n === step ? `h-5 w-5 border-2 ${c.hollow}` : 'h-2.5 w-2.5'
          }`}
        >
          <View
            className={`h-2.5 w-2.5 rounded-full ${n <= step ? c.dot : `border-2 ${c.hollow}`}`}
          />
        </View>
      ))}
    </View>
  );
}

function Calm(props: { tone?: 'done'; title: string; body?: string; onBack?: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        {props.tone ? <Nag tone={props.tone} size={96} /> : null}
        <Text
          role="heading"
          className={`text-center text-title ${props.tone ? TONE[props.tone].text : 'text-ink'}`}
        >
          {props.title}
        </Text>
        {props.body ? (
          <Text className="text-center text-body text-ink-muted">{props.body}</Text>
        ) : null}
        {props.onBack ? (
          <Pressable
            role="button"
            onPress={props.onBack}
            className="mt-4 h-[52px] w-full items-center justify-center rounded-button bg-primary"
          >
            <Text className="text-headline text-surface">Back</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/** "+6 min" past your leave-by time; "12 min" until it; "Now" at it. */
export function countdown(minutesPastLeaveBy: number): { value: string; caption: string } {
  if (minutesPastLeaveBy > 0) {
    return { value: `+${minutesPastLeaveBy} min`, caption: 'past your leave-by time' };
  }
  if (minutesPastLeaveBy < 0) {
    return { value: `${-minutesPastLeaveBy} min`, caption: 'until your leave-by time' };
  }
  return { value: 'Now', caption: 'is your leave-by time' };
}
