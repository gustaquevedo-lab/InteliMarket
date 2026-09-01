import { offlineDB } from "./offlineDB"
import type { Product, Customer } from "../api"


export async function loadCachedPOSData(): Promise<{
  cachedProducts: Product[]
  cachedCustomers: Customer[]
  cachedStaff: any[]
}> {
  let cachedProducts: Product[] = []
  let cachedCustomers: Customer[] = []
  let cachedStaff: any[] = []

  try {
    const [dbProducts, dbCustomers, dbStaff] = await Promise.allSettled([
      offlineDB.products.getAll(),
      offlineDB.customers.getAll(),
      offlineDB.staff.getAll(),
    ])

    if (dbProducts.status === "fulfilled" && dbProducts.value.length > 0) {
      cachedProducts = dbProducts.value as Product[]
    }
    if (dbCustomers.status === "fulfilled" && dbCustomers.value.length > 0) {
      cachedCustomers = dbCustomers.value as Customer[]
    }
    if (dbStaff.status === "fulfilled" && dbStaff.value.length > 0) {
      cachedStaff = dbStaff.value
    }
  } catch (e) {
    console.warn("[posOfflineSync] Error reading IndexedDB:", e)
  }

  // Fallback to localStorage if IndexedDB had not yet been populated
  if (cachedProducts.length === 0) {
    try {
      const lsProds = localStorage.getItem("pos_cached_products")
      if (lsProds) cachedProducts = JSON.parse(lsProds)
    } catch {}
  }
  if (cachedCustomers.length === 0) {
    try {
      const lsCusts = localStorage.getItem("pos_cached_customers")
      if (lsCusts) cachedCustomers = JSON.parse(lsCusts)
    } catch {}
  }

  return { cachedProducts, cachedCustomers, cachedStaff }
}

export async function persistPOSCatalog(
  products: Product[],
  customers: Customer[],
  staff?: any[],
  rates?: any[]
): Promise<void> {
  try {
    const promises: Promise<any>[] = []
    if (products && products.length > 0) {
      promises.push(offlineDB.products.setAll(products))
      try {
        localStorage.setItem("pos_cached_products", JSON.stringify(products.slice(0, 1000)))
      } catch {}
    }
    if (customers && customers.length > 0) {
      promises.push(offlineDB.customers.setAll(customers))
      try {
        localStorage.setItem("pos_cached_customers", JSON.stringify(customers.slice(0, 2000)))
      } catch {}
    }
    if (staff && staff.length > 0) {
      promises.push(offlineDB.staff.setAll(staff))
    }
    if (rates && rates.length > 0) {
      promises.push(offlineDB.rates.setAll(rates))
    }
    await Promise.allSettled(promises)
    await offlineDB.syncState.set({
      last_full_sync: new Date().toISOString(),
      pending_count: 0,
    })
  } catch (e) {
    console.warn("[posOfflineSync] Error persisting to IndexedDB:", e)
  }
}
