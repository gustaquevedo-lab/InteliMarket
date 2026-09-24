import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, MapPin, AlertTriangle, Eye, EyeOff, Power, PowerOff } from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"

const ZONE_TYPES = ["restricted", "preferred", "watch", "off_limits"]
const SEVERITIES = ["low", "medium", "high", "critical"]
const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#8b5cf6", "#ec4899"]
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

export default function GeocercasPage() {
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010" || "00000000-0000-0000-0000-000000000010"
  const [zones, setZones] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"zones" | "alerts">("zones")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({
    nombre: "", descripcion: "", zone_type: "restricted", geometry_type: "polygon",
    coordinates: JSON.stringify([[-57.6, -25.28], [-57.58, -25.28], [-57.58, -25.26], [-57.6, -25.26]]),
    color: "#ef4444", severity: "medium", active_start_time: "00:00", active_end_time: "23:59",
    active_days: [0, 1, 2, 3, 4, 5, 6], alert_on_entry: true, alert_on_exit: false, notify_supervisor: true,
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [z, a] = await Promise.all([
        api.distribuidora.tracking.geofence.zones.list(companyId).catch(() => []),
        api.distribuidora.tracking.geofence.alerts.list(companyId, "active").catch(() => []),
      ])
      setZones(z || [])
      setAlerts(a || [])
    } catch {}
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      const data = { ...form, coordinates: JSON.parse(form.coordinates) }
      if (editing) {
        await api.distribuidora.tracking.geofence.zones.update(editing.id, data)
      } else {
        await api.distribuidora.tracking.geofence.zones.create(companyId, data)
      }
      setShowForm(false); setEditing(null)
      await loadData()
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta zona?")) return
    await api.distribuidora.tracking.geofence.zones.delete(id)
    await loadData()
  }

  const toggleActive = async (zone: any) => {
    await api.distribuidora.tracking.geofence.zones.update(zone.id, { is_active: !zone.is_active })
    await loadData()
  }

  const editZone = (z: any) => {
    setEditing(z)
    setForm({ ...z, coordinates: JSON.stringify(z.coordinates) })
    setShowForm(true)
  }

  const SEVERITY_LABELS: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" }
  const ZONE_LABELS: Record<string, string> = { restricted: "Restringida", preferred: "Preferida", watch: "Vigilancia", off_limits: "Prohibida" }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Geocercas Inteligentes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Zonas restringidas, preferidas y de vigilancia</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ nombre: "", descripcion: "", zone_type: "restricted", geometry_type: "polygon", coordinates: JSON.stringify([[-57.6, -25.28], [-57.58, -25.28], [-57.58, -25.26], [-57.6, -25.26]]), color: "#ef4444", severity: "medium", active_start_time: "00:00", active_end_time: "23:59", active_days: [0, 1, 2, 3, 4, 5, 6], alert_on_entry: true, alert_on_exit: false, notify_supervisor: true }); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva Zona
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("zones")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "zones" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Zonas ({zones.length})
        </button>
        <button onClick={() => setTab("alerts")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "alerts" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Alertas activas ({alerts.length})
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-3 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editing ? "Editar" : "Nueva"} Geocerca</h2>
            <input placeholder="Nombre de la zona" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <textarea placeholder="Descripción" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.zone_type} onChange={e => setForm({ ...form, zone_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                {ZONE_TYPES.map(t => <option key={t} value={t}>{ZONE_LABELS[t]}</option>)}
              </select>
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
              </select>
            </div>
            <textarea placeholder="Coordenadas (JSON)" value={form.coordinates} onChange={e => setForm({ ...form, coordinates: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-xs h-20" />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Hora inicio</label><input type="time" value={form.active_start_time} onChange={e => setForm({ ...form, active_start_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" /></div>
              <div><label className="text-xs text-gray-500">Hora fin</label><input type="time" value={form.active_end_time} onChange={e => setForm({ ...form, active_end_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" /></div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Días activos</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => setForm({ ...form, active_days: form.active_days.includes(i) ? form.active_days.filter((x: number) => x !== i) : [...form.active_days, i] })}
                    className={`px-2 py-1 text-xs rounded ${form.active_days.includes(i) ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.alert_on_entry} onChange={e => setForm({ ...form, alert_on_entry: e.target.checked })} /> Alertar al entrar</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.notify_supervisor} onChange={e => setForm({ ...form, notify_supervisor: e.target.checked })} /> Notificar supervisor</label>
            </div>
            <div className="flex gap-2">
              {COLORS.map(c => <button key={c} onClick={() => setForm({ ...form, color: c })} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? "border-gray-900 dark:border-white scale-110" : "border-transparent"}`} style={{ background: c }} />)}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">{editing ? "Guardar" : "Crear"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Zones list */}
      {tab === "zones" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map(z => (
            <div key={z.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: z.color }} />
                  <h3 className="font-bold text-gray-900 dark:text-white">{z.nombre}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleActive(z)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">{z.is_active ? <Power className="w-4 h-4 text-green-500" /> : <PowerOff className="w-4 h-4 text-gray-400" />}</button>
                  <button onClick={() => editZone(z)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="w-4 h-4 text-gray-400" /></button>
                  <button onClick={() => handleDelete(z.id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{z.descripcion}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${z.zone_type === "restricted" ? "bg-red-100 text-red-700" : z.zone_type === "off_limits" ? "bg-red-200 text-red-800" : z.zone_type === "preferred" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {ZONE_LABELS[z.zone_type]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${z.severity === "critical" ? "bg-red-100 text-red-700" : z.severity === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                  {SEVERITY_LABELS[z.severity]}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{z.geometry_type}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">⏰ {z.active_start_time} - {z.active_end_time}</p>
              {!z.is_active && <span className="text-xs text-gray-400 mt-1 block">⛔ Desactivada</span>}
            </div>
          ))}
          {zones.length === 0 && !loading && (
            <div className="col-span-full text-center py-12 text-gray-400">No hay geocercas configuradas. Creá la primera.</div>
          )}
        </div>
      )}

      {/* Alerts list */}
      {tab === "alerts" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay alertas activas</p>
              <p className="text-xs mt-1">Los vendedores están cumpliendo con las zonas establecidas</p>
            </div>
          ) : alerts.map(a => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-700 dark:text-red-400">Alerta de geocerca</p>
                <p className="text-xs text-gray-500 mt-1">{a.event_type === "entry" ? "Entrada a zona restringida" : a.event_type}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                  <span>🕐 {new Date(a.detected_at).toLocaleString()}</span>
                  {a.lat && a.lng && <span>📍 {Number(a.lat).toFixed(4)}, {Number(a.lng).toFixed(4)}</span>}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={async () => { await api.distribuidora.tracking.geofence.alerts.acknowledge(a.id, { acknowledged_by: "00000000-0000-0000-0000-000000000001" }); await loadData() }}
                    className="text-xs px-3 py-1 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Reconocer</button>
                  <button onClick={async () => { await api.distribuidora.tracking.geofence.alerts.resolve(a.id); await loadData() }}
                    className="text-xs px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">Resolver</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
