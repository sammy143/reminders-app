import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAppointments } from '@/state/appointments';
import { useForegroundSync } from '@/state/useForegroundSync';

export default function RootLayout() {
  useForegroundSync();
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
