import { useState, useEffect } from "react"
import {
  BarChart3, Tags, TrendingUp, Gift, CheckSquare, History, Plus, Search, Loader2,
  DollarSign, Percent, Package, Users, MapPin, Globe, Hash, ChevronDown, Calendar,
  Zap, ThumbsUp, ThumbsDown, Clock, AlertTriangle, CheckCircle, XCircle, FileText,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function SmartPricingPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Precios Inteligente</h1>
          <p className="text-sm text-gray-500 mt-1">Listas multicanal, escalonados, promociones, precio dinámico IA, aprobaciones</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",    label: "Dashboard",        icon: BarChart3 },
            { key: "asignaciones", label: "Listas Multicanal", icon: Tags },
            { key: "escalonados",  label: "Escalonados",      icon: Hash },
            { key: "promociones",  label: "Promociones",      icon: Gift },
            { key: "sugerencias",  label: "Sugerencias IA",   icon: TrendingUp },
            { key: "aprobaciones", label: "Aprobaciones",     icon: CheckSquare },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"    && <DashboardTab />}
      {tab === "asignaciones" && <AsignacionesTab />}
      {tab === "escalonados"  && <EscalonadosTab />}
      {tab === "promociones"  && <PromocionesTab />}
      {tab === "sugerencias"  && <SugerenciasTab />}
      {tab === "aprobaciones" && <AprobacionesTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
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

  useEffect(() => {
    api.smartPricing?.getDashboard(COMPANY_ID).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data) return <p className="text-center text-gray-500 py-12">No se pudo cargar el dashboard</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Tags} label="Listas de Precios" value={data.total_price_lists} color="blue" />
        <KpiCard icon={Gift} label="Promociones Activas" value={data.active_promotions} color="green" />
        <KpiCard icon={TrendingUp} label="Sugerencias Pendientes" value={data.pending_suggestions} color="yellow" />
        <KpiCard icon={CheckSquare} label="Solicitudes Pendientes" value={data.pending_requests} color="purple" />
      </div>

      {data.recent_changes?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Cambios Recientes</h3>
          <div className="space-y-2">
            {data.recent_changes.slice(0, 5).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <span className="text-gray-600 dark:text-gray-400">{c.change_type} — {c.reason || "Sin motivo"}</span>
                <span className="text-gray-400 text-xs">
                  {c.old_price?.toFixed(0)} → <span className="font-semibold text-green-600">{c.new_price?.toFixed(0)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== ASIGNACIONES (Listas Multicanal) =====

function AsignacionesTab() {
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ price_list_id: "", tipo: "cliente", ref_id: "" })

  const load = () => {
    setLoading(true)
    api.smartPricing?.listAssignments(COMPANY_ID).then(setAssignments).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.price_list_id || !form.ref_id) return
    await api.smartPricing?.createAssignment({ ...form, price_list_id: form.price_list_id })
    setShowForm(false)
    setForm({ price_list_id: "", tipo: "cliente", ref_id: "" })
    load()
  }

  const handleDelete = async (id: string) => {
    await api.smartPricing?.deleteAssignment(id)
    load()
  }

  const tipoOptions = [
    { value: "cliente", label: "Cliente", icon: Users },
    { value: "grupo", label: "Grupo", icon: Package },
    { value: "canal", label: "Canal", icon: Globe },
    { value: "zona", label: "Zona", icon: MapPin },
  ]

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{assignments.length} asignaciones</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Asignar Lista
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
                {tipoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Lista de Precios ID</label>
              <input value={form.price_list_id} onChange={e => setForm({ ...form, price_list_id: e.target.value })}
                placeholder="UUID de la lista" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Referencia (ID/Nombre)</label>
              <input value={form.ref_id} onChange={e => setForm({ ...form, ref_id: e.target.value })}
                placeholder="customer_id, grupo, canal, zona" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Guardar</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Lista de Precios</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Referencia</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {assignments.map((a: any) => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    {a.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs">{a.price_list_id?.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{a.ref_id}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">Sin asignaciones</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== ESCALONADOS (Tiered Pricing) =====

function EscalonadosTab() {
  const [tiers, setTiers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_id: "", precio_unitario: "", min_qty: "1", max_qty: "", price_list_id: "" })
  const [calcForm, setCalcForm] = useState({ product_id: "", quantity: "1", price_list_id: "" })
  const [calcResult, setCalcResult] = useState<any>(null)

  const load = () => {
    setLoading(true)
    api.smartPricing?.listTieredPrices(COMPANY_ID).then(setTiers).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    await api.smartPricing?.createTieredPrice({
      product_id: form.product_id,
      precio_unitario: parseFloat(form.precio_unitario),
      min_qty: parseInt(form.min_qty),
      max_qty: form.max_qty ? parseInt(form.max_qty) : null,
      price_list_id: form.price_list_id || null,
    })
    setShowForm(false)
    setForm({ product_id: "", precio_unitario: "", min_qty: "1", max_qty: "", price_list_id: "" })
    load()
  }

  const handleCalculate = async () => {
    try {
      const res = await api.smartPricing?.calculateTieredPrice(calcForm.product_id, parseInt(calcForm.quantity), calcForm.price_list_id || undefined)
      setCalcResult(res)
    } catch { setCalcResult(null) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{tiers.length} escalas</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva Escala
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Producto ID</label>
              <input value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}
                placeholder="UUID" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Mínimo</label>
              <input type="number" value={form.min_qty} onChange={e => setForm({ ...form, min_qty: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Máximo</label>
              <input type="number" value={form.max_qty} onChange={e => setForm({ ...form, max_qty: e.target.value })}
                placeholder="Sin límite" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio Unit.</label>
              <input type="number" value={form.precio_unitario} onChange={e => setForm({ ...form, precio_unitario: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Lista (opcional)</label>
              <input value={form.price_list_id} onChange={e => setForm({ ...form, price_list_id: e.target.value })}
                placeholder="UUID o vacío = global" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Guardar</button>
          </div>
        </div>
      )}

      {/* Calculator */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> Calcular Precio Escalonado</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={calcForm.product_id} onChange={e => setCalcForm({ ...calcForm, product_id: e.target.value })}
            placeholder="Producto ID" className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          <input type="number" value={calcForm.quantity} onChange={e => setCalcForm({ ...calcForm, quantity: e.target.value })}
            placeholder="Cantidad" className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          <input value={calcForm.price_list_id} onChange={e => setCalcForm({ ...calcForm, price_list_id: e.target.value })}
            placeholder="Lista (opcional)" className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          <button onClick={handleCalculate}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Calcular</button>
        </div>
        {calcResult && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Precio unitario: {Intl.NumberFormat().format(calcResult.precio_unitario)} Gs
              <span className="ml-2 text-xs text-green-500">(mín {calcResult.min_qty} — {calcResult.max_qty ? `máx ${calcResult.max_qty}` : "sin límite"})</span>
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Producto</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Mín</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Máx</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Precio Unit.</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {tiers.filter(t => t.activo).map((t: any) => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{t.product_id?.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-right">{t.min_qty}</td>
                <td className="px-4 py-3 text-right">{t.max_qty ?? "∞"}</td>
                <td className="px-4 py-3 text-right font-medium">{Intl.NumberFormat().format(t.precio_unitario)}</td>
                <td className="px-4 py-3 text-center">{t.activo ? <CheckCircle className="w-4 h-4 text-green-500 inline" /> : <XCircle className="w-4 h-4 text-red-500 inline" />}</td>
              </tr>
            ))}
            {tiers.filter(t => t.activo).length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin escalas configuradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== PROMOCIONES =====

function PromocionesTab() {
  const [promos, setPromos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>({
    nombre: "", tipo: "2x1", fecha_inicio: "", fecha_fin: "",
    rewards: [], assignments: [],
  })

  const load = () => {
    setLoading(true)
    api.smartPricing?.listPromotions(COMPANY_ID).then(setPromos).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    await api.smartPricing?.createPromotion({
      ...form,
      fecha_inicio: new Date(form.fecha_inicio).toISOString(),
      fecha_fin: new Date(form.fecha_fin).toISOString(),
    })
    setShowForm(false)
    setForm({ nombre: "", tipo: "2x1", fecha_inicio: "", fecha_fin: "", rewards: [], assignments: [] })
    load()
  }

  const handleToggle = async (id: string, prom: any) => {
    await api.smartPricing?.updatePromotion(id, { activo: !prom.activo })
    load()
  }

  const tipoColors: Record<string, string> = {
    "2x1": "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    quantity_discount: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    product_bonus: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    combo: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    percentage_discount: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    fixed_discount: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
  }

  const tipoLabels: Record<string, string> = {
    "2x1": "2x1", quantity_discount: "Dto. por Cant.", product_bonus: "Bonificación",
    combo: "Combo", percentage_discount: "% Descuento", fixed_discount: "Dto. Fijo",
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{promos.length} promociones</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva Promoción
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
                {Object.entries(tipoLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Inicio</label>
              <input type="datetime-local" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fin</label>
              <input type="datetime-local" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Crear</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promos.map((p: any) => (
          <div key={p.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${p.activo ? "border-gray-100 dark:border-gray-700" : "border-red-200 dark:border-red-800 opacity-70"}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{p.nombre}</h3>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${tipoColors[p.tipo] || "bg-gray-100 text-gray-600"}`}>
                  {tipoLabels[p.tipo] || p.tipo}
                </span>
              </div>
              <button onClick={() => handleToggle(p.id, p)}
                className={`text-xs px-2 py-1 rounded ${p.activo ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                {p.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
            <p className="text-xs text-gray-500">{p.descripcion}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <Calendar className="w-3 h-3" />
              {new Date(p.fecha_inicio).toLocaleDateString()} → {new Date(p.fecha_fin).toLocaleDateString()}
            </div>
            {p.usos_actuales > 0 && <p className="text-xs text-gray-400 mt-1">Usos: {p.usos_actuales}{p.max_usos ? ` / ${p.max_usos}` : ""}</p>}
          </div>
        ))}
        {promos.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400">Sin promociones</div>
        )}
      </div>
    </div>
  )
}

// ===== SUGERENCIAS IA =====

function SugerenciasTab() {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerator, setShowGenerator] = useState(false)
  const [genForm, setGenForm] = useState<any>({
    product_id: "", current_price: "", costo_promedio: "",
    demanda_historica: "", stock_actual: "", estacionalidad: "1.0", margen_objetivo: "",
  })
  const [genResult, setGenResult] = useState<any>(null)

  const load = () => {
    setLoading(true)
    api.smartPricing?.listSuggestions(COMPANY_ID).then(setSuggestions).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    const res = await api.smartPricing?.generateDynamicPrice({
      product_id: genForm.product_id,
      current_price: parseFloat(genForm.current_price),
      costo_promedio: genForm.costo_promedio ? parseFloat(genForm.costo_promedio) : null,
      demanda_historica: genForm.demanda_historica ? parseInt(genForm.demanda_historica) : null,
      stock_actual: genForm.stock_actual ? parseInt(genForm.stock_actual) : null,
      estacionalidad: genForm.estacionalidad ? parseFloat(genForm.estacionalidad) : 1.0,
      margen_objetivo: genForm.margen_objetivo ? parseFloat(genForm.margen_objetivo) : null,
    })
    setGenResult(res)
  }

  const handleSaveSuggestion = async () => {
    if (!genResult) return
    await api.smartPricing?.createSuggestion({
      product_id: genForm.product_id,
      current_price: parseFloat(genForm.current_price),
      suggested_price: genResult.suggested_price,
      confidence: genResult.confidence,
      factors: genResult.factors,
      source: genResult.source,
    })
    setGenResult(null)
    setShowGenerator(false)
    setGenForm({ product_id: "", current_price: "", costo_promedio: "", demanda_historica: "", stock_actual: "", estacionalidad: "1.0", margen_objetivo: "" })
    load()
  }

  const handleReview = async (id: string, estado: string) => {
    await api.smartPricing?.reviewSuggestion(id, { estado })
    load()
  }

  const sourceLabels: Record<string, string> = {
    costo_margen: "Costo + Margen", demanda: "Demanda", estacionalidad: "Estacionalidad",
    stock: "Stock", mixto: "Mixto",
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{suggestions.length} sugerencias</p>
        <button onClick={() => setShowGenerator(!showGenerator)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
          <Zap className="w-4 h-4" /> Generar Precio Dinámico
        </button>
      </div>

      {showGenerator && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Producto ID</label>
              <input value={genForm.product_id} onChange={e => setGenForm({ ...genForm, product_id: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio Actual</label>
              <input type="number" value={genForm.current_price} onChange={e => setGenForm({ ...genForm, current_price: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Costo Promedio</label>
              <input type="number" value={genForm.costo_promedio} onChange={e => setGenForm({ ...genForm, costo_promedio: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Demanda (uds 30d)</label>
              <input type="number" value={genForm.demanda_historica} onChange={e => setGenForm({ ...genForm, demanda_historica: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Stock Actual</label>
              <input type="number" value={genForm.stock_actual} onChange={e => setGenForm({ ...genForm, stock_actual: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Margen Objetivo (%)</label>
              <input type="number" value={genForm.margen_objetivo} onChange={e => setGenForm({ ...genForm, margen_objetivo: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowGenerator(false); setGenResult(null) }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button onClick={handleGenerate}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Generar</button>
          </div>

          {genResult && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-purple-700 dark:text-purple-400">Precio Sugerido</h4>
                <span className="text-xs text-gray-500">Confianza: {genResult.confidence}%</span>
              </div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-300 mb-2">
                {Intl.NumberFormat().format(genResult.suggested_price)} Gs
              </div>
              <div className="text-sm text-gray-500 mb-3">Fuente: {sourceLabels[genResult.source] || genResult.source}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {Object.entries(genResult.factors || {}).map(([k, v]: any) => (
                  <div key={k} className="bg-white dark:bg-gray-700 rounded-lg p-2">
                    <span className="text-gray-400">{k}</span>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{typeof v === "number" ? v.toFixed(2) : String(v)}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setGenResult(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Descartar</button>
                <button onClick={handleSaveSuggestion}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Guardar Sugerencia</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Producto</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actual</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Sugerido</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Var.</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Conf.</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Estado</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {suggestions.map((s: any) => {
              const varPct = s.current_price > 0 ? ((s.suggested_price - s.current_price) / s.current_price * 100).toFixed(1) : "0"
              return (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{s.product_id?.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-right">{Intl.NumberFormat().format(s.current_price)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-purple-600">{Intl.NumberFormat().format(s.suggested_price)}</td>
                  <td className={`px-4 py-3 text-right ${parseFloat(varPct) > 0 ? "text-green-600" : "text-red-600"}`}>{varPct}%</td>
                  <td className="px-4 py-3 text-center">{s.confidence ? `${s.confidence}%` : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.estado === "approved" ? "bg-green-50 text-green-600" :
                      s.estado === "rejected" ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-600"
                    }`}>{s.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.estado === "pending" && (
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleReview(s.id, "approved")} className="p-1 text-green-600 hover:bg-green-50 rounded"><ThumbsUp className="w-4 h-4" /></button>
                        <button onClick={() => handleReview(s.id, "rejected")} className="p-1 text-red-600 hover:bg-red-50 rounded"><ThumbsDown className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {suggestions.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin sugerencias de precio</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== APROBACIONES (Approval Workflow + History) =====

function AprobacionesTab() {
  const [requests, setRequests] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState("solicitudes")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    product_id: "", old_price: "", new_price: "", reason: "", approval_level: "1", price_list_id: "",
  })

  const load = () => {
    setLoading(true)
    Promise.all([
      api.smartPricing?.listChangeRequests(COMPANY_ID).then(setRequests),
      api.smartPricing?.listPriceHistory(COMPANY_ID).then(setHistory),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    await api.smartPricing?.createChangeRequest({
      product_id: form.product_id,
      old_price: parseFloat(form.old_price),
      new_price: parseFloat(form.new_price),
      reason: form.reason,
      approval_level: parseInt(form.approval_level),
      price_list_id: form.price_list_id || null,
    })
    setShowForm(false)
    setForm({ product_id: "", old_price: "", new_price: "", reason: "", approval_level: "1", price_list_id: "" })
    load()
  }

  const handleReview = async (id: string, status: string) => {
    const userId = "00000000-0000-0000-0000-000000000001"
    await api.smartPricing?.reviewChangeRequest(id, { status, approved_by: userId })
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        {[
          { key: "solicitudes", label: "Solicitudes", icon: FileText },
          { key: "historial", label: "Historial", icon: History },
        ].map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition ${
              subTab === t.key ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-gray-500 hover:text-gray-700"
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {subTab === "solicitudes" && (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{requests.length} solicitudes</p>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Nueva Solicitud
            </button>
          </div>

          {showForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Producto ID</label>
                  <input value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Niveles de Aprobación</label>
                  <select value={form.approval_level} onChange={e => setForm({ ...form, approval_level: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
                    <option value="1">1 Nivel</option>
                    <option value="2">2 Niveles</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Precio Actual</label>
                  <input type="number" value={form.old_price} onChange={e => setForm({ ...form, old_price: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nuevo Precio</label>
                  <input type="number" value={form.new_price} onChange={e => setForm({ ...form, new_price: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Motivo</label>
                  <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Solicitar</button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actual</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Nuevo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Motivo</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {requests.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-mono text-xs">{r.product_id?.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-right">{Intl.NumberFormat().format(r.old_price)}</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-600">{Intl.NumberFormat().format(r.new_price)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{r.reason || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === "approved" ? "bg-green-50 text-green-600" :
                        r.status === "rejected" ? "bg-red-50 text-red-600" :
                        r.status === "approved_1" ? "bg-yellow-50 text-yellow-600" :
                        "bg-gray-50 text-gray-600"
                      }`}>
                        {r.status === "approved_1" ? "Nivel 1 OK" : r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.status === "pending" && (
                        <div className="flex justify-center gap-1">
                          <button onClick={() => handleReview(r.id, "approved")} className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100">Aprobar</button>
                          <button onClick={() => handleReview(r.id, "rejected")} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">Rechazar</button>
                        </div>
                      )}
                      {r.status === "approved_1" && (
                        <button onClick={() => handleReview(r.id, "approved")} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100">Aprobar Nivel 2</button>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin solicitudes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {subTab === "historial" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Anterior</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Nuevo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Motivo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map((h: any) => (
                <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-mono text-xs">{h.product_id?.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-right">{Intl.NumberFormat().format(h.old_price)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">{Intl.NumberFormat().format(h.new_price)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600">{h.change_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{h.reason || "—"}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">
                    {h.created_at ? new Date(h.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin historial de cambios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
