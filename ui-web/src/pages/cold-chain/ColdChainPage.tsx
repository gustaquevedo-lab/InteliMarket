import { useState, useEffect } from "react"
import {
  BarChart3, Thermometer, AlertTriangle, FileSpreadsheet, Map, Plus, Search, Loader2,
  Zap, CheckCircle, XCircle, Clock, RefreshCcw, Smartphone, Wifi, WifiOff,
  BatteryMedium, Droplets, MapPin, ShieldCheck, Activity,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function ColdChainPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">IoT Cadena de Frío</h1>
          <p className="text-sm text-gray-500 mt-1">Sensores ESP32, monitoreo mapa, alertas DINALFA, simulación MQTT</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",  label: "Dashboard",    icon: BarChart3 },
            { key: "sensores",   label: "Sensores",     icon: Thermometer },
            { key: "mapa",       label: "Mapa",         icon: Map },
            { key: "alertas",    label: "Alertas",      icon: AlertTriangle },
            { key: "compliance", label: "Compliance",   icon: ShieldCheck },
            { key: "simular",    label: "Simular MQTT", icon: Activity },
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

      {tab === "dashboard"  && <DashboardTab />}
      {tab === "sensores"   && <SensoresTab />}
      {tab === "mapa"       && <MapaTab />}
      {tab === "alertas"    && <AlertasTab />}
      {tab === "compliance" && <ComplianceTab />}
      {tab === "simular"    && <SimularTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600",
    orange: "bg-orange-50 text-orange-600",
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

function SeverityBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700",
    warning: "bg-yellow-100 text-yellow-700", info: "bg-blue-100 text-blue-700",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || colors.warning}`}>{s}</span>
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.coldChain.getDashboard(COMPANY_ID).then(setData).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Thermometer} label="Sensores" value={data?.total_sensors || 0} sub={`${data?.active_sensors || 0} activos`} color="blue" />
        <KpiCard icon={Wifi} label="Online" value={(data?.active_sensors || 0) - (data?.offline_sensors || 0)} color="green" />
        <KpiCard icon={WifiOff} label="Offline" value={data?.offline_sensors || 0} color="red" />
        <KpiCard icon={AlertTriangle} label="Alertas" value={data?.unresolved_alerts || 0} color={data?.unresolved_alerts > 0 ? "red" : "green"} />
      </div>

      {data?.compliance_rate != null && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tasa de Cumplimiento</h3>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className={`h-3 rounded-full ${data.compliance_rate >= 90 ? "bg-green-500" : data.compliance_rate >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${data.compliance_rate}%` }}></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{data.compliance_rate}% de lotes conformes</p>
        </div>
      )}

      {data?.current_readings?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.current_readings.map((r: any) => {
            const inRange = r.temperature != null && r.temperature >= (r.min_temp || -2) && r.temperature <= (r.max_temp || 8)
            return (
              <div key={r.sensor_id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${inRange ? "bg-green-100" : "bg-red-100"}`}>
                      <Thermometer className={`w-5 h-5 ${inRange ? "text-green-600" : "text-red-600"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{r.sensor_name}</p>
                      <p className="text-xs text-gray-500">{r.location_name || r.location_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${inRange ? "text-green-600" : "text-red-600"}`}>
                      {r.temperature != null ? `${r.temperature}°C` : "—"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {r.humidity != null && <span className="flex items-center gap-0.5"><Droplets className="w-3 h-3" />{r.humidity}%</span>}
                      {r.battery != null && <span className="flex items-center gap-0.5"><BatteryMedium className="w-3 h-3" />{r.battery}%</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {data?.recent_alerts?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4">
          <h3 className="text-sm font-semibold text-yellow-700 mb-3">Alertas Recientes</h3>
          {data.recent_alerts.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-0">
              <AlertTriangle className={`w-4 h-4 ${a.severity === "critical" ? "text-red-500" : "text-yellow-500"}`} />
              <SeverityBadge s={a.severity} />
              <span className="text-gray-700">{a.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== SENSORES =====

function SensoresTab() {
  const [sensors, setSensors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", sensor_type: "dht22", location_type: "warehouse", location_name: "", min_temp: -2, max_temp: 8 })

  const load = () => {
    setLoading(true)
    api.coldChain.listSensors(COMPANY_ID).then(setSensors).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name) return
    try {
      await api.coldChain.createSensor(COMPANY_ID, form)
      setShowForm(false)
      setForm({ name: "", sensor_type: "dht22", location_type: "warehouse", location_name: "", min_temp: -2, max_temp: 8 })
      load()
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {showForm ? "Cancelar" : "Nuevo Sensor"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre del sensor"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            <select value={form.sensor_type} onChange={e => setForm({ ...form, sensor_type: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
              <option value="dht22">DHT22</option><option value="ds18b20">DS18B20</option><option value="bme280">BME280</option>
            </select>
            <select value={form.location_type} onChange={e => setForm({ ...form, location_type: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
              <option value="warehouse">Almacén</option><option value="vehicle">Vehículo</option><option value="container">Contenedor</option>
            </select>
            <input value={form.location_name} onChange={e => setForm({ ...form, location_name: e.target.value })} placeholder="Ubicación"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            <input type="number" value={form.min_temp} onChange={e => setForm({ ...form, min_temp: parseFloat(e.target.value) })} placeholder="Temp. mín"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            <input type="number" value={form.max_temp} onChange={e => setForm({ ...form, max_temp: parseFloat(e.target.value) })} placeholder="Temp. máx"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
          <button onClick={create} disabled={!form.name}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Guardar Sensor
          </button>
        </div>
      )}

      {loading ? <Spinner /> : sensors.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin sensores registrados</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sensors.map((s: any) => {
              const inRange = s.last_temperature != null && s.last_temperature >= s.min_temp && s.last_temperature <= s.max_temp
              return (
                <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                        {s.is_active ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                      </div>
                      <p className="text-xs text-gray-500">{s.location_name || s.location_type} • {s.sensor_type}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${inRange ? "text-green-600" : "text-red-600"}`}>
                        {s.last_temperature != null ? `${s.last_temperature}°C` : "—"}
                      </p>
                      <p className="text-xs text-gray-400">Límites: {s.min_temp}°C / {s.max_temp}°C</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {s.last_humidity != null && <span>💧 {s.last_humidity}%</span>}
                    {s.battery_level != null && <span>🔋 {s.battery_level}%</span>}
                    {s.last_reading_at && <span>🕐 {new Date(s.last_reading_at).toLocaleString()}</span>}
                  </div>
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

// ===== MAPA =====

function MapaTab() {
  const [sensors, setSensors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.coldChain.listSensors(COMPANY_ID).then(setSensors).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const located = sensors.filter(s => s.lat && s.lng)

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Sensores en Mapa</h3>
        <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
          {located.length === 0 ? (
            <div className="text-gray-400">
              <MapPin className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Sin coordenadas asignadas. Configurá lat/lng en los sensores.</p>
              <p className="text-xs mt-2">Asunción: -25.2637, -57.5759 (centro)</p>
            </div>
          ) : (
            <div className="space-y-2">
              {located.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${s.last_temperature != null && s.last_temperature >= s.min_temp && s.last_temperature <= s.max_temp ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-gray-500">{s.location_name}</span>
                  </div>
                  <span className="text-sm font-bold">{s.last_temperature != null ? `${s.last_temperature}°C` : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== ALERTAS =====

function AlertasTab() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.coldChain.listAlerts(COMPANY_ID).then(setAlerts).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resolveAlert = async (id: string) => {
    try { await api.coldChain.resolveAlert(COMPANY_ID, id); load() }
    catch (e: any) { alert(e.message) }
  }

  const notifyWhatsApp = async (id: string) => {
    try { await api.coldChain.notifyWhatsApp(COMPANY_ID, id); load() }
    catch (e: any) { alert(e.message) }
  }

  return (
    <div>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : alerts.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin alertas de cadena de frío</p>
        : <div className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <AlertTriangle className={`w-5 h-5 mt-0.5 ${a.severity === "critical" ? "text-red-500" : a.severity === "high" ? "text-orange-500" : "text-yellow-500"}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{a.alert_type.replace("_", " ")}</span>
                        <SeverityBadge s={a.severity} />
                        {a.is_resolved ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{a.message}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {a.temperature != null && <span>🌡️ {a.temperature}°C</span>}
                        {a.threshold_min != null && <span>⬇️ {a.threshold_min}°C</span>}
                        {a.threshold_max != null && <span>⬆️ {a.threshold_max}°C</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {!a.is_resolved && (
                      <>
                        <button onClick={() => resolveAlert(a.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">Resolver</button>
                        <button onClick={() => notifyWhatsApp(a.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${a.whatsapp_notified ? "bg-gray-400 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                          {a.whatsapp_notified ? "Notificado" : "WhatsApp"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ===== COMPLIANCE =====

function ComplianceTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ sensor_id: "", product_name: "", batch_number: "" })
  const [sensors, setSensors] = useState<any[]>([])

  const load = () => {
    setLoading(true)
    Promise.all([
      api.coldChain.listCompliance(COMPANY_ID),
      api.coldChain.listSensors(COMPANY_ID),
    ]).then(([l, s]) => { setLogs(l); setSensors(s) }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startLog = async () => {
    if (!form.product_name || !form.batch_number) return
    try {
      await api.coldChain.startCompliance(COMPANY_ID, { ...form, start_time: new Date().toISOString() })
      setShowForm(false)
      setForm({ sensor_id: "", product_name: "", batch_number: "" })
      load()
    } catch (e: any) { alert(e.message) }
  }

  const closeLog = async (id: string) => {
    try { await api.coldChain.closeCompliance(COMPANY_ID, id); load() }
    catch (e: any) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Nuevo Registro
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={form.sensor_id} onChange={e => setForm({ ...form, sensor_id: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
              <option value="">Seleccionar sensor</option>
              {sensors.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} placeholder="Producto"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            <input value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} placeholder="N° Lote"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
          <button onClick={startLog} disabled={!form.product_name || !form.batch_number}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Iniciar Monitoreo
          </button>
        </div>
      )}

      {loading ? <Spinner /> : logs.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin registros de compliance</p>
        : <div className="space-y-2">
            {logs.map((l: any) => (
              <div key={l.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className={`w-5 h-5 ${l.compliant ? "text-green-500" : "text-red-500"}`} />
                    <div>
                      <p className="text-sm font-medium">{l.product_name || "Producto"} {l.batch_number && `• Lote ${l.batch_number}`}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>Min: {l.min_temp ?? "—"}°C</span>
                        <span>Max: {l.max_temp ?? "—"}°C</span>
                        <span>Avg: {l.avg_temp ?? "—"}°C</span>
                        <span>Violaciones: {l.temp_violations}</span>
                        <span>Lecturas: {l.total_readings}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.compliant ? <span className="text-xs text-green-600 font-medium">✓ Conforme</span> : <span className="text-xs text-red-600 font-medium">✗ No conforme</span>}
                    {!l.end_time && <button onClick={() => closeLog(l.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">Cerrar</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ===== SIMULAR MQTT =====

function SimularTab() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const simulate = async () => {
    setLoading(true)
    try {
      const r = await api.coldChain.simulate(COMPANY_ID)
      setResult(r)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> Simular Lectura MQTT</h3>
        <p className="text-xs text-gray-500 mb-3">Simula la llegada de datos desde un sensor ESP32 vía MQTT. Genera temperaturas aleatorias con un 10% de probabilidad de fuera de rango (para probar alertas).</p>
        <button onClick={simulate} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
          {loading ? <Spinner /> : <Zap className="w-4 h-4" />} Simular Lectura
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          {result.readings?.map((r: any, i: number) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Thermometer className={`w-5 h-5 ${r.alerts_generated?.length ? "text-red-500" : "text-green-500"}`} />
                  <div>
                    <p className="text-sm font-medium">Sensor {r.reading?.sensor_id?.slice(0, 8)}</p>
                    <p className="text-lg font-bold">{r.reading?.temperature}°C</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>💧 {r.reading?.humidity}%</p>
                  <p>🔋 {r.reading?.battery}%</p>
                </div>
              </div>
              {r.alerts_generated?.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg">
                  {r.alerts_generated.map((a: any, j: number) => (
                    <p key={j} className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {a.message}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
