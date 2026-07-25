const API_BASE = import.meta.env.VITE_API_URL || "/api"

function authHeaders() {
  const token = localStorage.getItem("access_token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/marketing${endpoint}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiPost<T>(endpoint: string, data?: any): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/marketing${endpoint}`, {
    method: "POST",
    headers: authHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiPut<T>(endpoint: string, data: any): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/marketing${endpoint}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiDelete<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/marketing${endpoint}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const marketingApi = {
  dashboard: () => apiGet<any>("/dashboard"),

  // Segments
  listSegments: () => apiGet<any[]>("/segments"),
  createSegment: (data: any) => apiPost<any>("/segments", data),
  updateSegment: (id: string, data: any) => apiPut<any>(`/segments/${id}`, data),
  estimateSegment: (id: string) => apiPost<any>(`/segments/${id}/estimate`),

  // Campaigns
  listCampaigns: (limit = 20, offset = 0) => apiGet<any[]>(`/campaigns?limit=${limit}&offset=${offset}`),
  createCampaign: (data: any) => apiPost<any>("/campaigns", data),
  getCampaign: (id: string) => apiGet<any>(`/campaigns/${id}`),
  updateCampaign: (id: string, data: any) => apiPut<any>(`/campaigns/${id}`, data),
  executeCampaign: (id: string) => apiPost<any>(`/campaigns/${id}/execute`),

  // Stock Alerts
  listStockAlerts: () => apiGet<any[]>("/stock-alerts"),
  createStockAlert: (data: any) => apiPost<any>("/stock-alerts", data),
  deleteStockAlert: (id: string) => apiDelete<any>(`/stock-alerts/${id}`),
  checkStockAlerts: () => apiPost<any>("/stock-alerts/check"),

  // Offers
  listOffers: (customerId?: string) => apiGet<any[]>(`/offers${customerId ? `?customer_id=${customerId}` : ""}`),
  createOffer: (data: any) => apiPost<any>("/offers", data),
  generateOffers: () => apiPost<any>("/offers/generate"),

  // Surveys
  listSurveys: () => apiGet<any[]>("/surveys"),
  createSurvey: (data: any) => apiPost<any>("/surveys", data),
  getSurveyResponses: (surveyId: string) => apiGet<any[]>(`/surveys/${surveyId}/responses`),

  // Scheduled
  listScheduled: () => apiGet<any[]>("/scheduled"),
}
