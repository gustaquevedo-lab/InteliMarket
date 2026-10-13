// lib/offline/db.ts
import * as SQLite from 'expo-sqlite';

export interface OfflineQueueItem {
  id: string;
  op_type:
    | 'checkin'
    | 'checkout'
    | 'create_order'
    | 'upload_media'
    | 'create_incident'
    | 'upsert_lot_expiry'
    | 'register_device'
    | 'tracking_log';
  payload: string; // JSON string
  created_at: number;
  attempts: number;
  last_error: string | null;
  status: 'pending' | 'syncing' | 'done' | 'failed';
}

export interface PendingMediaItem {
  id: string;
  visit_id: string;
  tipo: 'foto' | 'video';
  local_path: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  attempts: number;
  created_at: number;
}

export interface CachedRouteItem {
  customer_id: string;
  razon_social: string;
  direccion: string | null;
  orden_visita: number;
  gps_lat: number | null;
  gps_lng: number | null;
  cached_at: number;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('inteliforce_local.db');
  await initSchema(dbInstance);
  return dbInstance;
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      op_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS pending_media (
      id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      local_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_route (
      customer_id TEXT PRIMARY KEY,
      razon_social TEXT,
      direccion TEXT,
      orden_visita INTEGER,
      gps_lat REAL,
      gps_lng REAL,
      cached_at INTEGER
    );
  `);
}

export const offlineDb = {
  // Queue Operations
  enqueue: async (op_type: OfflineQueueItem['op_type'], payloadObj: any): Promise<string> => {
    const db = await getDb();
    const id = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payload = JSON.stringify(payloadObj);
    const created_at = Date.now();

    await db.runAsync(
      `INSERT INTO offline_queue (id, op_type, payload, created_at, attempts, status)
       VALUES (?, ?, ?, ?, 0, 'pending')`,
      [id, op_type, payload, created_at]
    );
    return id;
  },

  getPendingQueue: async (limit = 20): Promise<OfflineQueueItem[]> => {
    const db = await getDb();
    const rows = await db.getAllAsync<OfflineQueueItem>(
      `SELECT * FROM offline_queue
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`,
      [limit]
    );
    return rows;
  },

  getPendingCount: async (): Promise<number> => {
    const db = await getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM offline_queue WHERE status = 'pending'`
    );
    const mediaRow = await db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM pending_media WHERE status = 'pending'`
    );
    return (row?.count || 0) + (mediaRow?.count || 0);
  },

  setQueueStatus: async (
    id: string,
    status: OfflineQueueItem['status'],
    last_error: string | null = null
  ) => {
    const db = await getDb();
    if (last_error) {
      await db.runAsync(
        `UPDATE offline_queue SET status = ?, last_error = ?, attempts = attempts + 1 WHERE id = ?`,
        [status, last_error, id]
      );
    } else {
      await db.runAsync(`UPDATE offline_queue SET status = ? WHERE id = ?`, [status, id]);
    }
  },

  deleteCompletedQueue: async () => {
    const db = await getDb();
    await db.runAsync(`DELETE FROM offline_queue WHERE status = 'done'`);
  },

  // Pending Media Operations
  enqueueMedia: async (visit_id: string, tipo: 'foto' | 'video', local_path: string): Promise<string> => {
    const db = await getDb();
    const id = `med_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const created_at = Date.now();

    await db.runAsync(
      `INSERT INTO pending_media (id, visit_id, tipo, local_path, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
      [id, visit_id, tipo, local_path, created_at]
    );
    return id;
  },

  getPendingMedia: async (limit = 10): Promise<PendingMediaItem[]> => {
    const db = await getDb();
    return await db.getAllAsync<PendingMediaItem>(
      `SELECT * FROM pending_media WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
      [limit]
    );
  },

  setMediaStatus: async (id: string, status: PendingMediaItem['status']) => {
    const db = await getDb();
    await db.runAsync(`UPDATE pending_media SET status = ? WHERE id = ?`, [status, id]);
  },

  incrementMediaAttempt: async (id: string) => {
    const db = await getDb();
    await db.runAsync(`UPDATE pending_media SET attempts = attempts + 1 WHERE id = ?`, [id]);
  },

  // Cached Route
  saveCachedRoutes: async (routes: CachedRouteItem[]) => {
    const db = await getDb();
    await db.runAsync(`DELETE FROM cached_route`);
    for (const r of routes) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_route (customer_id, razon_social, direccion, orden_visita, gps_lat, gps_lng, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [r.customer_id, r.razon_social, r.direccion, r.orden_visita, r.gps_lat, r.gps_lng, Date.now()]
      );
    }
  },

  getCachedRoutes: async (): Promise<CachedRouteItem[]> => {
    const db = await getDb();
    return await db.getAllAsync<CachedRouteItem>(
      `SELECT * FROM cached_route ORDER BY orden_visita ASC`
    );
  },
};
