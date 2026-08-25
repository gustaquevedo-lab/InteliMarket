import { useState, useEffect } from "react"
import { UserPlus, Search, MapPin, Smartphone, Battery, BatteryWarning, BatteryMedium, BatteryFull, Power, PowerOff } from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"

const PAGE_SIZE = 20

export default function SellersPage() {
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ user_id: "", telefono: "", zona_asignada: "", codigo_vendedor: "", photo_url: "" })

  useEffect(() => { loadSellers() }, [])

  const loadSellers = async () => {
    setLoading(true)
    try {
      const data = await api.distribuidora.tracking.sellers.list(companyId)
      setSellers(data || [])
    } catch { setSellers([]) }
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      if (editing) {
        await api.distribuidora.tracking.sellers.update(editing.id, form)
      } else {
        await api.distribuidora.tracking.sellers.create(companyId, form)
      }
      setShowForm(false); setEditing(null); setForm({ user_id: "", telefono: "", zona_asignada: "", codigo_vendedor: "", photo_url: "" })
      await loadSellers()
    } catch {}
  }

  const editSeller = (s: any) => {
    setEditing(s)
    setForm({ user_id: s.user_id || "", telefono: s.telefono || "", zona_asignada: s.zona_asignada || "", codigo_vendedor: s.codigo_vendedor || "", photo_url: s.photo_url || "" })
    setShowForm(true)
  }

  const BatteryIcon = ({ level }: { level: number }) => {
    if (level <= 15) return <BatteryWarning className="w-4 h-4 text-red-500" />
    if (level <= 30) return <BatteryMedium className="w-4 h-4 text-yellow-500" />
    if (level <= 60) return <BatteryMedium className="w-4 h-4 text-green-400" />
    return <BatteryFull className="w-4 h-4 text-green-600" />
  }

  const filtered = sellers.filter((s) =>
    (s.user_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.codigo_vendedor || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.zona_asignada || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Vendedores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sellers.length} vendedores registrados
          </p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ user_id: "", telefono: "", zona_asignada: "", codigo_vendedor: "", photo_url: "" }); setShowForm(true) }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          <UserPlus className="w-4 h-4" /> Nuevo Vendedor
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Buscar vendedor..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editing ? "Editar" : "Nuevo"} Vendedor</h2>
            <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="">Seleccionar usuario...</option>
              {sellers.map(s => <option key={s.user_id} value={s.user_id}>{s.user_nombre} ({s.user_email})</option>)}
            </select>
            <input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <input placeholder="Zona asignada" value={form.zona_asignada} onChange={e => setForm({ ...form, zona_asignada: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <input placeholder="Código vendedor" value={form.codigo_vendedor} onChange={e => setForm({ ...form, codigo_vendedor: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <input placeholder="URL foto de perfil" value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">{editing ? "Guardar" : "Crear"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s) => (
          <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                {s.photo_url ? (
                  <img src={s.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: s.status === "online" ? "#22c55e" : s.status === "busy" ? "#f59e0b" : "#9ca3af" }} />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold border-2" style={{ borderColor: s.status === "online" ? "#22c55e" : "#9ca3af" }}>
                    {(s.user_nombre || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 ${s.status === "online" ? "bg-green-500" : s.status === "busy" ? "bg-yellow-500" : s.status === "idle" ? "bg-gray-400" : "bg-gray-300"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">{s.user_nombre || "Sin nombre"}</h3>
                  <button onClick={() => editSeller(s)} className="text-xs text-blue-500 hover:text-blue-700">Editar</button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.user_email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {s.codigo_vendedor && <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{s.codigo_vendedor}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "online" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> <BatteryIcon level={s.phone_battery_level || 0} /> {s.phone_battery_level || "?"}%</span>
                  {s.zona_asignada && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.zona_asignada}</span>}
                </div>
                {s.last_lat && s.last_lng && (
                  <p className="text-xs text-gray-400 mt-1">
                    Última ubicación: {Number(s.last_lat).toFixed(4)}, {Number(s.last_lng).toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-gray-400">No hay vendedores registrados. Crea el primero.</div>
        )}
      </div>
    </div>
  )
}
