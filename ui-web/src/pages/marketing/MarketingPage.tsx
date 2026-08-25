import { useEntityLookup, getCustomerName } from "../../hooks/useEntityLookup"
import { useState, useEffect } from "react"
import { useFeatures } from "../../context/FeatureContext"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

function apiGet(endpoint: string) {
  const token = localStorage.getItem("access_token")
  return fetch(`${API_BASE}/v1/marketing${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => { if (!r.ok) throw new Error(); return r.json() })
}

function apiPost(endpoint: string, data?: any) {
  const token = localStorage.getItem("access_token")
  return fetch(`${API_BASE}/v1/marketing${endpoint}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  }).then((r) => { if (!r.ok) throw new Error(); return r.json() })
}

function apiPut(endpoint: string, data: any) {
  const token = localStorage.getItem("access_token")
  return fetch(`${API_BASE}/v1/marketing${endpoint}`, {
    method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => { if (!r.ok) throw new Error(); return r.json() })
}

function apiDelete(endpoint: string) {
  const token = localStorage.getItem("access_token")
  return fetch(`${API_BASE}/v1/marketing${endpoint}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => { if (!r.ok) throw new Error(); return r.json() })
}




export default function MarketingPage() {
  useEntityLookup()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<any>(null)
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Automatización de Marketing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Segmentación, campañas, alertas, ofertas y encuestas</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "segments", label: "Segmentos" },
            { key: "campaigns", label: "Campañas" },
            { key: "alerts", label: "Alertas Stock" },
            { key: "offers", label: "Ofertas" },
            { key: "surveys", label: "Encuestas" },
          ].map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${activeTab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "segments" && <SegmentsTab />}
      {activeTab === "campaigns" && <CampaignsTab />}
      {activeTab === "alerts" && <StockAlertsTab />}
      {activeTab === "offers" && <OffersTab />}
      {activeTab === "surveys" && <SurveysTab />}
    </div>
  )
}

/* ── Dashboard Tab ────────────────────────────────────────────── */
function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { apiGet("/dashboard").then(setData).catch(() => {}).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="text-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Segmentos</p>
          <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-blue-600 mt-1">{data?.segment_count || 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Campañas Totales</p>
          <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-green-600 mt-1">{data?.campaign_count || 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Alertas Activas</p>
          <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-purple-600 mt-1">{data?.alert_count || 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Ofertas Activas</p>
          <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-amber-600 mt-1">{data?.offer_count || 0}</p>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Campañas Recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Nombre</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Canal</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Estado</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Enviados</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Apertura</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Conversión</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_campaigns || []).map((c: any) => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-5 py-3 font-medium">{c.nombre}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{c.canal}</span></td>
                  <td className="px-5 py-3"><CampaignBadge estado={c.estado} /></td>
                  <td className="px-5 py-3 text-right">{c.sent_count || 0}</td>
                  <td className="px-5 py-3 text-right">{c.opened_count || 0} ({c.total_recipients ? Math.round((c.opened_count / c.total_recipients) * 100) : 0}%)</td>
                  <td className="px-5 py-3 text-right">{c.converted_count || 0}</td>
                </tr>
              ))}
              {(!data?.recent_campaigns || data.recent_campaigns.length === 0) && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Sin campañas aún</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">KPIs de Marketing</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Tasa apertura prom.:</span><br /><span className="font-bold">{data?.avg_open_rate?.toFixed(1) || 0}%</span></div>
          <div><span className="text-gray-500">Tasa clics prom.:</span><br /><span className="font-bold">{data?.avg_click_rate?.toFixed(1) || 0}%</span></div>
          <div><span className="text-gray-500">Tasa conversión:</span><br /><span className="font-bold">{data?.avg_conversion_rate?.toFixed(1) || 0}%</span></div>
          <div><span className="text-gray-500">Encuestas completadas:</span><br /><span className="font-bold">{data?.survey_response_count || 0}</span></div>
        </div>
      </div>
    </div>
  )
}

function CampaignBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    borrador: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    programada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    ejecutando: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    completada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelada: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  }
  const labels: Record<string, string> = {
    borrador: "Borrador", programada: "Programada", ejecutando: "Ejecutando",
    completada: "Completada", cancelada: "Cancelada",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[estado] || styles.borrador}`}>{labels[estado] || estado}</span>
}

/* ── Segments Tab ─────────────────────────────────────────────── */
function SegmentsTab() {
  const [segments, setSegments] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [filters, setFilters] = useState("{}")

  const load = () => apiGet("/segments").then(setSegments).catch(() => {})

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      const seg = await apiPost("/segments", { nombre: name, descripcion: desc, filters: JSON.parse(filters) || {} })
      await load()
      setShowForm(false); setName(""); setDesc(""); setFilters("{}")
    } catch {}
  }

  const handleEstimate = async (id: string) => {
    await apiPost(`/segments/${id}/estimate`)
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Segmentos de Clientes</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          {showForm ? "Cancelar" : "+ Nuevo Segmento"}
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field w-full" placeholder="Ej: Clientes frecuentes" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className="input-field w-full" placeholder="Segmento de clientes con alta frecuencia" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Filtros (JSON)</label>
            <textarea value={filters} onChange={(e) => setFilters(e.target.value)} rows={4} className="input-field w-full font-mono text-xs"
              placeholder='{"min_frecuencia": 5, "min_monto": 1000000}' />
          </div>
          <button onClick={handleCreate} className="btn-primary px-6">Crear Segmento</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Nombre</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Descripción</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Est. Clientes</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Último Cálculo</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Activo</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-medium">{s.nombre}</td>
                <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{s.descripcion || "-"}</td>
                <td className="px-5 py-3 text-right font-bold">{s.estimated_count ?? "—"}</td>
                <td className="px-5 py-3 text-gray-500">{s.last_calculated_at ? new Date(s.last_calculated_at).toLocaleString("es-PY") : "—"}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${s.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{s.activo ? "Sí" : "No"}</span></td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => handleEstimate(s.id)} className="text-xs text-blue-600 hover:underline">Estimar</button>
                </td>
              </tr>
            ))}
            {segments.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Sin segmentos creados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Campaigns Tab ────────────────────────────────────────────── */
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [segments, setSegments] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)

  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [canal, setCanal] = useState("whatsapp")
  const [tipo, setTipo] = useState("promocion")
  const [contenido, setContenido] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")

  const load = () => { apiGet("/campaigns?limit=50").then(setCampaigns).catch(() => {}); apiGet("/segments").then(setSegments).catch(() => {}) }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await apiPost("/campaigns", {
        nombre, descripcion, canal, tipo, contenido,
        segment_id: segmentId || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      await load(); setShowForm(false)
      setNombre(""); setDescripcion(""); setCanal("whatsapp"); setTipo("promocion"); setContenido(""); setSegmentId(""); setScheduledAt("")
    } catch {}
  }

  const loadDetail = async (id: string) => {
    try { const d = await apiGet(`/campaigns/${id}`); setDetail(d); setSelected(id) } catch {}
  }

  const handleExecute = async (id: string) => {
    try { await apiPost(`/campaigns/${id}/execute`); await load() } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Campañas</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          {showForm ? "Cancelar" : "+ Nueva Campaña"}
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Canal</label>
              <select value={canal} onChange={(e) => setCanal(e.target.value)} className="input-field w-full">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-field w-full">
                <option value="promocion">Promoción</option>
                <option value="recordatorio">Recordatorio</option>
                <option value="encuesta">Encuesta</option>
                <option value="reactivacion">Reactivación</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Segmento</label>
              <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className="input-field w-full">
                <option value="">Todos los clientes</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="input-field w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Contenido / Mensaje</label>
              <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={3} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Programar para</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-field w-full" />
            </div>
          </div>
          <button onClick={handleCreate} className="btn-primary px-6">Crear Campaña</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Lista de Campañas</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
            {campaigns.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-400">Sin campañas</p>
            ) : campaigns.map((c) => (
              <div key={c.id} className={`px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition ${selected === c.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`} onClick={() => loadDetail(c.id)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900 dark:text-white">{c.nombre}</span>
                  <CampaignBadge estado={c.estado} />
                </div>
                <p className="text-xs text-gray-500">{c.canal} · {c.tipo} · {c.total_recipients || 0} destinatarios</p>
                {c.estado === "borrador" && (
                  <button onClick={(e) => { e.stopPropagation(); handleExecute(c.id) }} className="mt-2 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg transition">
                    Ejecutar Ahora
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          {!detail ? (
            <p className="text-gray-400 text-center py-12">Seleccioná una campaña para ver detalles</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{detail.nombre}</h3>
                <CampaignBadge estado={detail.estado} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Canal:</span> <span className="font-medium">{detail.canal}</span></div>
                <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{detail.tipo}</span></div>
                <div><span className="text-gray-500">Segmento:</span> <span className="font-medium">{detail.segment_id ? detail.segment_id.slice(0, 8) : "Todos"}</span></div>
                <div><span className="text-gray-500">Programada:</span> <span className="font-medium">{detail.scheduled_at ? new Date(detail.scheduled_at).toLocaleString("es-PY") : "—"}</span></div>
              </div>
              {detail.contenido && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Contenido:</p>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm whitespace-pre-wrap">{detail.contenido}</div>
                </div>
              )}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <h4 className="font-semibold text-sm mb-2">Resultados</h4>
                <div className="grid grid-cols-4 gap-3 text-center text-sm">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"><span className="block text-lg font-bold">{detail.total_recipients || 0}</span><span className="text-gray-500 text-xs">Total</span></div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"><span className="block text-lg font-bold">{detail.sent_count || 0}</span><span className="text-gray-500 text-xs">Enviados</span></div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"><span className="block text-lg font-bold">{detail.opened_count || 0}</span><span className="text-gray-500 text-xs">Abiertos</span></div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"><span className="block text-lg font-bold">{detail.converted_count || 0}</span><span className="text-gray-500 text-xs">Conv.</span></div>
                </div>
              </div>
              {detail.recipients && detail.recipients.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Destinatarios ({detail.recipients.length})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {detail.recipients.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2">
                        <span>{r.customer_nombre || r.customer_id.slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 rounded-full ${r.estado === "enviado" ? "bg-green-100 text-green-700" : r.estado === "abierto" ? "bg-blue-100 text-blue-700" : r.estado === "error" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                          {r.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Stock Alerts Tab ─────────────────────────────────────────── */
function StockAlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [customerId, setCustomerId] = useState("")
  const [productId, setProductId] = useState("")

  const load = () => apiGet("/stock-alerts").then(setAlerts).catch(() => {})

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await apiPost("/stock-alerts", { customer_id: customerId, product_id: productId })
      await load(); setShowForm(false); setCustomerId(""); setProductId("")
    } catch {}
  }

  const handleDelete = async (id: string) => {
    try { await apiDelete(`/stock-alerts/${id}`); await load() } catch {}
  }

  const handleCheck = async () => {
    try {
      const result = await apiPost("/stock-alerts/check")
      alert(`Notificaciones generadas: ${JSON.stringify(result)}`)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alertas de Stock para Clientes</h2>
        <div className="flex gap-2">
          <button onClick={handleCheck} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition">
            Verificar Stock
          </button>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            + Nueva Alerta
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ID Cliente</label>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field w-full" placeholder="UUID del cliente" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ID Producto</label>
              <input value={productId} onChange={(e) => setProductId(e.target.value)} className="input-field w-full" placeholder="UUID del producto" />
            </div>
          </div>
          <button onClick={handleCreate} className="btn-primary px-6">Crear Alerta</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Cliente</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Producto</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Activo</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Última Notificación</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-mono text-xs">{a.customer_id}</td>
                <td className="px-5 py-3 font-mono text-xs">{a.product_id}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${a.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{a.activo ? "Activo" : "Inactivo"}</span></td>
                <td className="px-5 py-3 text-gray-500">{a.last_notified_at ? new Date(a.last_notified_at).toLocaleString("es-PY") : "—"}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Sin alertas configuradas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Offers Tab ───────────────────────────────────────────────── */
function OffersTab() {
  const [offers, setOffers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [customerId, setCustomerId] = useState("")
  const [productId, setProductId] = useState("")
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [tipo, setTipo] = useState("descuento")
  const [valor, setValor] = useState("")
  const [codigoCupon, setCodigoCupon] = useState("")
  const [validoHasta, setValidoHasta] = useState("")

  const load = () => apiGet("/offers").then(setOffers).catch(() => {})

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await apiPost("/offers", {
        customer_id: customerId, product_id: productId || null, titulo, descripcion,
        tipo, valor: parseFloat(valor) || 0, codigo_cupon: codigoCupon || null,
        valido_hasta: validoHasta ? new Date(validoHasta).toISOString() : null,
      })
      await load(); setShowForm(false); setCustomerId(""); setProductId(""); setTitulo(""); setDescripcion(""); setTipo("descuento"); setValor(""); setCodigoCupon(""); setValidoHasta("")
    } catch {}
  }

  const handleGenerate = async () => {
    try { await apiPost("/offers/generate"); await load() } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ofertas Personalizadas</h2>
        <div className="flex gap-2">
          <button onClick={handleGenerate} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition">
            Generar Automáticas
          </button>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            + Nueva Oferta
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ID Cliente</label>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ID Producto (opcional)</label>
              <input value={productId} onChange={(e) => setProductId(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-field w-full">
                <option value="descuento">Descuento</option>
                <option value="2x1">2x1</option>
                <option value="gratis">Gratis</option>
                <option value="volumen">Volumen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor</label>
              <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Código Cupón</label>
              <input value={codigoCupon} onChange={(e) => setCodigoCupon(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Válido hasta</label>
              <input type="datetime-local" value={validoHasta} onChange={(e) => setValidoHasta(e.target.value)} className="input-field w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="input-field w-full" />
            </div>
          </div>
          <button onClick={handleCreate} className="btn-primary px-6">Crear Oferta</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Título</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Tipo</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Valor</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Cupón</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Cliente</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Válido hasta</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Usado</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-medium">{o.titulo}</td>
                <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{o.tipo}</span></td>
                <td className="px-5 py-3 text-right font-medium">{o.valor || "—"}</td>
                <td className="px-5 py-3 font-mono text-xs">{o.codigo_cupon || "—"}</td>
                <td className="px-5 py-3 font-mono text-xs">{getCustomerName(o.customer_id)}</td>
                <td className="px-5 py-3 text-gray-500">{o.valido_hasta ? new Date(o.valido_hasta).toLocaleDateString("es-PY") : "—"}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${o.usado ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>{o.usado ? "Usado" : "Disponible"}</span></td>
              </tr>
            ))}
            {offers.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Sin ofertas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Surveys Tab ──────────────────────────────────────────────── */
function SurveysTab() {
  
  const [surveys, setSurveys] = useState<any[]>([])
  const [responses, setResponses] = useState<any[] | null>(null)
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState("")
  const [preguntas, setPreguntas] = useState('[{"pregunta": "¿Qué tal fue tu experiencia?", "tipo": "rating"}]')

  const load = () => apiGet("/surveys").then(setSurveys).catch(() => {})

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await apiPost("/surveys", { nombre, preguntas: JSON.parse(preguntas) })
      await load(); setShowForm(false); setNombre(""); setPreguntas('[{"pregunta": "¿Qué tal fue tu experiencia?", "tipo": "rating"}]')
    } catch {}
  }

  const loadResponses = async (id: string) => {
    try {
      const r = await apiGet(`/surveys/${id}/responses`)
      setResponses(r); setSelectedSurveyId(id)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Encuestas de Satisfacción</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          + Nueva Encuesta
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-field w-full" placeholder="Ej: Encuesta post-entrega" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Preguntas (JSON)</label>
            <textarea value={preguntas} onChange={(e) => setPreguntas(e.target.value)} rows={5} className="input-field w-full font-mono text-xs"
              placeholder='[{"pregunta": "Texto", "tipo": "rating/opciones/texto", "opciones": ["Op1","Op2"]}]' />
          </div>
          <button onClick={handleCreate} className="btn-primary px-6">Crear Encuesta</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Encuestas</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {surveys.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-400">Sin encuestas</p>
            ) : surveys.map((s) => (
              <div key={s.id} className={`px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition ${selectedSurveyId === s.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`} onClick={() => loadResponses(s.id)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{s.nombre}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${s.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{s.activo ? "Activa" : "Inactiva"}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{s.preguntas?.length || 0} preguntas</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          {!selectedSurveyId || responses === null ? (
            <p className="text-gray-400 text-center py-12">Seleccioná una encuesta para ver respuestas</p>
          ) : responses.length === 0 ? (
            <p className="text-gray-400 text-center py-12">Sin respuestas aún</p>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Respuestas ({responses.length})</h3>
              {responses.map((r: any, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500 mb-1">Cliente: {getCustomerName(r.customer_id)} · {new Date(r.created_at).toLocaleDateString("es-PY")}</p>
                  <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(r.respuestas, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
