import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BUFFER_LIMITS,
  TRAVEL_LIMITS,
  validateAppointmentDraft,
  type AppointmentDraft,
  type DraftErrors,
} from '@/domain/appointment';
import { computeLeaveBy } from '@/domain/leaveBy';
import { previewLine } from '@/domain/today';

import { DateTimeField } from './components/DateTimeField';
import { IntensityChips } from './components/IntensityChips';
import { NagBubble } from './components/NagBubble';
import { Stepper } from './components/Stepper';
import { Toggle } from './components/Toggle';
import { formatTime } from './format';

export interface AppointmentFormProps {
  heading: string;
  initial: AppointmentDraft;
  /** Seeds the preview line; the appointment id when editing. */
  previewId: string;
  onSubmit: (draft: AppointmentDraft) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

/** Add/edit form (docs/design/screens/new-appointment.png, minus Location: see F005 plan). */
export function AppointmentForm(props: AppointmentFormProps) {
  const { onDelete } = props;
  const [draft, setDraft] = useState(props.initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A ref, not state: two presses in the same frame must not both get through.
  const inFlight = useRef(false);

  /** Runs one save or delete at a time; a failure shows a message instead of closing. */
  const run = async (action: () => Promise<void>, failure: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      await action();
    } catch {
      setSaveError(failure);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const set = <K extends keyof AppointmentDraft>(key: K, value: AppointmentDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validStart = !Number.isNaN(draft.startsAt.getTime());
  const leaveBy = validStart
    ? computeLeaveBy({ ...draft, startsAt: draft.startsAt.toISOString() })
    : null;
  const preview = validStart ? previewLine({ ...draft, id: props.previewId }) : null;

  const submit = () => {
    if (inFlight.current) return;
    const found = validateAppointmentDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void run(() => props.onSubmit(draft), 'Couldn’t save. Try again.');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between border-b border-line px-5 py-2.5">
        <HeaderButton label="Cancel" onPress={props.onCancel} muted />
        <Text className="text-headline text-ink" role="heading">
          {props.heading}
        </Text>
        <HeaderButton label="Save" onPress={submit} disabled={busy} />
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 py-4" keyboardShouldPersistTaps="handled">
        <Card>
          <View className="flex-row items-center justify-between gap-4 px-4 py-3.5">
            <Text className="text-label font-semibold text-ink-muted">Title</Text>
            <TextInput
              aria-label="Title"
              value={draft.title}
              onChangeText={(v) => set('title', v)}
              placeholder="e.g. Dentist, Interview"
              placeholderClassName="text-ink-muted"
              className="flex-1 text-right text-body text-ink"
              returnKeyType="done"
            />
          </View>
          <FieldError message={errors.title} />
          <Divider />
          <DateTimeField value={draft.startsAt} onChange={(v) => set('startsAt', v)} />
          <FieldError message={errors.startsAt} />
        </Card>

        <Card>
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-1 pr-4">
              <Text className="text-headline text-ink">In person</Text>
              <Text className="text-label text-ink-muted">
                {draft.inPerson ? 'Nag bullies you until you leave' : 'One polite reminder'}
              </Text>
            </View>
            <Toggle label="In person" value={draft.inPerson} onChange={(v) => set('inPerson', v)} />
          </View>
          <Divider />
          <Stepper
            label="Travel time"
            value={draft.travelMinutes}
            {...TRAVEL_LIMITS}
            onChange={(v) => set('travelMinutes', v)}
          />
          <FieldError message={errors.travelMinutes} />
          <Divider />
          <Stepper
            label="Buffer before arrival"
            value={draft.bufferMinutes}
            {...BUFFER_LIMITS}
            onChange={(v) => set('bufferMinutes', v)}
          />
          <FieldError message={errors.bufferMinutes} />
          <View className="flex-row items-center border-t border-line bg-bg px-4 py-2.5">
            <Text className="text-label text-ink-muted">
              You’ll need to leave by{' '}
              <Text className="font-semibold text-ink">{leaveBy ? formatTime(leaveBy) : '—'}</Text>
            </Text>
          </View>
        </Card>

        <View className="gap-2">
          <Text className="px-1 text-caption font-semibold uppercase tracking-wider text-ink-muted">
            How mean should Nag be?
          </Text>
          <IntensityChips value={draft.intensity} onChange={(v) => set('intensity', v)} />
        </View>

        {preview ? (
          <View className="pt-1">
            <NagBubble
              tone={preview.tone}
              heading={`${draft.intensity} preview`}
              line={preview.text}
            />
          </View>
        ) : null}

        {saveError ? (
          <Text className="px-1 text-label text-tone-rude" role="alert">
            {saveError}
          </Text>
        ) : null}

        {onDelete ? (
          <DeleteButton
            disabled={busy}
            onDelete={() => run(onDelete, 'Couldn’t delete. Try again.')}
          />
        ) : null}
      </ScrollView>

      <View className="border-t border-line px-4 pb-2 pt-3">
        <Pressable
          role="button"
          aria-label="Save appointment"
          aria-disabled={busy}
          aria-busy={busy}
          onPress={submit}
          disabled={busy}
          className={`h-[52px] items-center justify-center rounded-button bg-primary ${busy ? 'opacity-60' : ''}`}
        >
          <Text className="text-headline text-surface">Save appointment →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Two-tap delete: `Alert` is a no-op on web (F005 plan "Delete"). */
function DeleteButton({ onDelete, disabled }: { onDelete: () => void; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Pressable
      role="button"
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => (confirming ? onDelete() : setConfirming(true))}
      className={`h-[52px] items-center justify-center rounded-button border ${
        confirming ? 'border-tone-rude bg-tone-rude' : 'border-line bg-surface'
      }`}
    >
      <Text className={`text-headline ${confirming ? 'text-surface' : 'text-tone-rude'}`}>
        {confirming ? 'Tap again to delete' : 'Delete appointment'}
      </Text>
    </Pressable>
  );
}

function HeaderButton(props: {
  label: string;
  onPress: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-disabled={!!props.disabled}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={8}
      className={`py-1 ${props.disabled ? 'opacity-40' : ''}`}
    >
      <Text
        className={props.muted ? 'text-body text-ink-muted' : 'text-body font-semibold text-ink'}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-card border border-line bg-surface">{children}</View>
  );
}

function Divider() {
  return <View className="mx-4 h-px bg-line" />;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text className="px-4 pb-2 text-caption text-tone-rude" role="alert">
      {message}
    </Text>
  );
}
