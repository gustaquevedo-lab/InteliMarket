import * as SecureStore from "expo-secure-store"
import * as SQLite from "expo-sqlite"

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8000/api"

let _db: SQLite.SQLiteDatabase | null = null

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync("inteliclient.db")
    await _db.execAsync(`
      CREATE TABLE IF NOT EXISTS products_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        category_id TEXT,
        search_text TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pending_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retries INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 5
      );
    `)
  }
  return _db
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync("client_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error" }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    if (res.status === 204) return undefined as T
    return res.json()
  } catch (e: any) {
    if (e.message?.startsWith("HTTP") || e.message?.includes("HTTP")) throw e
    // Network error — queue for offline sync for mutating requests
    if (options.method && options.method !== "GET") {
      const db = await getDb()
      await db.runAsync(
        "INSERT INTO pending_actions (action_type, payload, created_at) VALUES (?, ?, ?)",
        `${options.method} ${endpoint}`,
        JSON.stringify({ endpoint, method: options.method, body: options.body ? JSON.parse(options.body as string) : null }),
        Date.now()
      )
    }
    throw new Error("Sin conexión. La acción se sincronizará automáticamente.")
  }
}

async function syncPendingActions() {
  try {
    const db = await getDb()
    const rows = await db.getAllAsync<{ id: number; action_type: string; payload: string; retries: number }>(
      "SELECT * FROM pending_actions WHERE retries < max_retries ORDER BY id ASC LIMIT 10"
    )
    for (const row of rows) {
      try {
        const payload = JSON.parse(row.payload)
        await request(payload.endpoint, {
          method: payload.method,
          body: payload.body ? JSON.stringify(payload.body) : undefined,
        })
        await db.runAsync("DELETE FROM pending_actions WHERE id = ?", row.id)
      } catch {
        await db.runAsync("UPDATE pending_actions SET retries = retries + 1 WHERE id = ?", row.id)
      }
    }
  } catch {}
}

// Cache helpers
async function cacheProduct(product: any) {
  const db = await getDb()
  await db.runAsync(
    "INSERT OR REPLACE INTO products_cache (id, data, category_id, search_text, updated_at) VALUES (?, ?, ?, ?, ?)",
    product.id, JSON.stringify(product), product.categoria || "", product.nombre, Date.now()
  )
}

async function getCachedProducts(search?: string): Promise<any[]> {
  const db = await getDb()
  let sql = "SELECT data FROM products_cache"
  const params: any[] = []
  if (search) {
    sql += " WHERE search_text LIKE ?"
    params.push(`%${search}%`)
  }
  sql += " ORDER BY updated_at DESC LIMIT 100"
  const rows = await db.getAllAsync<{ data: string }>(sql, ...params)
  return rows.map((r) => JSON.parse(r.data))
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string }>("/v1/client-app/auth/login", {
        method: "POST", body: JSON.stringify({ email, password }),
      }),
    register: (data: any) =>
      request<{ access_token: string }>("/v1/client-app/auth/register", {
        method: "POST", body: JSON.stringify(data),
      }),
    registerDevice: (push_token: string, platform: string) =>
      request<any>("/v1/client-app/auth/device", {
        method: "POST", body: JSON.stringify({ push_token, platform }),
      }),
  },
  catalog: {
    categories: () => request<any[]>("/v1/client-app/categories"),
    products: async (params?: { search?: string; category_id?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set("search", params.search)
      if (params?.category_id) q.set("category_id", params.category_id)
      if (params?.limit) q.set("limit", String(params.limit))
      if (params?.offset) q.set("offset", String(params.offset))
      try {
        const prods = await request<any[]>(`/v1/client-app/products?${q}`)
        // Cache products offline
        prods.forEach(cacheProduct)
        return prods
      } catch {
        // Offline fallback
        return getCachedProducts(params?.search)
      }
    },
  },
  cart: {
    get: () => request<any>("/v1/client-app/cart"),
    addItem: (data: any) => request<any>("/v1/client-app/cart/items", { method: "POST", body: JSON.stringify(data) }),
    updateItem: (id: string, data: any) => request<any>(`/v1/client-app/cart/items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    removeItem: (id: string) => request<void>(`/v1/client-app/cart/items/${id}`, { method: "DELETE" }),
    checkout: (data: any) => request<any>("/v1/client-app/checkout", { method: "POST", body: JSON.stringify(data) }),
  },
  orders: {
    list: async (limit = 20, offset = 0) => {
      try {
        const orders = await request<any[]>(`/v1/client-app/orders?limit=${limit}&offset=${offset}`)
        const db = await getDb()
        orders.forEach((o) => {
          db.runAsync("INSERT OR REPLACE INTO orders_cache (id, data, updated_at) VALUES (?, ?, ?)", o.id, JSON.stringify(o), Date.now())
        })
        return orders
      } catch {
        const db = await getDb()
        const rows = await db.getAllAsync<{ data: string }>("SELECT data FROM orders_cache ORDER BY updated_at DESC LIMIT ?", limit)
        return rows.map((r) => JSON.parse(r.data))
      }
    },
    get: (id: string) => request<any>(`/v1/client-app/orders/${id}`),
    tracking: (id: string) => request<any>(`/v1/client-app/orders/${id}/tracking`),
    repeat: (id: string) => request<any>(`/v1/client-app/orders/${id}/repeat`, { method: "POST" }),
  },
  favorites: {
    list: () => request<any[]>("/v1/client-app/favorites"),
    add: (productId: string) => request<void>(`/v1/client-app/favorites/${productId}`, { method: "POST" }),
    remove: (productId: string) => request<void>(`/v1/client-app/favorites/${productId}`, { method: "DELETE" }),
  },
  addresses: {
    list: () => request<any[]>("/v1/client-app/addresses"),
    create: (data: any) => request<any>("/v1/client-app/addresses", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/v1/client-app/addresses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/v1/client-app/addresses/${id}`, { method: "DELETE" }),
  },
  account: {
    me: () => request<any>("/v1/client-app/me"),
    promotions: () => request<any[]>("/v1/client-app/promotions"),
  },
  promotions: {
    list: () => request<any[]>("/v1/client-app/promotions"),
    validate: (codigo_cupon: string) => request<any>("/v1/client-app/promotions/validate", { method: "POST", body: JSON.stringify({ codigo_cupon }) }),
  },
  loyalty: {
    get: () => request<any>("/v1/client-app/loyalty"),
    rewards: () => request<any[]>("/v1/client-app/loyalty/rewards"),
    redeem: (points: number, concepto?: string) => request<any>("/v1/client-app/loyalty/redeem", { method: "POST", body: JSON.stringify({ points, concepto }) }),
  },
  chat: {
    whatsappUrl: () => request<{ url: string }>("/v1/client-app/chat/whatsapp-url"),
  },
  payments: {
    pagopar: (orderId: string) => request<any>("/v1/client-app/payments/pagopar", { method: "POST", body: JSON.stringify({ order_id: orderId }) }),
    kuapay: (orderId: string) => request<any>("/v1/client-app/payments/kuapay", { method: "POST", body: JSON.stringify({ order_id: orderId }) }),
    spi: (orderId: string) => request<any>("/v1/client-app/payments/spi", { method: "POST", body: JSON.stringify({ order_id: orderId }) }),
  },
  scanandgo: {
    createSession: () => request<any>("/v1/scanandgo/sessions", { method: "POST", body: JSON.stringify({}) }),
    getActiveSession: () => request<any>("/v1/scanandgo/sessions/active"),
    getSession: (id: string) => request<any>(`/v1/scanandgo/sessions/${id}`),
    addItem: (data: any) => request<any>("/v1/scanandgo/items", { method: "POST", body: JSON.stringify(data) }),
    removeItem: (sessionId: string, itemId: string) => request<void>(`/v1/scanandgo/items/${sessionId}/${itemId}`, { method: "DELETE" }),
    processPayment: (data: any) => request<any>("/v1/scanandgo/payments", { method: "POST", body: JSON.stringify(data) }),
    lookupProduct: (barcode: string) => request<any>(`/v1/scanandgo/products/lookup/${encodeURIComponent(barcode)}`),
    getPendingAudits: () => request<any[]>("/v1/scanandgo/audits/pending"),
    checkAudit: (data: any) => request<any>("/v1/scanandgo/audits/check", { method: "POST", body: JSON.stringify(data) }),
    resolveAudit: (data: any) => request<any>("/v1/scanandgo/audits/resolve", { method: "POST", body: JSON.stringify(data) }),
  },
  sync: {
    syncPending: syncPendingActions,
    isOnline: async (): Promise<boolean> => {
      try {
        await fetch(`${API_BASE.replace("/api", "")}/health`, { method: "HEAD", cache: "no-cache" })
        return true
      } catch { return false }
    },
  },
}
