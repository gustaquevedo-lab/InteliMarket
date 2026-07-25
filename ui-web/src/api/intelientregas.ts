const API_BASE = import.meta.env.VITE_API_URL || "/api"

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("access_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error desconocido" }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

// ========== INTELIENTREGAS INTERFACES ==========
export interface TrackDriver {
  id: string; company_id: string; nombre: string; ci: string | null;
  telefono: string; email: string | null; licencia_numero: string | null;
  licencia_vencimiento: string | null; status: string; rating: number;
  total_deliveries: number; activo: boolean; created_at: string; updated_at: string;
}

export interface TrackVehicle {
  id: string; company_id: string; driver_id: string | null; tipo: string;
  marca: string | null; modelo: string | null; color: string | null;
  patente: string | null; anio: number | null; capacidad_kg: number | null;
  tiene_caja_termica: boolean; activo: boolean; created_at: string;
}

export interface TrackDelivery {
  id: string; company_id: string; sale_id: string | null; customer_id: string | null;
  branch_id: string | null; driver_id: string | null; vehicle_id: string | null;
  route_id: string | null; customer_nombre: string; customer_telefono: string | null;
  customer_ci: string | null; direccion: string; barrio: string | null;
  ciudad: string | null; referencia: string | null; latitud: number | null;
  longitud: number | null; estado: string; prioridad: string; observaciones: string | null;
  instrucciones_entrega: string | null; scheduled_from: string | null;
  scheduled_to: string | null; assigned_at: string | null; picked_up_at: string | null;
  in_transit_at: string | null; delivered_at: string | null; failed_at: string | null;
  motivo_falla: string | null; costo_delivery: number; cobrado: boolean;
  tracking_code: string | null; external_order_id: string | null;
  activo: boolean; created_at: string; updated_at: string;
}

export interface TrackRoute {
  id: string; company_id: string; driver_id: string | null; vehicle_id: string | null;
  nombre: string; fecha: string; estado: string; total_stops: number;
  completed_stops: number; distancia_km: number | null;
  duracion_estimada_min: number | null; observaciones: string | null;
  started_at: string | null; completed_at: string | null;
  created_at: string; updated_at: string;
}

export interface TrackTrackingEvent {
  id: string; delivery_id: string; driver_id: string | null;
  latitud: number; longitud: number; evento: string;
  created_at: string;
}

export interface TrackProof {
  id: string; delivery_id: string; tipo: string; url: string | null;
  codigo_confirmacion: string | null; nombre_recibio: string | null;
  relacion: string | null; observaciones: string | null; created_at: string;
}

export interface TrackZone {
  id: string; nombre: string; costo_base: number; costo_km: number;
  tiempo_estimado_min: number; activo: boolean;
}

export interface TrackStats {
  total_deliveries: number; by_estado: Record<string, number>;
  pending: number; in_transit: number; delivered: number;
  failed: number; avg_driver_rating: number;
}

// ========== INTELIENTREGAS API ==========
export const intelientregasApi = {
  drivers: {
    list: (params?: { status?: string; activo?: boolean }) => {
      const filtered = Object.entries(params || {}).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      return request<TrackDriver[]>(`/v1/intelientregas/drivers?${new URLSearchParams(filtered)}`)
    },
    get: (id: string) => request<TrackDriver>(`/v1/intelientregas/drivers/${id}`),
    create: (data: any) => request<TrackDriver>("/v1/intelientregas/drivers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<TrackDriver>(`/v1/intelientregas/drivers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/v1/intelientregas/drivers/${id}`, { method: "DELETE" }),
  },
  vehicles: {
    list: (params?: { tipo?: string; activo?: boolean }) => {
      const filtered = Object.entries(params || {}).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      return request<TrackVehicle[]>(`/v1/intelientregas/vehicles?${new URLSearchParams(filtered)}`)
    },
    get: (id: string) => request<TrackVehicle>(`/v1/intelientregas/vehicles/${id}`),
    create: (data: any) => request<TrackVehicle>("/v1/intelientregas/vehicles", { method: "POST", body: JSON.stringify(data) }),
  },
  deliveries: {
    list: (params?: { estado?: string; driver_id?: string; limit?: number; offset?: number }) => {
      const filtered = Object.entries(params || {}).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      return request<TrackDelivery[]>(`/v1/intelientregas/deliveries?${new URLSearchParams(filtered)}`)
    },
    get: (id: string) => request<TrackDelivery>(`/v1/intelientregas/deliveries/${id}`),
    create: (data: any) => request<TrackDelivery>("/v1/intelientregas/deliveries", { method: "POST", body: JSON.stringify(data) }),
    assign: (id: string, data: { driver_id: string; vehicle_id?: string }) =>
      request<TrackDelivery>(`/v1/intelientregas/deliveries/${id}/assign`, { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: string, data: { estado: string; motivo_falla?: string }) =>
      request<TrackDelivery>(`/v1/intelientregas/deliveries/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),
    proofs: {
      list: (deliveryId: string) => request<TrackProof[]>(`/v1/intelientregas/deliveries/${deliveryId}/proofs`),
      add: (deliveryId: string, data: any) => request<TrackProof>(`/v1/intelientregas/deliveries/${deliveryId}/proofs`, { method: "POST", body: JSON.stringify(data) }),
    },
    autoAssignCandidates: (id: string) =>
      request<{ delivery_id: string; candidates: Array<{ driver_id: string; driver_nombre: string; driver_rating: number; driver_total_deliveries: number; vehicle_id: string | null; vehicle_tipo: string | null; vehicle_capacidad_kg: number | null; distance_km: number | null; score: number }> }>(`/v1/intelientregas/deliveries/${id}/auto-assign-candidates`, { method: "POST" }),
    autoAssignBatch: () =>
      request<{ assigned: number; pending: number; errors: number }>("/v1/intelientregas/deliveries/auto-assign-batch", { method: "POST" }),
  },
  routes: {
    list: (params?: { fecha?: string; estado?: string; driver_id?: string }) => {
      const filtered = Object.entries(params || {}).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      return request<TrackRoute[]>(`/v1/intelientregas/routes?${new URLSearchParams(filtered)}`)
    },
    get: (id: string) => request<TrackRoute>(`/v1/intelientregas/routes/${id}`),
    create: (data: any) => request<TrackRoute>("/v1/intelientregas/routes", { method: "POST", body: JSON.stringify(data) }),
    start: (id: string) => request<TrackRoute>(`/v1/intelientregas/routes/${id}/start`, { method: "POST" }),
    complete: (id: string) => request<TrackRoute>(`/v1/intelientregas/routes/${id}/complete`, { method: "POST" }),
    optimize: (routeId: string) => request<any>(`/v1/intelientregas/routes/optimize?route_id=${routeId}`, { method: "POST" }),
    calculateRoute: (stops: Array<{ lat: number; lng: number }>) => request<any>("/v1/intelientregas/routes/calculate-route", { method: "POST", body: JSON.stringify(stops) }),
  },
  tracking: {
    byDelivery: (deliveryId: string, limit?: number) =>
      request<TrackTrackingEvent[]>(`/v1/intelientregas/tracking/${deliveryId}?${limit ? `limit=${limit}` : ""}`),
    driverLastPosition: (driverId: string) =>
      request<TrackTrackingEvent>(`/v1/intelientregas/tracking/driver/${driverId}/last-position`),
    create: (data: any) => request<TrackTrackingEvent>("/v1/intelientregas/tracking", { method: "POST", body: JSON.stringify(data) }),
  },
  zones: {
    list: () => request<TrackZone[]>("/v1/intelientregas/zones"),
    create: (data: any) => request<TrackZone>("/v1/intelientregas/zones", { method: "POST", body: JSON.stringify(data) }),
    calculateCost: (latitud: number, longitud: number) =>
      request<any>("/v1/intelientregas/zones/calculate-cost", { method: "POST", body: JSON.stringify({ latitud, longitud }) }),
  },
  stats: {
    get: () => request<TrackStats>("/v1/intelientregas/stats"),
  },
  analytics: {
    get: () => request<any>("/v1/intelientregas/analytics"),
    profitability: (days?: number) => request<any>(`/v1/intelientregas/analytics/profitability${days ? `?days=${days}` : ""}`),
    marginsRoutes: (days?: number, limit?: number) => request<any[]>(`/v1/intelientregas/analytics/margins/routes?${new URLSearchParams({ ...(days && { days: String(days) }), ...(limit && { limit: String(limit) }) })}`),
    marginsDrivers: (days?: number, limit?: number) => request<any[]>(`/v1/intelientregas/analytics/margins/drivers?${new URLSearchParams({ ...(days && { days: String(days) }), ...(limit && { limit: String(limit) }) })}`),
    marginsVehicles: (days?: number, limit?: number) => request<any[]>(`/v1/intelientregas/analytics/margins/vehicles?${new URLSearchParams({ ...(days && { days: String(days) }), ...(limit && { limit: String(limit) }) })}`),
    marginsZones: (days?: number) => request<any[]>(`/v1/intelientregas/analytics/margins/zones${days ? `?days=${days}` : ""}`),
    businessLines: (days?: number) => request<any[]>(`/v1/intelientregas/analytics/business-lines${days ? `?days=${days}` : ""}`),
    kpi: (days?: number) => request<any>(`/v1/intelientregas/analytics/kpi${days ? `?days=${days}` : ""}`),
    exportExcel: (days?: number) => {
      const token = localStorage.getItem("access_token")
      const qs = days ? `?days=${days}` : ""
      return fetch(`${API_BASE}/v1/intelientregas/analytics/export/excel${qs}`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      }).then(r => { if (!r.ok) throw new Error("Error al exportar"); return r.blob() })
    },
    exportPdf: (days?: number) => {
      const token = localStorage.getItem("access_token")
      const qs = days ? `?days=${days}` : ""
      return fetch(`${API_BASE}/v1/intelientregas/analytics/export/pdf${qs}`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      }).then(r => { if (!r.ok) throw new Error("Error al exportar"); return r.blob() })
    },
  },
  fleet: {
    dashboard: () => request<any>("/v1/intelientregas/fleet/dashboard"),
    maintenance: {
      list: (params?: { vehicle_id?: string; status?: string }) => {
        const q = Object.entries(params || {}).filter(([_, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
        return request<any[]>(`/v1/intelientregas/fleet/maintenance${q ? "?" + q : ""}`)
      },
      create: (data: any) => request<any>("/v1/intelientregas/fleet/maintenance", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: any) => request<any>(`/v1/intelientregas/fleet/maintenance/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    },
    fuel: {
      list: (params?: { vehicle_id?: string; limit?: number }) => {
        const q = Object.entries(params || {}).filter(([_, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
        return request<any[]>(`/v1/intelientregas/fleet/fuel${q ? "?" + q : ""}`)
      },
      create: (data: any) => request<any>("/v1/intelientregas/fleet/fuel", { method: "POST", body: JSON.stringify(data) }),
    },
    expenses: {
      list: (params?: { vehicle_id?: string; limit?: number }) => {
        const q = Object.entries(params || {}).filter(([_, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
        return request<any[]>(`/v1/intelientregas/fleet/expenses${q ? "?" + q : ""}`)
      },
      create: (data: any) => request<any>("/v1/intelientregas/fleet/expenses", { method: "POST", body: JSON.stringify(data) }),
    },
    checklistItems: {
      list: (categoria?: string) => request<any[]>(`/v1/intelientregas/fleet/checklist-items${categoria ? "?categoria=" + categoria : ""}`),
      create: (data: any) => request<any>("/v1/intelientregas/fleet/checklist-items", { method: "POST", body: JSON.stringify(data) }),
    },
    submitChecklist: (data: any) => request<any>("/v1/intelientregas/fleet/checklist-submit", { method: "POST", body: JSON.stringify(data) }),
  },
  liveMap: {
    get: () => request<any[]>("/v1/intelientregas/live-map"),
  },
  alerts: {
    list: () => request<any[]>("/v1/intelientregas/fleet/alerts"),
  },
}
