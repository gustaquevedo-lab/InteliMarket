import { useState } from "react"
import {
  Route, BarChart3, Truck, RefreshCcw, Clock, Plus, Loader2, Zap,
  MapPin, Package, Weight, Thermometer, ArrowUpDown, CheckCircle, AlertTriangle,
  Gauge, Target, TrendingUp, Search,
} from "lucide-react"

const API_BASE = "/api/v1/intelligent-routing"
const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async function apiPost(path: string, data?: any) {
  const token = localStorage.getItem("access_token")
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) throw new Error((await res.json()).detail || "Error")
  return res.json()
}

async function apiGet(path: string) {
  const token = localStorage.getItem("access_token")
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new Error((await res.json()).detail || "Error")
  return res.json()
}

export default function IntelligentRoutingPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Ruteo Inteligente</h1>
          <p className="text-sm text-gray-500 mt-1">TSP, carga de vehículos, re-ruteo dinámico, ETA predictivo</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",   label: "Dashboard",     icon: BarChart3 },
            { key: "optimizar",   label: "Optimizar Ruta", icon: Route },
            { key: "carga",       label: "Carga Vehículo", icon: Truck },
            { key: "re-ruteo",    label: "Re-Ruteo Dinámico", icon: RefreshCcw },
            { key: "eta",         label: "ETA Predictivo", icon: Clock },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"   && <DashboardTab />}
      {tab === "optimizar"   && <OptimizarTab />}
      {tab === "carga"       && <CargaTab />}
      {tab === "re-ruteo"    && <RerouteTab />}
      {tab === "eta"         && <EtaTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600",
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useState(() => {
    apiGet("/efficiency").then(setData).catch(() => {}).finally(() => setLoading(false))
  })

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data) return <p className="text-center text-gray-500 py-12">Sin datos aún. Optimizá una ruta primero.</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Route} label="Rutas Optimizadas" value={data.total_routes} color="blue" />
        <KpiCard icon={Target} label="Ahorro Distancia" value={data.avg_distance_efficiency != null ? `${data.avg_distance_efficiency}%` : "—"} color="green" />
        <KpiCard icon={Clock} label="Ahorro Tiempo" value={data.avg_duration_efficiency != null ? `${data.avg_duration_efficiency}%` : "—"} color="indigo" />
        <KpiCard icon={MapPin} label="Paradas Optimizadas" value={data.total_optimized_stops} color="purple" />
      </div>

      {data.recent_routes?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Últimas Optimizaciones</h3>
          <div className="space-y-2">
            {data.recent_routes.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-700 dark:text-gray-300">{r.total_stops} paradas — {r.algorithm}</span>
                <span className="text-green-600 font-medium">{r.saving_distance_pct != null ? `${r.saving_distance_pct}% ahorro` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== OPTIMIZAR RUTA (TSP) =====

function OptimizarTab() {
  const [stops, setStops] = useState([{ id: "1", lat: -25.2637, lng: -57.5759, address: "Inicio", service_time_min: 5 }])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const addStop = () => {
    const idx = stops.length + 1
    setStops([...stops, { id: String(idx), lat: -25.28 + Math.random() * 0.05, lng: -57.58 + Math.random() * 0.05, address: `Parada ${idx}`, service_time_min: 5 }])
  }

  const removeStop = (id: string) => {
    setStops(stops.filter(s => s.id !== id))
  }

  const updateStop = (id: string, field: string, value: any) => {
    setStops(stops.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const optimize = async () => {
    setLoading(true)
    try {
      const res = await apiPost("/tsp/optimize", {
        stops: stops.map(s => ({ ...s, priority: 0, volume_m3: 0, weight_kg: 0 })),
        algorithm: "nearest_neighbor_2opt",
        constraints: {},
      })
      setResult(res)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><MapPin className="w-4 h-4" /> Paradas ({stops.length})</h3>
          <div className="flex gap-2">
            <button onClick={addStop} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> Agregar</button>
            <button onClick={optimize} disabled={loading || stops.length < 2}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
              {loading ? <Spinner /> : <Zap className="w-4 h-4" />} Optimizar
            </button>
          </div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {stops.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <span className="font-medium text-gray-500 w-6">{i + 1}.</span>
              <input value={s.address} onChange={e => updateStop(s.id, "address", e.target.value)}
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700" placeholder="Dirección" />
              <input type="number" value={s.lat} onChange={e => updateStop(s.id, "lat", parseFloat(e.target.value))}
                className="w-24 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700" step="0.0001" />
              <input type="number" value={s.lng} onChange={e => updateStop(s.id, "lng", parseFloat(e.target.value))}
                className="w-24 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700" step="0.0001" />
              <button onClick={() => removeStop(s.id)} className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
            </div>
          ))}
        </div>
      </div>

      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-800 p-4">
          <h3 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Resultado</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Distancia</p>
              <p className="font-bold text-green-600">{result.total_distance_km?.toFixed(1)} km</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Duración</p>
              <p className="font-bold text-green-600">{result.total_duration_min?.toFixed(0)} min</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Original</p>
              <p className="font-bold">{result.original_distance_km?.toFixed(1)} km</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Ahorro</p>
              <p className="font-bold text-blue-600">{result.saving_distance_pct?.toFixed(1)}%</p>
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-2">Algoritmo: {result.algorithm} | Restricciones: {result.constraints_applied?.join(", ") || "ninguna"}</div>
          <div className="space-y-1">
            {result.ordered_stops?.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 text-sm p-1.5 border-b border-gray-50 last:border-0">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{s.order}</span>
                <span className="text-gray-700 dark:text-gray-300">{s.address || s.id}</span>
                <span className="text-gray-400 text-xs ml-auto">{s.lat?.toFixed(4)}, {s.lng?.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== CARGA VEHÍCULO =====

function CargaTab() {
  const [vehicleId, setVehicleId] = useState("00000000-0000-0000-0000-000000000001")
  const [config, setConfig] = useState<any>(null)
  const [stops, setStops] = useState([
    { id: "s1", volume_m3: 0.5, weight_kg: 20, temperature_required: null as number | null },
    { id: "s2", volume_m3: 1.2, weight_kg: 50, temperature_required: 4 },
    { id: "s3", volume_m3: 0.8, weight_kg: 30, temperature_required: null },
  ])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadConfig = async () => {
    try {
      const c = await apiGet(`/load/config/${vehicleId}`)
      setConfig(c)
    } catch { setConfig(null) }
  }

  useState(() => { loadConfig() })

  const optimize = async () => {
    setLoading(true)
    try {
      const res = await apiPost("/load/optimize", { vehicle_id: vehicleId, stops })
      setResult(res)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Vehículo ID</label>
            <input value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
          {config && (
            <>
              <div><label className="text-xs text-gray-500 block">Vol. Máx</label><p className="text-sm font-medium">{config.max_volume_m3 || "—"} m³</p></div>
              <div><label className="text-xs text-gray-500 block">Peso Máx</label><p className="text-sm font-medium">{config.max_weight_kg || "—"} kg</p></div>
            </>
          )}
        </div>
        <button onClick={optimize} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
          {loading ? <Spinner /> : <Zap className="w-4 h-4" />} Optimizar Carga
        </button>
      </div>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Utilización</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Volumen</span><span>{result.utilization_volume_pct}% ({result.total_volume_m3} m³)</span></div>
                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(result.utilization_volume_pct, 100)}%` }}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Peso</span><span>{result.utilization_weight_pct}% ({result.total_weight_kg} kg)</span></div>
                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-green-600 h-2 rounded-full" style={{ width: `${Math.min(result.utilization_weight_pct, 100)}%` }}></div></div>
              </div>
              <p className="text-xs text-gray-500">Pallets: {result.total_pallets}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Orden de Carga</h3>
            <div className="space-y-1">
              {result.load_order?.map((l: any) => (
                <div key={l.order} className="flex items-center gap-2 text-xs p-1.5 border-b border-gray-50">
                  <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center font-bold">{l.order}</span>
                  <span className="text-gray-700">Parada {l.stop_id}</span>
                  <span className="text-gray-400 ml-auto">{l.volume_m3} m³ / {l.weight_kg} kg</span>
                </div>
              ))}
            </div>
            {result.warnings?.length > 0 && (
              <div className="mt-3 p-2 bg-red-50 rounded-lg">
                {result.warnings.map((w: string, i: number) => (
                  <p key={i} className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{w}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== RE-RUTEO DINÁMICO =====

function RerouteTab() {
  const [currentStops, setCurrentStops] = useState([
    { id: "a", lat: -25.2637, lng: -57.5759, address: "Parada A" },
    { id: "b", lat: -25.2680, lng: -57.5800, address: "Parada B" },
    { id: "c", lat: -25.2720, lng: -57.5700, address: "Parada C" },
    { id: "d", lat: -25.2750, lng: -57.5780, address: "Parada D" },
  ])
  const [currentOrder, setCurrentOrder] = useState(["a", "b", "c", "d"])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [newStopLat, setNewStopLat] = useState("-25.2650")
  const [newStopLng, setNewStopLng] = useState("-57.5820")
  const [newStopAddr, setNewStopAddr] = useState("Urgente")
  const [cancelId, setCancelId] = useState("")

  const reroute = async (reason: string) => {
    setLoading(true)
    try {
      const body: any = {
        reason,
        current_stops: currentStops,
        current_order: currentOrder,
      }
      if (reason === "urgent_delivery") {
        body.new_stop = {
          id: "urgent-" + Date.now(),
          lat: parseFloat(newStopLat),
          lng: parseFloat(newStopLng),
          address: newStopAddr,
          priority: 99,
          service_time_min: 5,
          volume_m3: 0, weight_kg: 0,
        }
      } else if (reason === "cancellation") {
        body.cancel_stop_id = cancelId
      }
      const res = await apiPost("/reroute", body)
      setResult(res)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Ruta Actual</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {currentOrder.map((id, i) => {
            const s = currentStops.find(st => st.id === id)
            return (
              <span key={id} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">
                {i + 1}. {s?.address || id}
              </span>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <h4 className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1"><Plus className="w-3 h-3" /> Nueva Parada Urgente</h4>
            <div className="space-y-2">
              <input value={newStopAddr} onChange={e => setNewStopAddr(e.target.value)} placeholder="Dirección"
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
              <div className="flex gap-2">
                <input value={newStopLat} onChange={e => setNewStopLat(e.target.value)} placeholder="Lat" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
                <input value={newStopLng} onChange={e => setNewStopLng(e.target.value)} placeholder="Lng" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              </div>
              <button onClick={() => reroute("urgent_delivery")} disabled={loading}
                className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 disabled:opacity-50">
                {loading ? <Spinner /> : "Insertar y Re-optimizar"}
              </button>
            </div>
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h4 className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Cancelar Parada</h4>
            <div className="space-y-2">
              <select value={cancelId} onChange={e => setCancelId(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs">
                <option value="">Seleccionar parada</option>
                {currentOrder.map(id => {
                  const s = currentStops.find(st => st.id === id)
                  return <option key={id} value={id}>{s?.address || id}</option>
                })}
              </select>
              <button onClick={() => reroute("cancellation")} disabled={loading || !cancelId}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                {loading ? <Spinner /> : "Cancelar y Re-optimizar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-800 p-4">
          <h3 className="font-semibold text-green-700 mb-3">Ruta Re-Optimizada — {result.reason}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Distancia Extra</p>
              <p className="font-bold text-orange-600">{result.extra_distance_km?.toFixed(2)} km</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Tiempo Extra</p>
              <p className="font-bold text-orange-600">{result.extra_duration_min?.toFixed(0)} min</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.optimized_order?.map((s: any) => (
              <span key={s.id} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">{s.order}. {s.address || s.id}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== ETA PREDICTIVO =====

function EtaTab() {
  const [form, setForm] = useState({
    origin_lat: -25.2637, origin_lng: -57.5759,
    dest_lat: -25.2820, dest_lng: -57.6350,
    zone: "centro", hora_dia: "10:00", dia_semana: 2,
  })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const predict = async () => {
    setLoading(true)
    try {
      const res = await apiPost("/eta/predict", form)
      setResult(res)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Calcular ETA</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Origen (lat, lng)</label>
            <div className="flex gap-2">
              <input type="number" value={form.origin_lat} onChange={e => setForm({ ...form, origin_lat: parseFloat(e.target.value) })}
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" step="0.0001" />
              <input type="number" value={form.origin_lng} onChange={e => setForm({ ...form, origin_lng: parseFloat(e.target.value) })}
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" step="0.0001" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Destino (lat, lng)</label>
            <div className="flex gap-2">
              <input type="number" value={form.dest_lat} onChange={e => setForm({ ...form, dest_lat: parseFloat(e.target.value) })}
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" step="0.0001" />
              <input type="number" value={form.dest_lng} onChange={e => setForm({ ...form, dest_lng: parseFloat(e.target.value) })}
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" step="0.0001" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Zona</label>
            <select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
              <option value="centro">Centro</option>
              <option value="rural">Rural</option>
              <option value="troncal">Troncal</option>
              <option value="autopista">Autopista</option>
              <option value="lambaré">Lambaré</option>
              <option value="luque">Luque</option>
              <option value="san_lorenzo">San Lorenzo</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Hora</label>
            <input type="time" value={form.hora_dia} onChange={e => setForm({ ...form, hora_dia: e.target.value })}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
        </div>
        <button onClick={predict} disabled={loading}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {loading ? <Spinner /> : <Zap className="w-4 h-4" />} Predecir ETA
        </button>
      </div>

      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4">
          <h3 className="font-semibold text-indigo-700 mb-3">Resultado ETA</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Distancia</p>
              <p className="text-xl font-bold text-indigo-600">{result.distance_km} km</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Duración Base</p>
              <p className="text-xl font-bold">{result.base_duration_min?.toFixed(0)} min</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">ETA Predictivo</p>
              <p className="text-xl font-bold text-indigo-600">{result.predicted_duration_min?.toFixed(0)} min</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Confianza</p>
              <p className="text-xl font-bold text-green-600">{result.confidence_score}%</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
            <span>🚦 Tráfico: x{result.traffic_factor}</span>
            <span>📍 Zona: x{result.zone_factor}</span>
            <span>⏰ Hora: x{result.time_factor}</span>
          </div>
        </div>
      )}
    </div>
  )
}
