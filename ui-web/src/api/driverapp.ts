const API_BASE = import.meta.env.VITE_API_URL || "/api"

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error" }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

function authRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("driver_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  }
  return request<T>(endpoint, { ...options, headers })
}

export interface DriverDelivery {
  id: string; customer_nombre: string; customer_telefono: string | null;
  direccion: string; barrio: string | null; ciudad: string | null;
  referencia: string | null; latitud: number | null; longitud: number | null;
  estado: string; prioridad: string; observaciones: string | null;
  instrucciones_entrega: string | null; costo_delivery: number;
  tracking_code: string | null; driver_id: string | null;
  created_at: string; assigned_at: string | null;
  picked_up_at: string | null; in_transit_at: string | null;
  delivered_at: string | null; failed_at: string | null;
}

export interface DriverProof {
  id: string; delivery_id: string; tipo: string; url: string | null;
  codigo_confirmacion: string | null; nombre_recibio: string | null;
  observaciones: string | null; created_at: string;
}

export interface DriverInfo {
  id: string; nombre: string; telefono: string;
  status: string; total_deliveries: number; rating: number;
}

export const driverAppApi = {
  login: (telefono: string, pin: string) =>
    request<{ access_token: string; driver_id: string; nombre: string }>(
      "/v1/intelientregas/driver/login",
      { method: "POST", body: JSON.stringify({ telefono, pin }) }
    ),
  me: () => authRequest<DriverInfo>("/v1/intelientregas/driver/me"),
  deliveries: {
    list: (params?: { estado?: string }) => {
      const qs = params?.estado ? `?estado=${params.estado}` : ""
      return authRequest<DriverDelivery[]>(`/v1/intelientregas/driver/deliveries${qs}`)
    },
    get: (id: string) => authRequest<DriverDelivery>(`/v1/intelientregas/driver/deliveries/${id}`),
    updateStatus: (id: string, data: { estado: string; motivo_falla?: string }) =>
      authRequest<DriverDelivery>(`/v1/intelientregas/driver/deliveries/${id}/status`, {
        method: "PATCH", body: JSON.stringify(data),
      }),
    proofs: {
      list: (deliveryId: string) =>
        authRequest<DriverProof[]>(`/v1/intelientregas/driver/deliveries/${deliveryId}/proofs`),
      add: (deliveryId: string, data: any) =>
        authRequest<DriverProof>(`/v1/intelientregas/driver/deliveries/${deliveryId}/proofs`, {
          method: "POST", body: JSON.stringify(data),
        }),
    },
  },
  tracking: {
    send: (data: { delivery_id: string; latitud: number; longitud: number }) =>
      authRequest<any>("/v1/intelientregas/driver/tracking", {
        method: "POST", body: JSON.stringify(data),
      }),
  },
}
