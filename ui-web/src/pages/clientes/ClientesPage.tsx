import { useState, useEffect } from "react"
import {
  BarChart3, Users, TrendingUp, Gift, Tag, Ticket, Plus, Search, Loader2,
  DollarSign, Star, Target, Zap, CheckCircle, XCircle, RefreshCcw, Layers,
  Hash, CalendarDays, Award, CreditCard, Percent,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function ClientesPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes — Fidelización & Segmentación</h1>
          <p className="text-sm text-gray-500 mt-1">RFM scoring, segmentación conductual, programa de lealtad, ofertas personalizadas, cupones</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",  label: "Dashboard",     icon: BarChart3 },
            { key: "rfm",        label: "RFM Scoring",   icon: Target },
            { key: "segmentos",  label: "Segmentos",     icon: Layers },
            { key: "lealtad",    label: "Lealtad",       icon: Gift },
            { key: "ofertas",    label: "Ofertas",       icon: Tag },
            { key: "cupones",    label: "Cupones",       icon: Ticket },
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
      {tab === "rfm"        && <RfmTab />}
      {tab === "segmentos"  && <SegmentosTab />}
      {tab === "lealtad"    && <LealtadTab />}
      {tab === "ofertas"    && <OfertasTab />}
      {tab === "cupones"    && <CuponesTab />}
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

function ColorBadge({ color, label }: { color: string; label: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: color + "20", color }}>
      {label}
    </span>
  )
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.clientes.getDashboard(COMPANY_ID).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data) return <p className="text-center text-gray-500 py-12">Sin datos. Calculá RFM primero.</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Clientes RFM" value={data.total_customers_with_rfm} color="blue" />
        <KpiCard icon={Target} label="Segmentos" value={data.segment_breakdown?.length || 0} color="purple" />
        <KpiCard icon={Gift} label="Ofertas Activas" value={data.active_offers} color="green" />
        <KpiCard icon={Ticket} label="Cupones Activos" value={data.active_coupons} color="indigo" />
      </div>

      {data.segment_breakdown?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Segmentos de Clientes</h3>
          <div className="space-y-2">
            {data.segment_breakdown.map((s: any) => (
              <div key={s.nombre} className="flex items-center gap-2 text-sm">
                <ColorBadge color={s.color || "#6366f1"} label={s.nombre} />
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (s.count / Math.max(1, data.total_customers_with_rfm)) * 100)}%`, backgroundColor: s.color || "#6366f1" }}></div>
                </div>
                <span className="text-gray-500 text-xs">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.rfm_distribution && Object.keys(data.rfm_distribution).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Distribución RFM</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {Object.entries(data.rfm_distribution).map(([seg, count]: any) => (
              <div key={seg} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{seg}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== RFM =====

function RfmTab() {
  const [scores, setScores] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [filterSeg, setFilterSeg] = useState("")

  const load = () => {
    setLoading(true)
    Promise.all([
      api.clientes.listRfmScores(COMPANY_ID, filterSeg),
      api.clientes.getRfmSummary(COMPANY_ID),
    ]).then(([s, sm]) => { setScores(s); setSummary(sm) }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterSeg])

  const bulkEvaluate = async () => {
    setEvaluating(true)
    await api.clientes.bulkEvaluateRfm(COMPANY_ID).catch(() => {})
    await load()
    setEvaluating(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2 items-center">
          <button onClick={bulkEvaluate} disabled={evaluating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >{evaluating ? <Spinner /> : <RefreshCcw className="w-4 h-4" />} Evaluar Todos</button>
          <select value={filterSeg} onChange={e => setFilterSeg(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800"
          >
            <option value="">Todos los segmentos</option>
            <option value="Leales Premium">Leales Premium</option>
            <option value="Leales">Leales</option>
            <option value="Regulares">Regulares</option>
            <option value="Ocasionales">Ocasionales</option>
            <option value="Perdidos">Perdidos</option>
          </select>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard icon={Users} label="Con RFM" value={summary.total_with_rfm} color="blue" />
          <KpiCard icon={Star} label="RFM Promedio" value={summary.average_rfm} color="purple" />
          <KpiCard icon={CalendarDays} label="Recencia Promedio" value={`${summary.average_recency_days}d`} color="indigo" />
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-500">Cliente</th>
                <th className="px-4 py-2 font-medium text-gray-500">R</th>
                <th className="px-4 py-2 font-medium text-gray-500">F</th>
                <th className="px-4 py-2 font-medium text-gray-500">M</th>
                <th className="px-4 py-2 font-medium text-gray-500">Total</th>
                <th className="px-4 py-2 font-medium text-gray-500">Segmento</th>
                <th className="px-4 py-2 font-medium text-gray-500">Recencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {scores.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2">{s.customer_id?.slice(0, 8)}...</td>
                  <td className="px-4 py-2">{s.recency_score}</td>
                  <td className="px-4 py-2">{s.frequency_score}</td>
                  <td className="px-4 py-2">{s.monetary_score}</td>
                  <td className="px-4 py-2 font-bold">{s.rfm_total}</td>
                  <td className="px-4 py-2">{s.rfm_segment ? <ColorBadge color={s.rfm_segment === "Leales Premium" ? "#8b5cf6" : s.rfm_segment === "Leales" ? "#22c55e" : s.rfm_segment === "Regulares" ? "#3b82f6" : s.rfm_segment === "Ocasionales" ? "#f59e0b" : "#ef4444"} label={s.rfm_segment} /> : "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{s.recency_days != null ? `${s.recency_days}d` : "—"}</td>
                </tr>
              ))}
              {scores.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Sin datos. Hacé clic en "Evaluar Todos".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===== SEGMENTOS =====

function SegmentosTab() {
  const [segments, setSegments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: "", descripcion: "", slug: "", color: "#6366f1", rfm_min: "", rfm_max: "" })

  const load = () => {
    setLoading(true)
    api.clientes.listSegments(COMPANY_ID).then(setSegments).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    await api.clientes.createSegment(COMPANY_ID, {
      nombre: form.nombre, descripcion: form.descripcion || undefined,
      slug: form.slug, color: form.color,
      rfm_min: form.rfm_min ? parseInt(form.rfm_min) : undefined,
      rfm_max: form.rfm_max ? parseInt(form.rfm_max) : undefined,
    }).catch(() => {})
    setShowForm(false)
    setForm({ nombre: "", descripcion: "", slug: "", color: "#6366f1", rfm_min: "", rfm_max: "" })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{segments.length} segmentos</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        ><Plus className="w-4 h-4" /> Nuevo Segmento</button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <input placeholder="Slug (ej: clientes-vip)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
              className="px-1 py-1.5 border rounded-lg h-9 cursor-pointer" />
            <input placeholder="RFM min" type="number" value={form.rfm_min} onChange={e => setForm({ ...form, rfm_min: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <input placeholder="RFM max" type="number" value={form.rfm_max} onChange={e => setForm({ ...form, rfm_max: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <input placeholder="Descripción" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Crear</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((s: any) => (
            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                <h3 className="font-semibold text-sm">{s.nombre}</h3>
                {s.is_system && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">sistema</span>}
              </div>
              <p className="text-xs text-gray-500 mb-2">{s.descripcion || "Sin descripción"}</p>
              <div className="flex gap-3 text-xs text-gray-500">
                <span>RFM: {s.rfm_min ?? "—"} - {s.rfm_max ?? "∞"}</span>
                <span>Clientes: {s.customer_count}</span>
                <span className={s.activo ? "text-green-600" : "text-red-600"}>{s.activo ? "Activo" : "Inactivo"}</span>
              </div>
            </div>
          ))}
          {segments.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-8">Sin segmentos creados.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ===== LEALTAD =====

function LealtadTab() {
  const [txns, setTxns] = useState<any[]>([])
  const [program, setProgram] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customer_id: "", tipo: "acumulacion", puntos: "100", concepto: "" })
  const [editing, setEditing] = useState(false)
  const [progForm, setProgForm] = useState<any>({})

  const load = () => {
    setLoading(true)
    Promise.all([
      api.clientes.listLoyaltyTransactions(COMPANY_ID),
      api.clientes.getLoyaltyProgram(COMPANY_ID),
    ]).then(([t, p]) => { setTxns(t); setProgram(p); setProgForm(p || {}) }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const createTxn = async () => {
    await api.clientes.createLoyaltyTransaction(COMPANY_ID, {
      customer_id: form.customer_id, tipo: form.tipo,
      puntos: parseInt(form.puntos), concepto: form.concepto || undefined,
    }).catch(() => {})
    setShowForm(false)
    setForm({ customer_id: "", tipo: "acumulacion", puntos: "100", concepto: "" })
    load()
  }

  const saveProgram = async () => {
    await api.clientes.updateLoyaltyProgram(COMPANY_ID, progForm).catch(() => {})
    setEditing(false)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">Programa de Lealtad</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        ><Plus className="w-4 h-4" /> Nueva Transacción</button>
      </div>

      {program && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm">{program.nombre}</h3>
            <button onClick={() => setEditing(!editing)}
              className="text-xs text-blue-600 hover:underline"
            >{editing ? "Cancelar" : "Editar Configuración"}</button>
          </div>
          {editing ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries({
                points_per_currency: "Puntos por Gs. 1000",
                signup_bonus: "Bono registro",
                referral_bonus: "Bono referido",
                min_redeem_points: "Mínimo canje",
                tier_bronze_min: "Bronce min",
                tier_silver_min: "Silver min",
                tier_gold_min: "Gold min",
                tier_platinum_min: "Platinum min",
              }).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500">{label}</label>
                  <input type="number" value={(progForm as any)[key] ?? ""} onChange={e => setProgForm({ ...progForm, [key]: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-sm border rounded-lg bg-white dark:bg-gray-800" />
                </div>
              ))}
              <div className="col-span-full flex gap-2">
                <button onClick={saveProgram} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Guardar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">Puntos/Gs.1000:</span> {program.points_per_currency}</div>
              <div><span className="text-gray-500">Bono registro:</span> {program.signup_bonus}</div>
              <div><span className="text-gray-500">Mín. canje:</span> {program.min_redeem_points}</div>
              <div><span className="text-gray-500">Tiers:</span> {program.tier_enabled ? "Sí" : "No"}</div>
              <div><span className="text-gray-500">Bronce:</span> {program.tier_bronze_min}</div>
              <div><span className="text-gray-500">Silver:</span> {program.tier_silver_min}</div>
              <div><span className="text-gray-500">Gold:</span> {program.tier_gold_min}</div>
              <div><span className="text-gray-500">Platinum:</span> {program.tier_platinum_min}</div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input placeholder="Customer ID" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800">
              <option value="acumulacion">Acumulación</option>
              <option value="canje">Canje</option>
            </select>
            <input placeholder="Puntos" type="number" value={form.puntos} onChange={e => setForm({ ...form, puntos: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <input placeholder="Concepto" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
          </div>
          <button onClick={createTxn} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Registrar</button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-500">Cliente</th>
                <th className="px-4 py-2 font-medium text-gray-500">Tipo</th>
                <th className="px-4 py-2 font-medium text-gray-500">Puntos</th>
                <th className="px-4 py-2 font-medium text-gray-500">Concepto</th>
                <th className="px-4 py-2 font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {txns.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2">{t.customer_id?.slice(0, 8)}...</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.tipo === "acumulacion" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {t.tipo === "acumulacion" ? "+" : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-bold">{t.tipo === "acumulacion" ? "+" : "-"}{t.puntos}</td>
                  <td className="px-4 py-2 text-gray-500">{t.concepto || "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {txns.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin transacciones.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===== OFERTAS =====

function OfertasTab() {
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>({
    nombre: "", offer_type: "descuento", discount_type: "porcentaje",
    discount_value: "10", target_type: "todos", starts_at: "", ends_at: "",
  })

  const load = () => {
    setLoading(true)
    api.clientes.listOffers(COMPANY_ID).then(setOffers).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    await api.clientes.createOffer(COMPANY_ID, {
      nombre: form.nombre, offer_type: form.offer_type,
      discount_type: form.discount_type, discount_value: parseFloat(form.discount_value),
      target_type: form.target_type, starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
    }).catch(() => {})
    setShowForm(false)
    setForm({ nombre: "", offer_type: "descuento", discount_type: "porcentaje", discount_value: "10", target_type: "todos", starts_at: "", ends_at: "" })
    load()
  }

  const toggleActive = async (id: string, active: boolean) => {
    await api.clientes.updateOffer(COMPANY_ID, id, { activo: !active }).catch(() => {})
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{offers.length} ofertas</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        ><Plus className="w-4 h-4" /> Nueva Oferta</button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <select value={form.offer_type} onChange={e => setForm({ ...form, offer_type: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800">
              <option value="descuento">Descuento</option>
              <option value="bonificacion">Bonificación</option>
              <option value="combo">Combo</option>
            </select>
            <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800">
              <option value="porcentaje">% Descuento</option>
              <option value="fijo">Gs. Fijo</option>
            </select>
            <input placeholder="Valor descuento" type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <select value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800">
              <option value="todos">Todos los clientes</option>
              <option value="segmento">Por segmento</option>
              <option value="cliente">Cliente específico</option>
            </select>
            <input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
          </div>
          <button onClick={create} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Crear Oferta</button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((o: any) => (
            <div key={o.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-sm">{o.nombre}</h3>
                <button onClick={() => toggleActive(o.id, o.activo)}
                  className={`text-xs px-2 py-0.5 rounded-full ${o.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >{o.activo ? "Activa" : "Inactiva"}</button>
              </div>
              <p className="text-xs text-gray-500 mb-2">{o.offer_type} · {o.discount_type} · {o.discount_value}{o.discount_type === "porcentaje" ? "%" : " Gs"}</p>
              <div className="flex gap-3 text-xs text-gray-500">
                <span>Target: {o.target_type}</span>
                <span>Usos: {o.current_redemptions}/{o.max_redemptions || "∞"}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {o.starts_at && new Date(o.starts_at).toLocaleDateString()} → {o.ends_at && new Date(o.ends_at).toLocaleDateString()}
              </div>
            </div>
          ))}
          {offers.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-8">Sin ofertas creadas.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ===== CUPONES =====

function CuponesTab() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ discount_type: "porcentaje", discount_value: "10", max_uses: "1", count: "5", is_percentage: "true" })
  const [validateCode, setValidateCode] = useState("")
  const [validation, setValidation] = useState<any>(null)

  const load = () => {
    setLoading(true)
    api.clientes.listCoupons(COMPANY_ID).then(setCoupons).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const generate = async () => {
    await api.clientes.generateCoupons(COMPANY_ID, {
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_uses: parseInt(form.max_uses) || 1,
      count: parseInt(form.count) || 1,
      is_percentage: form.is_percentage === "true",
    }).catch(() => {})
    setShowForm(false)
    load()
  }

  const doValidate = async () => {
    if (!validateCode) return
    const result = await api.clientes.validateCoupon(COMPANY_ID, { code: validateCode }).catch(() => null)
    setValidation(result)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <p className="text-sm text-gray-500">{coupons.length} cupones</p>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <input placeholder="Validar código" value={validateCode} onChange={e => setValidateCode(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800 w-40" />
            <button onClick={doValidate}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
            ><Search className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          ><Plus className="w-4 h-4" /> Generar</button>
        </div>
      </div>

      {validation && (
        <div className={`p-3 rounded-lg text-sm ${validation.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {validation.valid ? `✅ Válido — Desc: Gs. ${validation.discount_amount?.toLocaleString()}, Final: Gs. ${validation.final_amount?.toLocaleString()}` : `❌ ${validation.message}`}
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800">
              <option value="porcentaje">% Descuento</option>
              <option value="fijo">Gs. Fijo</option>
            </select>
            <input placeholder="Valor" type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <input placeholder="Usos máximos" type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
            <input placeholder="Cantidad a generar" type="number" value={form.count} onChange={e => setForm({ ...form, count: e.target.value })}
              className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800" />
          </div>
          <button onClick={generate} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Generar</button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-500">Código</th>
                <th className="px-4 py-2 font-medium text-gray-500">Dto.</th>
                <th className="px-4 py-2 font-medium text-gray-500">Valor</th>
                <th className="px-4 py-2 font-medium text-gray-500">Usos</th>
                <th className="px-4 py-2 font-medium text-gray-500">Estado</th>
                <th className="px-4 py-2 font-medium text-gray-500">Vence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {coupons.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2 font-mono font-bold text-xs">{c.code}</td>
                  <td className="px-4 py-2">{c.discount_type === "porcentaje" ? "%" : "Gs"}</td>
                  <td className="px-4 py-2">{c.discount_value}{c.is_percentage ? "%" : " Gs"}</td>
                  <td className="px-4 py-2">{c.current_uses}/{c.max_uses}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {c.is_active ? "Activo" : "Agotado"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin cupones generados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
