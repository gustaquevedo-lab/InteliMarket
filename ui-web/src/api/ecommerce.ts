const API_BASE = import.meta.env.VITE_API_URL || "/api"

function ecomHeaders() {
  const token = localStorage.getItem("ecommerce_token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/ecommerce${endpoint}`, { headers: ecomHeaders() })
  if (!res.ok) throw new Error((await res.json()).detail || "Error")
  return res.json()
}

async function apiPost<T>(endpoint: string, data?: any): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/ecommerce${endpoint}`, {
    method: "POST", headers: ecomHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) throw new Error((await res.json()).detail || "Error")
  return res.json()
}

async function apiPut<T>(endpoint: string, data: any): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/ecommerce${endpoint}`, {
    method: "PUT", headers: ecomHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json()).detail || "Error")
  return res.json()
}

async function apiDel<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/ecommerce${endpoint}`, {
    method: "DELETE", headers: ecomHeaders(),
  })
  if (!res.ok) throw new Error((await res.json()).detail || "Error")
  return res.json()
}

function authHeaders() {
  const token = localStorage.getItem("access_token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const ecommerceApi = {
  catalog: (search = "", categoryId = "", page = 1) =>
    apiGet<any>(`/catalog?search=${encodeURIComponent(search)}&category_id=${categoryId}&page=${page}`),

  productDetail: (id: string) => apiGet<any>(`/catalog/${id}`),
  categories: () => apiGet<any[]>("/categories"),

  register: (data: any) =>
    fetch(`${API_BASE}/v1/ecommerce/auth/register`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify(data),
    }).then((r) => { if (!r.ok) throw new Error(); return r.json() }),

  login: (data: any) =>
    fetch(`${API_BASE}/v1/ecommerce/auth/login`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify(data),
    }).then((r) => { if (!r.ok) throw new Error(); return r.json() }),

  me: () => apiGet<any>("/auth/me"),

  cart: () => apiGet<any>("/cart"),
  addToCart: (productId: string, cantidad: number) =>
    apiPost<any>("/cart/items", { product_id: productId, cantidad }),
  updateCartItem: (itemId: string, cantidad: number) =>
    apiPut<any>(`/cart/items/${itemId}`, { cantidad }),
  removeCartItem: (itemId: string) => apiDel<any>(`/cart/items/${itemId}`),

  checkout: (metodoPago: string, direccionEnvio?: string, notas?: string) =>
    apiPost<any>("/checkout", { metodo_pago: metodoPago, direccion_envio: direccionEnvio, notas }),

  orders: () => apiGet<any[]>("/orders"),
  orderDetail: (id: string) => apiGet<any>(`/orders/${id}`),
  dashboard: () => apiGet<any>("/dashboard"),
}
