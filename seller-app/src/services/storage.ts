/**
 * Local Storage Service
 * SQLite for structured offline data, SecureStore for secrets
 */

import * as SQLite from "expo-sqlite"
import * as SecureStore from "expo-secure-store"
import type { Product, Customer, RouteStop, GPSPoint } from "../types"

let db: SQLite.SQLiteDatabase | null = null

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync("inteliseller.db")

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      sku TEXT,
      precio_venta REAL NOT NULL,
      costo_promedio REAL DEFAULT 0,
      stock_actual REAL DEFAULT 0,
      category_name TEXT,
      image_url TEXT,
      unidad_medida TEXT DEFAULT 'UN',
      tipo_venta TEXT DEFAULT 'unidad',
      peso_kg REAL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      razon_social TEXT,
      ruc TEXT,
      telefono TEXT,
      direccion TEXT,
      latitud REAL,
      longitud REAL,
      email TEXT,
      limite_credito REAL DEFAULT 0,
      saldo_pendiente REAL DEFAULT 0,
      dias_credito INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS route_stops (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT,
      customer_address TEXT,
      customer_lat REAL,
      customer_lng REAL,
      planned_order INTEGER DEFAULT 0,
      planned_arrival TEXT,
      actual_arrival TEXT,
      actual_departure TEXT,
      status TEXT DEFAULT 'pending',
      result TEXT,
      order_amount REAL DEFAULT 0,
      products_count INTEGER DEFAULT 0,
      payment_collected REAL DEFAULT 0,
      customer_rating INTEGER,
      notas TEXT,
      fotos_url TEXT DEFAULT '[]',
      firma_url TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS gps_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      battery_level INTEGER,
      speed_kmh REAL,
      recorded_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders_cache (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      visit_id TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      total REAL DEFAULT 0,
      estado TEXT DEFAULT 'draft',
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_route_stops_instance ON route_stops(instance_id);
    CREATE INDEX IF NOT EXISTS idx_gps_synced ON gps_cache(synced);
    CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders_cache(synced);
  `)
}

// ── Products ──

export async function cacheProducts(products: Product[]) {
  if (!db) return
  const stmt = await db.prepareAsync(
    "INSERT OR REPLACE INTO products (id, nombre, sku, precio_venta, costo_promedio, stock_actual, category_name, image_url, unidad_medida, tipo_venta, peso_kg, updated_at) VALUES ($id, $nombre, $sku, $precio_venta, $costo_promedio, $stock_actual, $category_name, $image_url, $unidad_medida, $tipo_venta, $peso_kg, $updated_at)"
  )
  for (const p of products) {
    await stmt.executeAsync({
      $id: p.id,
      $nombre: p.nombre,
      $sku: p.sku,
      $precio_venta: p.precio_venta,
      $costo_promedio: p.costo_promedio || 0,
      $stock_actual: p.stock_actual || 0,
      $category_name: p.category_name || null,
      $image_url: p.image_url || null,
      $unidad_medida: p.unidad_medida || "UN",
      $tipo_venta: p.tipo_venta || "unidad",
      $peso_kg: p.peso_kg || null,
      $updated_at: new Date().toISOString(),
    })
  }
  await stmt.finalizeAsync()
}

export async function getCachedProducts(search?: string): Promise<Product[]> {
  if (!db) return []
  if (search) {
    const rows = await db.getAllAsync<Product>(
      "SELECT * FROM products WHERE nombre LIKE ? OR sku LIKE ? ORDER BY nombre LIMIT 200",
      [`%${search}%`, `%${search}%`]
    )
    return rows
  }
  const rows = await db.getAllAsync<Product>("SELECT * FROM products ORDER BY category_name, nombre LIMIT 500")
  return rows
}

// ── Customers ──

export async function cacheCustomers(customers: Customer[]) {
  if (!db) return
  const stmt = await db.prepareAsync(
    "INSERT OR REPLACE INTO customers (id, nombre, razon_social, ruc, telefono, direccion, latitud, longitud, email, limite_credito, saldo_pendiente, updated_at) VALUES ($id, $nombre, $razon_social, $ruc, $telefono, $direccion, $latitud, $longitud, $email, $limite_credito, $saldo_pendiente, $updated_at)"
  )
  for (const c of customers) {
    await stmt.executeAsync({
      $id: c.id,
      $nombre: c.nombre || c.razon_social,
      $razon_social: c.razon_social || null,
      $ruc: c.ruc || null,
      $telefono: c.telefono || null,
      $direccion: c.direccion || null,
      $latitud: c.latitud || null,
      $longitud: c.longitud || null,
      $email: c.email || null,
      $limite_credito: c.limite_credito || 0,
      $saldo_pendiente: c.saldo_pendiente || 0,
      $updated_at: new Date().toISOString(),
    })
  }
  await stmt.finalizeAsync()
}

export async function getCachedCustomers(search?: string): Promise<Customer[]> {
  if (!db) return []
  if (search) {
    return await db.getAllAsync<Customer>(
      "SELECT * FROM customers WHERE nombre LIKE ? OR ruc LIKE ? ORDER BY nombre LIMIT 100",
      [`%${search}%`, `%${search}%`]
    )
  }
  return await db.getAllAsync<Customer>("SELECT * FROM customers ORDER BY nombre LIMIT 500")
}

// ── Route stops ──

export async function cacheRouteStops(stops: RouteStop[]) {
  if (!db) return
  const stmt = await db.prepareAsync(
    "INSERT OR REPLACE INTO route_stops (id, instance_id, customer_id, customer_name, planned_order, status, planned_arrival, actual_arrival, actual_departure, order_amount, payment_collected, customer_rating, notas, fotos_url, firma_url, updated_at) VALUES ($id, $instance_id, $customer_id, $customer_name, $planned_order, $status, $planned_arrival, $actual_arrival, $actual_departure, $order_amount, $payment_collected, $customer_rating, $notas, $fotos_url, $firma_url, $updated_at)"
  )
  for (const s of stops) {
    await stmt.executeAsync({
      $id: s.id,
      $instance_id: s.instance_id,
      $customer_id: s.customer_id,
      $customer_name: s.customer_name || null,
      $planned_order: s.planned_order,
      $status: s.status,
      $planned_arrival: s.planned_arrival || null,
      $actual_arrival: s.actual_arrival || null,
      $actual_departure: s.actual_departure || null,
      $order_amount: s.order_amount || 0,
      $payment_collected: s.payment_collected || 0,
      $customer_rating: s.customer_rating || null,
      $notas: s.notas || null,
      $fotos_url: JSON.stringify(s.fotos_url || []),
      $firma_url: s.firma_url || null,
      $updated_at: new Date().toISOString(),
    })
  }
  await stmt.finalizeAsync()
}

export async function getCachedStops(instanceId: string): Promise<RouteStop[]> {
  if (!db) return []
  return await db.getAllAsync<RouteStop>(
    "SELECT * FROM route_stops WHERE instance_id = ? ORDER BY planned_order",
    [instanceId]
  )
}

// ── GPS cache (for offline pings) ──

export async function cacheGpsPoint(point: GPSPoint) {
  if (!db) return
  await db.runAsync(
    "INSERT INTO gps_cache (lat, lng, battery_level, speed_kmh, recorded_at, synced) VALUES (?, ?, ?, ?, ?, 0)",
    [point.lat, point.lng, point.battery_level, point.speed_kmh, point.recorded_at]
  )
}

// ── Secure storage ──

export async function saveToken(token: string) {
  await SecureStore.setItemAsync("auth_token", token)
}

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync("auth_token")
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync("auth_token")
}

export async function savePinCode(pin: string) {
  await SecureStore.setItemAsync("pin_code", pin)
}

export async function getPinCode(): Promise<string | null> {
  return await SecureStore.getItemAsync("pin_code")
}
