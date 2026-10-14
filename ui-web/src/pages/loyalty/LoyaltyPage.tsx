import { useState, useEffect } from "react"
import {
  Settings, Users, Gift, Search, Loader2, Save, Plus, Star, Award, RefreshCcw, Coins,
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"

export default function LoyaltyPage() {
  const [tab, setTab] = useState("config")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Programa de Fidelización</h1>
          <p className="text-sm text-gray-500 mt-1">Configuración de puntos, consulta por cliente y recompensas</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "config",       label: "Configuración",       icon: Settings },
            { key: "puntos",       label: "Puntos por Cliente",  icon: Coins },
            { key: "recompensas",  label: "Recompensas",         icon: Gift },
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

      {tab === "config"      && <ConfigTab />}
      {tab === "puntos"      && <PuntosTab />}
      {tab === "recompensas" && <RecompensasTab />}
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

function ConfigTab() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ puntos_por_monto: 1, monto_minimo: 0, valor_punto: 0.01, vencimiento_dias: 365 })
  const { success, error: showError } = useToast()

  const load = () => {
    setLoading(true)
    api.loyalty.config().then((c) => {
      if (c) {
        setConfig(c)
        setForm({ puntos_por_monto: c.puntos_por_monto ?? 1, monto_minimo: c.monto_minimo ?? 0, valor_punto: c.valor_punto ?? 0.01, vencimiento_dias: c.vencimiento_dias ?? 365 })
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api.loyalty.updateConfig(form)
      setConfig(updated)
      success("Configuración guardada", "Programa de fidelización actualizado")
    } catch (e: any) { showError("Error al guardar", e.message) }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Coins} label="Puntos por Gs." value={form.puntos_por_monto} sub="Por cada Gs. 1.000" color="blue" />
        <KpiCard icon={Award} label="Valor del Punto" value={form.valor_punto} sub="Gs." color="green" />
        <KpiCard icon={Star} label="Vencimiento" value={`${form.vencimiento_dias} días`} color="orange" />
        <KpiCard icon={Gift} label="Monto Mínimo" value={form.monto_minimo ? `Gs. ${form.monto_minimo.toLocaleString()}` : "Sin mínimo"} color="purple" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Parámetros del Programa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Puntos por monto (cada Gs. 1.000)</label>
            <input type="number" min="0" step="0.01" value={form.puntos_por_monto}
              onChange={e => setForm({ ...form, puntos_por_monto: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Monto mínimo para acumular (Gs.)</label>
            <input type="number" min="0" value={form.monto_minimo}
              onChange={e => setForm({ ...form, monto_minimo: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Valor del punto (Gs.)</label>
            <input type="number" min="0" step="0.001" value={form.valor_punto}
              onChange={e => setForm({ ...form, valor_punto: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Vencimiento de puntos (días)</label>
            <input type="number" min="1" value={form.vencimiento_dias}
              onChange={e => setForm({ ...form, vencimiento_dias: parseInt(e.target.value) || 1 })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Spinner /> : <Save className="w-4 h-4" />} Guardar Configuración
        </button>
      </div>
    </div>
  )
}

function PuntosTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [points, setPoints] = useState<any>(null)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingPoints, setLoadingPoints] = useState(false)
  const { error: showError } = useToast()

  useEffect(() => {
    if (search.length < 2) { setCustomers([]); return }
    const t = setTimeout(() => {
      setLoadingCustomers(true)
      api.customers.list({ search }).then(setCustomers).catch(() => {}).finally(() => setLoadingCustomers(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const selectCustomer = async (c: any) => {
    setSelectedCustomer(c)
    setLoadingPoints(true)
    try {
      const p = await api.loyalty.points(c.id)
      setPoints(p)
    } catch (e: any) { showError("Error al obtener puntos", e.message) }
    setLoadingPoints(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente por nombre, email o RUC..."
              className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
        </div>

        {loadingCustomers && <div className="flex justify-center py-4"><Spinner /></div>}

        {customers.length > 0 && (
          <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
            {customers.map((c: any) => (
              <button key={c.id} onClick={() => selectCustomer(c)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition ${selectedCustomer?.id === c.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                <span className="font-medium">{c.nombre}</span>
                {c.email && <span className="text-gray-500 ml-2">{c.email}</span>}
                {c.ruc && <span className="text-gray-400 ml-2">{c.ruc}</span>}
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && !loadingCustomers && customers.length === 0 && (
          <p className="text-center text-gray-500 py-4 text-sm">Sin resultados</p>
        )}
      </div>

      {loadingPoints && <div className="flex justify-center py-8"><Spinner /></div>}

      {selectedCustomer && points && !loadingPoints && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{selectedCustomer.nombre}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard icon={Coins} label="Puntos Acumulados" value={points.puntos ?? 0} color="blue" />
            <KpiCard icon={Star} label="Puntos Usados" value={points.puntos_usados ?? 0} color="orange" />
            <KpiCard icon={Award} label="Puntos Disponibles" value={points.puntos_disponibles ?? (points.puntos ?? 0) - (points.puntos_usados ?? 0)} color="green" />
          </div>
          {points.fecha_vencimiento && (
            <p className="text-xs text-gray-400 mt-3">Vencimiento: {new Date(points.fecha_vencimiento).toLocaleDateString()}</p>
          )}
        </div>
      )}

      {selectedCustomer && !loadingPoints && !points && (
        <p className="text-center text-gray-500 py-4">Este cliente no tiene puntos registrados</p>
      )}
    </div>
  )
}

function RecompensasTab() {
  const [rewards, setRewards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { error: showError } = useToast()

  const load = () => {
    setLoading(true)
    api.loyalty.rewards().then(setRewards).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      {rewards.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin recompensas configuradas</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rewards.map((r: any) => (
              <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{r.nombre}</p>
                    {r.descripcion && <p className="text-xs text-gray-500 mt-1">{r.descripcion}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        {r.puntos_requeridos} pts.
                      </span>
                      {r.tipo && <span className="text-xs text-gray-400">{r.tipo}</span>}
                      {r.valor != null && <span className="text-xs text-gray-400">Gs. {r.valor.toLocaleString()}</span>}
                    </div>
                    {r.activo === false && <span className="text-xs text-red-500 mt-1 block">Inactivo</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
