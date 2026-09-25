import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppointments } from './appointments';

/**
 * Tops up scheduled notifications whenever the app comes to the foreground: iOS keeps only 64
 * pending, so later series are scheduled as earlier ones pass (PLAN "Platform constraints").
 */
export function useForegroundSync(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useAppointments.getState().syncNotifications();
    });
    return () => subscription.remove();
  }, []);
}
