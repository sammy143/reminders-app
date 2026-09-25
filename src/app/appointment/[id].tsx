import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { draftFromAppointment } from '@/domain/appointment';
import { useAppointments } from '@/state/appointments';
import { AppointmentForm } from '@/ui/AppointmentForm';

// Pops back to Home, or replaces this screen with it when there's no history (a web reload).
const close = () => router.dismissTo('/');

export default function EditAppointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const appt = useAppointments((s) => s.appointments.find((a) => a.id === id));
  const hydrated = useAppointments((s) => s.hydrated);
  const { update, remove } = useAppointments.getState();

  if (!appt) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg px-4">
        <Text className="text-body text-ink-muted">
          {hydrated ? 'That appointment is gone.' : 'Loading…'}
        </Text>
        {hydrated ? (
          <Pressable
            role="button"
            onPress={close}
            className="h-[52px] items-center justify-center rounded-button bg-primary px-8"
          >
            <Text className="text-headline text-surface">Back</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <AppointmentForm
      key={appt.id}
      heading="Edit appointment"
      initial={draftFromAppointment(appt)}
      previewId={appt.id}
      onSubmit={async (draft) => {
        await update(appt.id, draft);
        close();
      }}
      onCancel={close}
      onDelete={async () => {
        await remove(appt.id);
        close();
      }}
    />
  );
}
