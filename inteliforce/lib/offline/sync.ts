import * as FileSystem from 'expo-file-system/legacy';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api, isNetworkError } from '../api';
import { config } from '@/constants/config';
import { getAuthToken } from '../auth';
import { offlineDb, OfflineQueueItem } from './db';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any)?.appOwnership === 'expo';

export const BACKGROUND_SYNC_TASK = 'INTELIFORCE_BACKGROUND_SYNC';

let isSyncing = false;

async function executeOperation(item: OfflineQueueItem): Promise<any> {
  const payload = JSON.parse(item.payload);

  switch (item.op_type) {
    case 'checkin':
      return await api.post('/visits', payload);

    case 'checkout': {
      const { visit_id, ...rest } = payload;
      return await api.patch(`/visits/${visit_id}/checkout`, rest);
    }

    case 'create_order':
      return await api.post('/orders', payload);

    case 'create_incident': {
      const { visit_id, ...rest } = payload;
      return await api.post(`/visits/${visit_id}/incidents`, rest);
    }

    case 'upsert_lot_expiry': {
      const { customer_id, visit_id, items } = payload;
      return await api.put(`/customers/${customer_id}/lot-expiry?visit_id=${visit_id}`, items);
    }

    case 'register_device':
      return await api.post('/devices/register', payload);

    case 'tracking_log':
      // Backend tracking log or telemetry endpoint if available
      return { ok: true };

    default:
      console.warn(`Operación offline desconocida: ${item.op_type}`);
      return { skipped: true };
  }
}

async function syncPendingMedia() {
  const pendingMedia = await offlineDb.getPendingMedia(5);
  const token = await getAuthToken();

  for (const media of pendingMedia) {
    try {
      await offlineDb.setMediaStatus(media.id, 'uploading');

      const fileInfo = await FileSystem.getInfoAsync(media.local_path);
      if (!fileInfo.exists) {
        // Archivo local ya no existe
        await offlineDb.setMediaStatus(media.id, 'failed');
        continue;
      }

      const uploadUrl = `${config.apiBaseUrl}/visits/${media.visit_id}/media`;

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, media.local_path, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        parameters: {
          tipo: media.tipo,
        },
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        await offlineDb.setMediaStatus(media.id, 'done');
      } else {
        await offlineDb.incrementMediaAttempt(media.id);
        await offlineDb.setMediaStatus(media.id, 'pending');
      }
    } catch {
      await offlineDb.incrementMediaAttempt(media.id);
      await offlineDb.setMediaStatus(media.id, 'pending');
    }
  }
}

export async function syncOfflineQueue(): Promise<{ processed: number; errors: number }> {
  if (isSyncing) return { processed: 0, errors: 0 };
  isSyncing = true;

  let processed = 0;
  let errors = 0;

  try {
    const items = await offlineDb.getPendingQueue(20);

    for (const item of items) {
      try {
        await offlineDb.setQueueStatus(item.id, 'syncing');
        await executeOperation(item);
        await offlineDb.setQueueStatus(item.id, 'done');
        processed++;
      } catch (err: any) {
        errors++;
        const errMsg = err?.message || 'Error desconocido';
        if (isNetworkError(err)) {
          // Si el fallo fue por conexión, regresarlo a 'pending' para reintentar luego
          await offlineDb.setQueueStatus(item.id, 'pending', errMsg);
          break; // Detener la iteración si la red se cayó
        } else {
          // Error lógico o de validación
          if (item.attempts >= config.sync.maxRetries) {
            await offlineDb.setQueueStatus(item.id, 'failed', errMsg);
          } else {
            await offlineDb.setQueueStatus(item.id, 'pending', errMsg);
          }
        }
      }
    }

    await syncPendingMedia();
    await offlineDb.deleteCompletedQueue();
  } finally {
    isSyncing = false;
  }

  return { processed, errors };
}

// Registrar tarea con TaskManager
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const res = await syncOfflineQueue();
    return res.processed > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  if (isExpoGo) {
    return;
  }
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 60, // 60 segundos
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (err: any) {
    console.warn('No se pudo registrar background sync:', err?.message);
  }
}

