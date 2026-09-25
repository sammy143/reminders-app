import { router } from 'expo-router';

import { NewAppointmentScreen } from '@/ui/NewAppointmentScreen';

// Pops back to Home, or replaces this screen with it when there's no history (a web reload).
export default function NewAppointment() {
  return <NewAppointmentScreen onClose={() => router.dismissTo('/')} />;
}
