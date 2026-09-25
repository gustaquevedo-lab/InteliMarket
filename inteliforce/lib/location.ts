// lib/location.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { config } from '@/constants/config';
import { enqueueOfflineOperation } from './offline/queue';

export const BACKGROUND_LOCATION_TASK = 'INTELIFORCE_BACKGROUND_LOCATION';

export interface LocationReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

// Registrar tarea en segundo plano con TaskManager
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Error en tarea background de ubicación:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const loc = locations[locations.length - 1];
      await enqueueOfflineOperation('tracking_log', {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? 999,
        timestamp: new Date(loc.timestamp).toISOString(),
      });
    }
  }
});

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    return false;
  }

  try {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    return bgStatus === 'granted';
  } catch {
    // Si falla background en dev o por permisos de sistema, foreground es suficiente
    return true;
  }
}

export async function getCurrentPreciseLocation(
  timeoutMs = config.gps.timeoutMs
): Promise<LocationReading> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    throw new Error('Permisos de ubicación denegados');
  }

  return new Promise(async (resolve, reject) => {
    let resolved = false;
    let bestReading: LocationReading | null = null;
    let subscription: Location.LocationSubscription | null = null;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (subscription) subscription.remove();
        if (bestReading) {
          resolve(bestReading);
        } else {
          // Último recurso: intentar getLastKnownPositionAsync
          Location.getLastKnownPositionAsync({})
            .then((last) => {
              if (last) {
                resolve({
                  latitude: last.coords.latitude,
                  longitude: last.coords.longitude,
                  accuracy: last.coords.accuracy ?? 999,
                  timestamp: last.timestamp,
                });
              } else {
                reject(new Error('No se pudo obtener la ubicación GPS a tiempo'));
              }
            })
            .catch(() => reject(new Error('Tiempo de espera GPS agotado')));
        }
      }
    }, timeoutMs);

    try {
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (loc) => {
          const reading: LocationReading = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? 999,
            timestamp: loc.timestamp,
          };

          if (!bestReading || reading.accuracy < bestReading.accuracy) {
            bestReading = reading;
          }

          // Si ya tenemos una lectura excelente (menor o igual a 50m), resolver de inmediato
          if (reading.accuracy <= config.gps.targetAccuracyM && !resolved) {
            resolved = true;
            clearTimeout(timer);
            if (subscription) subscription.remove();
            resolve(reading);
          }
        }
      );
    } catch (e) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(e);
      }
    }
  });
}

export async function startBackgroundTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) return;

  const hasPerm = await requestLocationPermissions();
  if (!hasPerm) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: config.gps.backgroundIntervalMs,
    distanceInterval: config.gps.backgroundDistanceM,
    foregroundService: {
      notificationTitle: 'Inteliforce en ruta',
      notificationBody: 'Registrando actividad de campo',
      notificationColor: '#1E3A8A',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

export async function stopBackgroundTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
