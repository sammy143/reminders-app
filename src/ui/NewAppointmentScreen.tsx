import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { draftDefaults, type AppointmentDraft } from '@/domain/appointment';
import { appointmentDefaults } from '@/domain/settings';
import { useAppointments } from '@/state/appointments';
import { useSettings } from '@/state/settings';
import { useNow } from '@/state/useNow';

import { AppointmentForm } from './AppointmentForm';

interface NewAppointmentScreenProps {
  /** Leaves the screen: after a save, or on cancel. */
  onClose: () => void;
}

/**
 * New-appointment form with the user's defaults (F008). Waits for stored settings (a web reload
 * lands here first) and shows a blank screen until then, so the defaults are never the built-in ones
 * by accident. A failed settings load still opens the form, with the built-in defaults.
 */
export function NewAppointmentScreen({ onClose }: NewAppointmentScreenProps) {
  const hydrated = useSettings((s) => s.hydrated);
  useEffect(() => {
    void useSettings.getState().hydrate();
  }, []);
  return hydrated ? (
    <NewAppointmentForm onClose={onClose} />
  ) : (
    <View className="flex-1 bg-bg" testID="new-appointment-loading" />
  );
}

function NewAppointmentForm({ onClose }: NewAppointmentScreenProps) {
  const add = useAppointments((s) => s.add);
  const now = useNow(
    15_000,
    useAppointments((s) => s.clock),
  );
  // Defaults are taken once, when the form opens: the clock, and the user's default intensity
  // and buffer from Settings.
  const [initial] = useState<AppointmentDraft>(() =>
    draftDefaults(now, appointmentDefaults(useSettings.getState().settings)),
  );
  return (
    <AppointmentForm
      heading="New appointment"
      initial={initial}
      previewId="preview"
      onSubmit={async (draft) => {
        await add(draft);
        onClose();
      }}
      onCancel={onClose}
    />
  );
}
