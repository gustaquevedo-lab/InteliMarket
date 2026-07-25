import { useDriverStore } from "../stores/driverStore"
import * as SecureStore from "expo-secure-store"

const BASE_URL = "https://api.intelimarket.py/api/v1"
const MAX_RETRIES = 3

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync("auth_token")
  } catch {
    return null
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
  options: { timeout?: number; skipQueue?: boolean } = {}
): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const controller = new AbortController()
  const timeout = options.timeout || 15000
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      throw new ApiError(errorBody || `HTTP ${response.status}`, response.status)
    }

    return await response.json()
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error instanceof ApiError) throw error
    if (error.name === "AbortError") throw new ApiError("Request timed out", 408)

    if (!options.skipQueue) {
      await queueRequest({ method, path, body })
    }
    throw new ApiError(error.message || "Network error", 0)
  }
}

let queue: any[] = []
async function queueRequest(req: { method: string; path: string; body?: any }) {
  queue.push({ ...req, id: Date.now().toString(), retry_count: 0, created_at: new Date().toISOString() })
  try {
    const existing = await SecureStore.getItemAsync("sync_queue")
    const items = existing ? JSON.parse(existing) : []
    items.push(req)
    await SecureStore.setItemAsync("sync_queue", JSON.stringify(items))
  } catch {}
  useDriverStore.getState().setSyncQueueCount(queue.length)
}

export async function replayQueue(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync("sync_queue")
    if (!raw) return 0
    const items = JSON.parse(raw)
    let replayed = 0
    const remaining: any[] = []
    for (const item of items) {
      if (item.retry_count >= MAX_RETRIES) continue
      try {
        await request(item.method, item.path, item.body, { skipQueue: true })
        replayed++
      } catch {
        item.retry_count++
        remaining.push(item)
      }
    }
    await SecureStore.setItemAsync("sync_queue", JSON.stringify(remaining))
    queue = remaining
    useDriverStore.getState().setSyncQueueCount(remaining.length)
    return replayed
  } catch {
    return 0
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T>(path: string, body?: any) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),

  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; user: any }>("POST", "/auth/login", { email, password }),
    me: () => request<any>("GET", "/auth/me"),
  },

  deliveries: {
    today: () => request<any[]>("GET", "/intelientregas/deliveries?status=pending,assigned,in_progress"),
    get: (id: string) => request<any>("GET", `/intelientregas/deliveries/${id}`),
    updateStatus: (id: string, status: string, data?: any) =>
      request<any>("PUT", `/intelientregas/deliveries/${id}/status`, { status, ...data }),
  },

  routes: {
    today: () => request<any[]>("GET", "/intelientregas/routes?status=planned,in_progress"),
    get: (id: string) => request<any>("GET", `/intelientregas/routes/${id}`),
    start: (id: string) => request<any>("POST", `/intelientregas/routes/${id}/start`),
    complete: (id: string) => request<any>("POST", `/intelientregas/routes/${id}/complete`),
    optimize: (id: string) => request<any>("POST", `/intelientregas/fase2/routes/${id}/optimize`),
  },

  stops: {
    list: (routeId: string) => request<any[]>("GET", `/intelientregas/routes/${routeId}/stops`),
    complete: (stopId: string, data: any) =>
      request<any>("POST", `/intelientregas/routes/stops/${stopId}/complete`, data),
  },

  tracking: {
    ping: (data: any) => request<any>("POST", "/intelientregas/tracking", data),
    lastPosition: (driverId: string) => request<any>("GET", `/intelientregas/tracking/driver/${driverId}/last`),
  },

  proofs: {
    add: (deliveryId: string, data: any) =>
      request<any>("POST", `/intelientregas/deliveries/${deliveryId}/proofs`, data),
    list: (deliveryId: string) =>
      request<any[]>("GET", `/intelientregas/deliveries/${deliveryId}/proofs`),
  },

  vehicle: {
    assigned: () => request<any>("GET", "/intelientregas/vehicles/mine"),
  },

  checklist: {
    items: () => request<any[]>("GET", "/intelientregas/fase2/fleet/checklist-items"),
    submit: (data: any) => request<any>("POST", "/intelientregas/fase2/fleet/checklist-logs", data),
  },

  incidents: {
    report: (data: any) => request<any>("POST", "/intelientregas/deliveries/incidents", data),
  },
}
