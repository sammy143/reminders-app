import '../../global.css';

import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAppointments } from '@/state/appointments';
import { useForegroundSync } from '@/state/useForegroundSync';
import { useNotificationResponses, type OpenTarget } from '@/state/useNotificationResponses';

// A notification tap or button opens the alarm screen, which confirms what happened (F007); an
// event without an alarm (not in person) opens its editor.
const openFromNotification = ({ screen, appointmentId: id }: OpenTarget) =>
  screen === 'alarm'
    ? router.push({ pathname: '/alarm/[id]', params: { id } })
    : router.push({ pathname: '/appointment/[id]', params: { id } });

export default function RootLayout() {
  useForegroundSync();
  useNotificationResponses(openFromNotification);
  useEffect(() => {
    void useAppointments.getState().hydrate();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </>
  );
}
