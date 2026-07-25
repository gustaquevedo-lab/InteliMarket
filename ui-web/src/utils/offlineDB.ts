const DB_NAME = "intelimarket_offline"
const DB_VERSION = 3
const STORE_CART = "cart"
const STORE_PENDING_SALES = "pending_sales"
const STORE_PRODUCTS = "products"
const STORE_CUSTOMERS = "customers"
const STORE_SYNC_STATE = "sync_state"
const STORE_RECEIPTS = "receipts"
const STORE_TIMBRADOS = "timbrados"
const STORE_PAYMENT_METHODS = "payment_methods"
const STORE_COMPANY_CONFIG = "company_config"
const STORE_INVOICES = "invoices"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_CART)) db.createObjectStore(STORE_CART, { keyPath: "id" })
      if (!db.objectStoreNames.contains(STORE_PENDING_SALES)) {
        const store = db.createObjectStore(STORE_PENDING_SALES, { keyPath: "id" })
        store.createIndex("status", "status", { unique: false })
        store.createIndex("created_at", "created_at", { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const store = db.createObjectStore(STORE_PRODUCTS, { keyPath: "id" })
        store.createIndex("sku", "sku", { unique: false })
        store.createIndex("nombre", "nombre", { unique: false })
        store.createIndex("codigo_barra", "codigo_barra", { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
        const store = db.createObjectStore(STORE_CUSTOMERS, { keyPath: "id" })
        store.createIndex("ruc", "ruc", { unique: false })
        store.createIndex("ci", "ci", { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_STATE)) db.createObjectStore(STORE_SYNC_STATE, { keyPath: "id" })
      if (!db.objectStoreNames.contains(STORE_RECEIPTS)) {
        const store = db.createObjectStore(STORE_RECEIPTS, { keyPath: "id" })
        store.createIndex("sale_id", "sale_id", { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_TIMBRADOS)) db.createObjectStore(STORE_TIMBRADOS, { keyPath: "id" })
      if (!db.objectStoreNames.contains(STORE_PAYMENT_METHODS)) db.createObjectStore(STORE_PAYMENT_METHODS, { keyPath: "id" })
      if (!db.objectStoreNames.contains(STORE_COMPANY_CONFIG)) db.createObjectStore(STORE_COMPANY_CONFIG, { keyPath: "id" })
      if (!db.objectStoreNames.contains(STORE_INVOICES)) {
        const store = db.createObjectStore(STORE_INVOICES, { keyPath: "id" })
        store.createIndex("estado", "estado", { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function openDBOnce(): Promise<IDBDatabase> {
  if ((openDBOnce as any)._db) return (openDBOnce as any)._db
  const db = await openDB()
  ;(openDBOnce as any)._db = db
  db.addEventListener("close", () => { (openDBOnce as any)._db = null })
  return db
}

async function getStore<T>(storeName: string): Promise<T[]> {
  const db = await openDBOnce()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

async function getByIndex<T>(storeName: string, indexName: string, value: string): Promise<T[]> {
  const db = await openDBOnce()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const store = tx.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(value)
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

async function putItem<T extends { id: string }>(storeName: string, item: T): Promise<void> {
  const db = await openDBOnce()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    store.put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function putMany<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  const db = await openDBOnce()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    for (const item of items) store.put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function deleteItem(storeName: string, id: string): Promise<void> {
  const db = await openDBOnce()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDBOnce()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    store.clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export interface OfflineCartItem {
  id: string
  nombre: string
  precio: number
  quantity: number
  iva_tasa: number
  sku: string
  categoria: string
}

export interface PendingSale {
  id: string
  data: unknown
  created_at: string
  status: "pending" | "syncing" | "synced" | "error"
  error?: string
  retry_count: number
  last_retry: string
  next_retry: string
}

export interface CachedProduct {
  id: string
  sku: string
  codigo_barra: string | null
  nombre: string
  category_id: string | null
  iva_tasa: number
  activo: boolean
  precio: number
  stock: number
  categoria_nombre: string | null
  data: unknown
  cached_at: string
}

export interface CachedCustomer {
  id: string
  razon_social: string
  ruc: string | null
  ci: string | null
  tipo_persona: string
  telefono: string | null
  email: string | null
  credito_limite: number
  activo: boolean
  cached_at: string
}

export interface SyncState {
  id: string
  last_full_sync: string
  last_sale_sync: string
  pending_count: number
}

export interface CachedReceipt {
  id: string
  sale_id: string | null
  html: string
  created_at: string
}

export interface CachedTimbrado {
  id: string
  company_id: string
  numero: string
  fecha_inicio: string
  fecha_fin: string
  rango_desde: number
  rango_hasta: number
  tipo_comprobante: string
  activo: boolean
  ultimo_usado: number
  bloque_inicio: number
  bloque_fin: number
}

export interface CachedPaymentMethod {
  id: string
  tipo: string
  nombre: string
  activo: boolean
}

export interface CachedCompanyConfig {
  ruc: string
  razon_social: string
  establecimiento: string
  punto_emision: number
  regimen: string
}

export const offlineDB = {
  cart: {
    getAll: () => getStore<OfflineCartItem>(STORE_CART),
    set: (items: OfflineCartItem[]) => clearStore(STORE_CART).then(() => Promise.all(items.map(i => putItem(STORE_CART, i)))),
    clear: () => clearStore(STORE_CART),
  },
  pendingSales: {
    getAll: () => getStore<PendingSale>(STORE_PENDING_SALES),
    getPending: () => getByIndex<PendingSale>(STORE_PENDING_SALES, "status", "pending"),
    add: (sale: PendingSale) => putItem(STORE_PENDING_SALES, sale),
    remove: (id: string) => deleteItem(STORE_PENDING_SALES, id),
    update: (sale: PendingSale) => putItem(STORE_PENDING_SALES, sale),
    clear: () => clearStore(STORE_PENDING_SALES),
  },
  products: {
    getAll: () => getStore<CachedProduct>(STORE_PRODUCTS),
    getBySku: (sku: string) => getByIndex<CachedProduct>(STORE_PRODUCTS, "sku", sku),
    getByBarcode: (code: string) => getByIndex<CachedProduct>(STORE_PRODUCTS, "codigo_barra", code),
    setAll: (products: CachedProduct[]) => putMany(STORE_PRODUCTS, products),
    clear: () => clearStore(STORE_PRODUCTS),
  },
  customers: {
    getAll: () => getStore<CachedCustomer>(STORE_CUSTOMERS),
    getByRuc: (ruc: string) => getByIndex<CachedCustomer>(STORE_CUSTOMERS, "ruc", ruc),
    getByCI: (ci: string) => getByIndex<CachedCustomer>(STORE_CUSTOMERS, "ci", ci),
    setAll: (customers: CachedCustomer[]) => putMany(STORE_CUSTOMERS, customers),
    clear: () => clearStore(STORE_CUSTOMERS),
  },
  syncState: {
    get: async (): Promise<SyncState | null> => {
      const all = await getStore<SyncState>(STORE_SYNC_STATE)
      return all[0] || null
    },
    set: (state: Partial<SyncState>) => putItem(STORE_SYNC_STATE, { id: "main", ...state } as SyncState),
  },
  receipts: {
    getAll: () => getStore<CachedReceipt>(STORE_RECEIPTS),
    getBySale: (saleId: string) => getByIndex<CachedReceipt>(STORE_RECEIPTS, "sale_id", saleId),
    add: (receipt: CachedReceipt) => putItem(STORE_RECEIPTS, receipt),
    remove: (id: string) => deleteItem(STORE_RECEIPTS, id),
    clear: () => clearStore(STORE_RECEIPTS),
  },
  clearAll: async () => {
    const stores = [STORE_CART, STORE_PENDING_SALES, STORE_PRODUCTS, STORE_CUSTOMERS, STORE_SYNC_STATE, STORE_RECEIPTS, STORE_TIMBRADOS, STORE_PAYMENT_METHODS, STORE_COMPANY_CONFIG, STORE_INVOICES]
    for (const s of stores) await clearStore(s)
  },
  timbrados: {
    getAll: () => getStore<CachedTimbrado>(STORE_TIMBRADOS),
    setAll: (items: CachedTimbrado[]) => putMany(STORE_TIMBRADOS, items),
    update: (item: CachedTimbrado) => putItem(STORE_TIMBRADOS, item),
    clear: () => clearStore(STORE_TIMBRADOS),
  },
  paymentMethods: {
    getAll: () => getStore<CachedPaymentMethod>(STORE_PAYMENT_METHODS),
    setAll: (items: CachedPaymentMethod[]) => putMany(STORE_PAYMENT_METHODS, items),
    clear: () => clearStore(STORE_PAYMENT_METHODS),
  },
  companyConfig: {
    get: async (): Promise<CachedCompanyConfig | null> => {
      const all = await getStore<any>(STORE_COMPANY_CONFIG)
      return all[0] || null
    },
    set: (config: CachedCompanyConfig) => putItem(STORE_COMPANY_CONFIG, { id: "main", ...config }),
    clear: () => clearStore(STORE_COMPANY_CONFIG),
  },
  invoices: {
    getAll: () => getStore<any>(STORE_INVOICES),
    add: (inv: any) => putItem(STORE_INVOICES, inv),
    update: (inv: any) => putItem(STORE_INVOICES, inv),
    getByEstado: (estado: string) => getByIndex<any>(STORE_INVOICES, "estado", estado),
    clear: () => clearStore(STORE_INVOICES),
  },
}
