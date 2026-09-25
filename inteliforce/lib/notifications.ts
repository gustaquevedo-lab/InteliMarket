// lib/notifications.ts
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// En Expo Go (SDK 53+), las notificaciones remotas de Android no están soportadas.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any)?.appOwnership === 'expo';

let Notifications: typeof import('expo-notifications') | null = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: Notifications?.AndroidNotificationPriority?.HIGH,
        }),
      });
    }
  } catch {
    // Entorno sin soporte de push nativo
  }
}

export async function initNotifications() {
  if (isExpoGo || !Notifications) {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    // Obtener token para push notifications
    const tokenData = await Notifications.getDevicePushTokenAsync().catch(() => null);
    const pushToken = tokenData?.data;

    if (pushToken) {
      // Registrar el dispositivo con el backend
      await api
        .post('/devices/register', {
          fcm_token: pushToken,
          platform: Platform.OS,
          app_version: '1.0.0',
        })
        .catch((e: any) => {
          console.warn('No se pudo registrar token de dispositivo:', e.message);
        });
    }

    return pushToken;
  } catch (err: any) {
    console.warn('Error inicializando notificaciones:', err.message);
    return null;
  }
}
