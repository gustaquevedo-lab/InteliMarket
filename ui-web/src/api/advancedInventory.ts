const API_BASE = import.meta.env.VITE_API_URL || "/api"

function auth() {
  const token = localStorage.getItem("access_token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

function g<T>(e: string): Promise<T> {
  return fetch(`${API_BASE}/v1/advanced-inventory${e}`, { headers: auth() }).then(r => { if (!r.ok) throw new Error(); return r.json() })
}

function p<T>(e: string, d?: any): Promise<T> {
  return fetch(`${API_BASE}/v1/advanced-inventory${e}`, {
    method: "POST", headers: auth(), body: d ? JSON.stringify(d) : undefined,
  }).then(r => { if (!r.ok) throw new Error(); return r.json() })
}

function pu<T>(e: string, d: any): Promise<T> {
  return fetch(`${API_BASE}/v1/advanced-inventory${e}`, {
    method: "PUT", headers: auth(), body: JSON.stringify(d),
  }).then(r => { if (!r.ok) throw new Error(); return r.json() })
}

export const advInvApi = {
  dashboard: () => g<any>("/dashboard"),
  locations: (wh = "") => g<any[]>(`/locations${wh ? `?warehouse_id=${wh}` : ""}`),
  createLocation: (d: any) => p<any>("/locations", d),
  updateLocation: (id: string, d: any) => pu<any>(`/locations/${id}`, d),
  pickingLists: (estado = "") => g<any[]>(`/picking-lists${estado ? `?estado=${estado}` : ""}`),
  createPickingList: (d: any) => p<any>("/picking-lists", d),
  getPickingList: (id: string) => g<any>(`/picking-lists/${id}`),
  assignPickingList: (id: string, userId: string) => p<any>(`/picking-lists/${id}/assign`, { user_id: userId }),
  pickItem: (plId: string, itemId: string, d: any) => p<any>(`/picking-lists/${plId}/items/${itemId}/pick`, d),
  cycleCounts: (estado = "") => g<any[]>(`/cycle-counts${estado ? `?estado=${estado}` : ""}`),
  createCycleCount: (d: any) => p<any>("/cycle-counts", d),
  addCycleCountItem: (ccId: string, d: any) => p<any>(`/cycle-counts/${ccId}/items`, d),
  recordCount: (ccId: string, itemId: string, d: any) => p<any>(`/cycle-counts/${ccId}/items/${itemId}/count`, d),
  completeCycleCount: (ccId: string) => p<any>(`/cycle-counts/${ccId}/complete`),
  lots: (productId = "", warehouseId = "", expiringDays = 0) =>
    g<any[]>(`/lots?product_id=${productId}&warehouse_id=${warehouseId}&expiring_soon_days=${expiringDays}`),
  allocateFifo: (d: any) => p<any>("/lots/allocate", d),
  consignment: (supplierId = "") => g<any[]>(`/consignment${supplierId ? `?supplier_id=${supplierId}` : ""}`),
  createConsignment: (d: any) => p<any>("/consignment", d),
  addConsignmentMovement: (id: string, d: any) => p<any>(`/consignment/${id}/movements`, d),
  replenishRules: () => g<any[]>("/replenish-rules"),
  createReplenishRule: (d: any) => p<any>("/replenish-rules", d),
  alerts: () => g<any[]>("/alerts"),
}
