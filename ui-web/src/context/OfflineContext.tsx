import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { offlineDB, type PendingSale, type OfflineCartItem, type CachedProduct, type CachedCustomer, type CachedReceipt } from "../utils/offlineDB"
import { syncFullCatalog, getCachedCatalog, syncPendingSales, syncPendingCupones, scheduleSyncRetry, cancelSyncRetry, saveOfflineReceipt, getOfflineReceipt, generateOfflineReceipt } from "../utils/syncManager"
import { syncSupervisorPins } from "../utils/localAuth"
import { api } from "../api"

interface OfflineContextType {
  isOnline: boolean
  lastSync: string | null
  pendingSalesCount: number
  pendingSales: PendingSale[]
  offlineCart: OfflineCartItem[]
  cachedProducts: CachedProduct[]
  cachedCustomers: CachedCustomer[]
  saveCartOffline: (items: OfflineCartItem[]) => void
  addPendingSale: (data: unknown) => Promise<string>
  syncPendingSales: () => Promise<number>
  syncCatalog: () => Promise<boolean>
  generateReceipt: (saleNumber: string, items: Array<{ nombre: string; cantidad: number; precio: number; total: number }>, total: number, iva10: number, iva5: number, paymentMethod: string, customerName: string | null, branchName: string) => { html: string; print: () => void }
  saveReceipt: (saleId: string, saleNumber: string, html: string) => Promise<void>
  getReceipt: (saleId: string) => Promise<CachedReceipt | null>
}

const OfflineContext = createContext<OfflineContextType | null>(null)

// navigator.onLine solo detecta cable/wifi desconectado -- NO detecta el
// caso mas comun en la practica (API caida o colgada con la red local
// intacta, ej. uvicorn crasheado o la DB bloqueada). Por eso isOnline se
// decide con un heartbeat real contra el propio backend, no con esa
// propiedad del navegador.
const HEARTBEAT_INTERVAL_MS = 15000
const HEARTBEAT_TIMEOUT_MS = 4000
const FAILS_TO_GO_OFFLINE = 2

async function checkServerReachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), HEARTBEAT_TIMEOUT_MS)
    const res = await fetch("/api/health", { signal: ctrl.signal, cache: "no-store" })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([])
  const [offlineCart, setOfflineCart] = useState<OfflineCartItem[]>([])
  const [cachedProducts, setCachedProducts] = useState<CachedProduct[]>([])
  const [cachedCustomers, setCachedCustomers] = useState<CachedCustomer[]>([])
  const [lastSync, setLastSync] = useState<string | null>(null)
  const consecutiveFailsRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const ok = await checkServerReachable()
      if (cancelled) return
      if (ok) {
        consecutiveFailsRef.current = 0
        setIsOnline(true)
      } else {
        consecutiveFailsRef.current += 1
        // No basta un solo fallo (podria ser una request puntual lenta) --
        // se piden FAILS_TO_GO_OFFLINE seguidos antes de declarar offline,
        // para no parpadear entre modos por un timeout aislado.
        if (consecutiveFailsRef.current >= FAILS_TO_GO_OFFLINE) setIsOnline(false)
      }
    }
    tick()
    const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS)
    // El evento 'offline' del navegador (cable/wifi caido) es una señal
    // valida e inmediata -- se respeta sin esperar al heartbeat. El evento
    // 'online', en cambio, solo dispara un chequeo real: que el sistema
    // operativo vea red de nuevo no significa que el servidor responda.
    const onBrowserOffline = () => {
      consecutiveFailsRef.current = FAILS_TO_GO_OFFLINE
      setIsOnline(false)
    }
    const onBrowserOnline = () => { tick() }
    window.addEventListener("online", onBrowserOnline)
    window.addEventListener("offline", onBrowserOffline)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("online", onBrowserOnline)
      window.removeEventListener("offline", onBrowserOffline)
    }
  }, [])

  const loadOfflineData = useCallback(async () => {
    try {
      const [sales, cart, catalog] = await Promise.all([
        offlineDB.pendingSales.getAll(),
        offlineDB.cart.getAll(),
        getCachedCatalog(),
      ])
      // Filtra registros null/corruptos de IndexedDB -- un solo registro asi
      // (visto en Caja 3, 17-sep) rompia el render de TODA la app, incluido
      // /login, porque este Provider envuelve el arbol entero.
      setPendingSales(sales.filter((s): s is PendingSale => !!s))
      setOfflineCart(cart)
      setCachedProducts(catalog.products)
      setCachedCustomers(catalog.customers)
      setLastSync(catalog.lastSync)
    } catch {}
  }, [])

  useEffect(() => { loadOfflineData() }, [])

  const syncCatalogFn = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine || !localStorage.getItem("access_token")) return false
    const result = await syncFullCatalog()
    if (result.success) {
      const catalog = await getCachedCatalog()
      setCachedProducts(catalog.products)
      setCachedCustomers(catalog.customers)
      setLastSync(catalog.lastSync)
    }
    return result.success
  }, [])

  useEffect(() => {
    if (isOnline) {
      syncCatalogFn()
      scheduleSyncRetry(() => {
        offlineDB.pendingSales.getAll().then(s => setPendingSales(s))
      })
    } else {
      cancelSyncRetry()
    }
    return () => cancelSyncRetry()
  }, [isOnline])

  // Refresco periodico de los PINs de autorizacion de supervisor, sin
  // depender de que la conexion "flapee" -- si la caja queda online varias
  // horas seguidas (turno completo), igual conviene refrescar de tanto en
  // tanto para reflejar PINs nuevos o cuentas dadas de baja.
  useEffect(() => {
    if (!isOnline) return
    const t = setInterval(() => { syncSupervisorPins().catch(() => {}) }, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [isOnline])

  const saveCartOffline = async (items: OfflineCartItem[]) => {
    setOfflineCart(items)
    await offlineDB.cart.set(items)
  }

  const addPendingSale = async (data: unknown): Promise<string> => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const sale: PendingSale = {
      id,
      data,
      created_at: now,
      status: "pending",
      retry_count: 0,
      last_retry: now,
      next_retry: now,
    }
    await offlineDB.pendingSales.add(sale)
    setPendingSales(prev => [...prev, sale])
    return id
  }

  const doSyncPendingSales = async (): Promise<number> => {
    const [salesResult] = await Promise.allSettled([
      syncPendingSales(),
      syncPendingCupones()
    ])
    const sales = await offlineDB.pendingSales.getAll()
    setPendingSales(sales)
    return salesResult.status === "fulfilled" ? salesResult.value.synced : 0
  }

  const generateReceipt = (
    saleNumber: string,
    items: Array<{ nombre: string; cantidad: number; precio: number; total: number }>,
    total: number,
    iva10: number,
    iva5: number,
    paymentMethod: string,
    customerName: string | null,
    branchName: string,
  ) => {
    const html = generateOfflineReceipt(saleNumber, items, total, iva10, iva5, paymentMethod, customerName, branchName)
    return {
      html,
      print: () => {
        const win = window.open("", "_blank", "width=300,height=600")
        if (win) {
          win.document.write(html)
          win.document.close()
          win.print()
        }
      },
    }
  }

  return (
    <OfflineContext.Provider value={{
      isOnline, lastSync, pendingSalesCount: pendingSales.filter(s => s && s.status === "pending").length,
      pendingSales, offlineCart, cachedProducts, cachedCustomers,
      saveCartOffline, addPendingSale,
      syncPendingSales: doSyncPendingSales,
      syncCatalog: syncCatalogFn,
      generateReceipt,
      saveReceipt: saveOfflineReceipt,
      getReceipt: getOfflineReceipt,
    }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider")
  return ctx
}
