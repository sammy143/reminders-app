import { router, useLocalSearchParams } from 'expo-router';

import { AlarmScreen } from '@/ui/AlarmScreen';

export default function Alarm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Pops back to Home, or replaces this screen with it when there's no history (a cold start).
  return <AlarmScreen id={id} onBack={() => router.dismissTo('/')} />;
}
