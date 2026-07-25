import * as SQLite from "expo-sqlite"

let db: SQLite.SQLiteDatabase | null = null

export async function initDatabase() {
  db = await SQLite.openDatabaseAsync("intelidriver.db")

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS deliveries_cache (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS routes_cache (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS gps_offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed REAL DEFAULT 0,
      heading REAL DEFAULT 0,
      battery_level REAL DEFAULT 100,
      recorded_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pending_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

export function getDb() {
  return db
}

export async function cacheDeliveries(deliveries: any[]) {
  if (!db) return
  const stmt = await db.prepareAsync(
    "INSERT OR REPLACE INTO deliveries_cache (id, data, synced, updated_at) VALUES (?, ?, 1, datetime('now'))"
  )
  for (const d of deliveries) {
    await stmt.executeAsync(d.id, JSON.stringify(d))
  }
  await stmt.finalizeAsync()
}

export async function getCachedDeliveries(): Promise<any[]> {
  if (!db) return []
  const rows = await db.getAllAsync("SELECT data FROM deliveries_cache ORDER BY updated_at DESC")
  return rows.map((r: any) => JSON.parse(r.data))
}

export async function queueGPSPoint(point: { lat: number; lng: number; speed: number; heading: number; battery_level: number; recorded_at: string }) {
  if (!db) return
  await db.runAsync(
    "INSERT INTO gps_offline_queue (lat, lng, speed, heading, battery_level, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
    point.lat, point.lng, point.speed, point.heading, point.battery_level, point.recorded_at
  )
}

export async function getPendingGPSPoints(): Promise<any[]> {
  if (!db) return []
  return await db.getAllAsync(
    "SELECT * FROM gps_offline_queue WHERE synced = 0 ORDER BY id ASC LIMIT 100"
  )
}

export async function markGPSPointsSynced(ids: number[]) {
  if (!db || ids.length === 0) return
  const placeholders = ids.map(() => "?").join(",")
  await db.runAsync(
    `UPDATE gps_offline_queue SET synced = 1 WHERE id IN (${placeholders})`,
    ...ids
  )
}
