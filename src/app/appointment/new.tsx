import { router } from 'expo-router';
import { useState } from 'react';

import { draftDefaults } from '@/domain/appointment';
import { useAppointments } from '@/state/appointments';
import { useNow } from '@/state/useNow';
import { AppointmentForm } from '@/ui/AppointmentForm';

// Pops back to Home, or replaces this screen with it when there's no history (a web reload).
const close = () => router.dismissTo('/');

export default function NewAppointment() {
  const add = useAppointments((s) => s.add);
  const now = useNow();
  // Defaults are taken once, from the clock at the time the form opens.
  const [initial] = useState(() => draftDefaults(now));
  return (
    <AppointmentForm
      heading="New appointment"
      initial={initial}
      previewId="preview"
      onSubmit={async (draft) => {
        await add(draft);
        close();
      }}
      onCancel={close}
    />
  );
}
