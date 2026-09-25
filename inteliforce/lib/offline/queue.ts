// lib/offline/queue.ts
import { offlineDb, OfflineQueueItem } from './db';
import { syncOfflineQueue } from './sync';

export async function enqueueOfflineOperation(
  op_type: OfflineQueueItem['op_type'],
  payload: any
): Promise<string> {
  const id = await offlineDb.enqueue(op_type, payload);
  return id;
}

export async function enqueueOfflineMedia(
  visit_id: string,
  tipo: 'foto' | 'video',
  local_path: string
): Promise<string> {
  const id = await offlineDb.enqueueMedia(visit_id, tipo, local_path);
  return id;
}

export { syncOfflineQueue };
