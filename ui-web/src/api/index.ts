const API_BASE = import.meta.env.VITE_API_URL || "/api"

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("access_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error desconocido" }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  if (response.status === 204) return undefined as T
  return response.json()
}

export const api = {
  auth: {
    login: (data: { email: string; password: string }) =>
      request<{ access_token: string; refresh_token: string }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    register: (data: { email: string; password: string; nombre: string; tenant_nombre: string }) =>
      request<{ access_token: string; refresh_token: string }>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: (email: string) =>
      request<{ id: string; email: string; nombre: string; rol: string; activo: boolean }>("/v1/auth/me", {
        headers: { "X-User-Email": email },
      }),
    myTenants: (email: string) =>
      request<Array<{ tenant_id: string; tenant_nombre: string; tenant_slug: string; plan: string; rol: string }>>("/v1/auth/me/tenants", {
        headers: { "X-User-Email": email },
      }),
  },
  companies: {
    list: () => request<Array<unknown>>("/v1/companies"),
    get: (id: string) => request<unknown>(`/v1/companies/${id}`),
    create: (data: unknown) => request<unknown>("/v1/companies", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request<unknown>(`/v1/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    delete: (id: string) => request<void>(`/v1/companies/${id}`, { method: "DELETE" }),
  },
}
