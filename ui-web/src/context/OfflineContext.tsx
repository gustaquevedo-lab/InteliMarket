import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { offlineDB, type PendingSale, type OfflineCartItem, type CachedProduct, type CachedCustomer, type CachedReceipt } from "../utils/offlineDB"
import { syncFullCatalog, getCachedCatalog, syncPendingSales, scheduleSyncRetry, cancelSyncRetry, saveOfflineReceipt, getOfflineReceipt, generateOfflineReceipt } from "../utils/syncManager"
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

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([])
  const [offlineCart, setOfflineCart] = useState<OfflineCartItem[]>([])
  const [cachedProducts, setCachedProducts] = useState<CachedProduct[]>([])
  const [cachedCustomers, setCachedCustomers] = useState<CachedCustomer[]>([])
  const [lastSync, setLastSync] = useState<string | null>(null)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  const loadOfflineData = useCallback(async () => {
    try {
      const [sales, cart, catalog] = await Promise.all([
        offlineDB.pendingSales.getAll(),
        offlineDB.cart.getAll(),
        getCachedCatalog(),
      ])
      setPendingSales(sales)
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
    const result = await syncPendingSales()
    const sales = await offlineDB.pendingSales.getAll()
    setPendingSales(sales)
    return result.synced
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
      isOnline, lastSync, pendingSalesCount: pendingSales.filter(s => s.status === "pending").length,
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
