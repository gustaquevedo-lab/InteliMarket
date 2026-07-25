import { useState, useEffect, useMemo } from "react"
import {
  FileSignature, Percent, ClipboardList, BarChart3, Search, Plus,
  Loader2, CheckCircle, XCircle, AlertTriangle, Eye, RefreshCw,
  DollarSign, Calendar, User, FileText, TrendingUp, TrendingDown,
  Clock, Zap, Shield, ChevronRight, ChevronDown, Tag, Package,
  ArrowRight, Upload, Download, MoreVertical, Filter, Bell, Gauge,
  ShoppingBag, Layers, Repeat, Edit, Trash2, Save, X, Building2,
  KanbanSquare, ArrowUpRight, Target, History
} from "lucide-react"
import { api, type CommercialAgreement, type AgreementItem } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"

type Tab = "dashboard" | "contratos" | "acuerdos" | "negociaciones" | "cumplimiento"
type NegStatus = "abierta" | "en_curso" | "cerrada_exitosa" | "cerrada_sin_acuerdo"

const formatPYG = (n?: number | string) => n != null ? "Gs " + Number(n).toLocaleString("es-PY") : "Gs 0"
const formatDate = (d?: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-PY", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }) : "-"
const daysUntil = (d?: string) => d ? Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000) : null

const statusColors: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  borrador: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  vencido: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  rescindido: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  cancelado: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  renovado: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  aprobado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  abierta: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  en_curso: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cerrada_exitosa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cerrada_sin_acuerdo: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
}

const Badge = ({ s }: { s: string }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusColors[s] || "bg-gray-100 text-gray-500"}`}>
    {s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}
  </span>
)

interface AgreementFormData {
  supplier_id: string; nombre: string; tipo: string; fecha_inicio: string; fecha_fin: string
  condiciones_pago: string; plazo_pago_dias: number; moneda: string; monto_minimo_orden: number | ""
  monto_total_acordado: number | ""; volumen_minimo_mensual: number | ""
  aplica_rebate: boolean; tipo_rebate: string; umbral_rebate_1: number | ""; porcentaje_rebate_1: number | ""
  exclusividad: boolean; zona_exclusividad: string; renovacion_automatica: boolean
  dias_aviso_renovacion: number; objeto: string; observaciones: string; archivo_url: string
  items: Array<{ id?: string; product_id: string; producto_nombre: string; precio_acordado: number | ""; descuento_pct: number | ""; cantidad_minima: number | ""; bono_pct: number | ""; lead_time_dias: number | "" }>
}

export default function SupplierContractsPage() {
  const { user } = useAuth()
  const companyId = user?.tenant_id || user?.id || ""
  const toast = useToast()

  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState<any[]>([])
  const [agreements, setAgreements] = useState<any[]>([])
  const [negotiations, setNegotiations] = useState<any[]>([])
  const [rebates, setRebates] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterSupplier, setFilterSupplier] = useState<string>("all")
  const [expandedAgreement, setExpandedAgreement] = useState<string | null>(null)

  // Multi-step form
  const [showForm, setShowForm] = useState(false)
  const [formStep, setFormStep] = useState(1)
  const [editingAgreement, setEditingAgreement] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<AgreementFormData>(defaultForm())

  function defaultForm(): AgreementFormData {
    return {
      supplier_id: "", nombre: "", tipo: "compra", fecha_inicio: "", fecha_fin: "",
      condiciones_pago: "", plazo_pago_dias: 30, moneda: "PYG", monto_minimo_orden: "",
      monto_total_acordado: "", volumen_minimo_mensual: "",
      aplica_rebate: false, tipo_rebate: "anual", umbral_rebate_1: "", porcentaje_rebate_1: "",
      exclusividad: false, zona_exclusividad: "", renovacion_automatica: false,
      dias_aviso_renovacion: 30, objeto: "", observaciones: "", archivo_url: "",
      items: [],
    }
  }

  // Search/filter products for line items
  const [productSearch, setProductSearch] = useState("")
  const [showProductPicker, setShowProductPicker] = useState(false)
  const filteredProducts = useMemo(() =>
    products.filter(p => !productSearch || p.nombre.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 50),
    [products, productSearch])

  const fetchAll = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [c, s, p] = await Promise.all([
        api.commercialAgreements.list(companyId).catch(() => []),
        api.commercialAgreements.list(companyId).catch(() => []),
        api.commercialAgreements.rebates.pending(companyId).catch(() => []),
      ])
      setContracts(c)
      setAgreements(c)
      setRebates(p)
      try { const sup = await (api as any).purchases?.suppliers?.list?.({}) || []; setSuppliers(sup) } catch { setSuppliers([]) }
      try { const prod = await (api as any).products?.list?.({ activo: true }) || []; setProducts(prod) } catch { setProducts([]) }
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [companyId])
  useEffect(() => {
    if (tab === "negociaciones" && companyId) {
      api.commercialAgreements.negotiations.list(companyId).then(setNegotiations).catch(() => {})
    }
  }, [tab, companyId])

  // Computed analytics
  const analytics = useMemo(() => {
    const now = new Date()
    const activos = contracts.filter(c => c.estado === "activo")
    const porVencer = contracts.filter(c => {
      const days = daysUntil(c.fecha_fin)
      return c.estado === "activo" && days !== null && days <= 30 && days > 0
    })
    const vencidos = contracts.filter(c => c.estado === "vencido" || (c.estado === "activo" && daysUntil(c.fecha_fin) !== null && daysUntil(c.fecha_fin)! <= 0))
    const totalMonto = contracts.filter(c => c.estado === "activo").reduce((s, c) => s + (Number(c.monto_total_acordado || c.limite_credito || 0)), 0)
    const totalEjecutado = contracts.filter(c => c.estado === "activo").reduce((s, c) => s + (Number(c.monto_ejecutado || 0)), 0)
    const cumplimientoGlobal = totalMonto > 0 ? Math.round((totalEjecutado / totalMonto) * 100) : 0
    const rebatesPendientes = rebates.filter((r: any) => r.estado === "pendiente").length
    const rebatesMonto = rebates.filter((r: any) => r.estado === "pendiente").reduce((s: number, r: any) => s + (Number(r.valor_rebate || 0)), 0)
    return { activos: activos.length, porVencer: porVencer.length, vencidos: vencidos.length, totalMonto, totalEjecutado, cumplimientoGlobal, rebatesPendientes, rebatesMonto }
  }, [contracts, rebates])

  // Filters
  const filtered = useMemo(() => {
    let list = tab === "contratos" || tab === "dashboard" || tab === "cumplimiento" ? contracts : agreements
    if (tab === "negociaciones") list = negotiations
    if (search) list = list.filter((c: any) => c.nombre?.toLowerCase().includes(search.toLowerCase()) || c.numero?.toLowerCase().includes(search.toLowerCase()) || c.supplier?.razon_social?.toLowerCase().includes(search.toLowerCase()))
    if (filterStatus !== "all") list = list.filter((c: any) => c.estado === filterStatus)
    if (filterSupplier !== "all") list = list.filter((c: any) => c.supplier_id === filterSupplier)
    return list
  }, [tab, contracts, agreements, negotiations, search, filterStatus, filterSupplier])

  // ---- Form handlers ----
  const addItem = (product: any) => {
    if (form.items.find(i => i.product_id === product.id)) return
    setForm(f => ({ ...f, items: [...f.items, { product_id: product.id, producto_nombre: product.nombre, precio_acordado: product.precio_venta || "", descuento_pct: "", cantidad_minima: "", bono_pct: "", lead_time_dias: "" }] }))
    setShowProductPicker(false)
    setProductSearch("")
  }
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const updateItem = (idx: number, field: string, value: any) => setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }))

  const handleSubmit = async () => {
    if (!form.supplier_id || !form.nombre) { toast.error("Error", "Proveedor y nombre son obligatorios"); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        monto_minimo_orden: form.monto_minimo_orden || 0,
        monto_total_acordado: form.monto_total_acordado || 0,
        volumen_minimo_mensual: form.volumen_minimo_mensual || 0,
        umbral_rebate_1: form.aplica_rebate ? (form.umbral_rebate_1 || 0) : 0,
        porcentaje_rebate_1: form.aplica_rebate ? (form.porcentaje_rebate_1 || 0) : 0,
        items: form.items.map(i => ({ product_id: i.product_id, precio_acordado: Number(i.precio_acordado) || 0, descuento_pct: Number(i.descuento_pct) || 0, cantidad_minima: Number(i.cantidad_minima) || 0, bono_pct: Number(i.bono_pct) || 0, lead_time_dias: Number(i.lead_time_dias) || 0 })),
      }
      if (editingAgreement) {
        await api.commercialAgreements.update(editingAgreement.id, payload)
        toast.success("Acuerdo actualizado")
      } else {
        await api.commercialAgreements.create(payload)
        toast.success("Acuerdo creado")
      }
      setShowForm(false); setEditingAgreement(null); setForm(defaultForm()); setFormStep(1); fetchAll()
    } catch (e: any) { toast.error("Error", e.message || "No se pudo guardar") }
    finally { setSaving(false) }
  }

  const openEdit = (a: any) => {
    setEditingAgreement(a)
    setForm({
      supplier_id: a.supplier_id || "", nombre: a.nombre || "", tipo: a.tipo || "compra",
      fecha_inicio: a.fecha_inicio || "", fecha_fin: a.fecha_fin || "",
      condiciones_pago: a.condiciones_pago || "", plazo_pago_dias: a.plazo_pago_dias || 30,
      moneda: a.moneda || "PYG", monto_minimo_orden: a.monto_minimo_orden || "",
      monto_total_acordado: a.monto_total_acordado || "", volumen_minimo_mensual: a.volumen_minimo_mensual || "",
      aplica_rebate: a.aplica_rebate || false, tipo_rebate: a.tipo_rebate || "anual",
      umbral_rebate_1: a.umbral_rebate_1 || "", porcentaje_rebate_1: a.porcentaje_rebate_1 || "",
      exclusividad: a.exclusividad || false, zona_exclusividad: a.zona_exclusividad || "",
      renovacion_automatica: a.renovacion_automatica || false, dias_aviso_renovacion: a.dias_aviso_renovacion || 30,
      objeto: a.objeto || "", observaciones: a.observaciones || "", archivo_url: a.archivo_url || "",
      items: (a.items || []).map((i: any) => ({
        id: i.id, product_id: i.product_id, producto_nombre: i.producto?.nombre || i.descripcion || "",
        precio_acordado: i.precio_acordado || "", descuento_pct: i.descuento_pct || "",
        cantidad_minima: i.cantidad_minima || "", bono_pct: i.bono_pct || "", lead_time_dias: i.lead_time_dias || "",
      })),
    })
    setFormStep(1); setShowForm(true)
  }

  const quickActions = {
    approve: async (id: string) => { try { await api.commercialAgreements.approve(id, user?.id || ""); toast.success("Aprobado"); fetchAll() } catch (e: any) { toast.error("Error", e.message) } },
    activate: async (id: string) => { try { await api.commercialAgreements.activate(id); toast.success("Activado"); fetchAll() } catch (e: any) { toast.error("Error", e.message) } },
    renew: async (id: string) => { try { await api.commercialAgreements.renew(id); toast.success("Renovado"); fetchAll() } catch (e: any) { toast.error("Error", e.message) } },
    cancel: async (id: string) => { const motivo = prompt("Motivo:"); if (!motivo) return; try { await api.commercialAgreements.cancel(id, motivo); toast.success("Cancelado"); fetchAll() } catch (e: any) { toast.error("Error", e.message) } },
  }

  // ---- Render helpers ----
  const HealthBar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-1">
      <div className={"h-full rounded-full transition-all duration-500 " + color} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )

  const getAlertLevel = (dateStr?: string) => {
    const days = daysUntil(dateStr)
    if (days === null) return null
    if (days <= 0) return { level: "critical", color: "red", label: "Vencido", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" }
    if (days <= 15) return { level: "high", color: "orange", label: `${days} días`, bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" }
    if (days <= 30) return { level: "medium", color: "yellow", label: `${days} días`, bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" }
    if (days <= 60) return { level: "low", color: "blue", label: `${days} días`, bg: "" }
    return null
  }

  // ---- COMPONENT: Dashboard ----
  const DashboardTab = () => (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Activos", value: analytics.activos, icon: FileSignature, color: "blue" },
          { label: "Por Vencer <30d", value: analytics.porVencer, icon: Bell, color: "orange" },
          { label: "Vencidos", value: analytics.vencidos, icon: AlertTriangle, color: "red" },
          { label: "Monto Acordado", value: formatPYG(analytics.totalMonto), icon: DollarSign, color: "green" },
          { label: "Rebates Pend.", value: `${analytics.rebatesPendientes} (${formatPYG(analytics.rebatesMonto)})`, icon: Percent, color: "purple" },
        ].map((k, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl bg-${k.color}-100 dark:bg-${k.color}-900/30 flex items-center justify-center`}><k.icon className={`w-5 h-5 text-${k.color}-600 dark:text-${k.color}-400`} /></div>
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{k.label}</p><p className="text-lg font-bold truncate">{k.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Section */}
      {contracts.filter(c => { const a = getAlertLevel(c.fecha_fin); return a && a.level !== "low" }).length > 0 && (
        <div className="card p-5 border-l-4 border-l-red-500">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3"><Bell className="w-4 h-4 text-red-500" />Alertas de Vencimiento</h3>
          <div className="grid grid-cols-3 gap-3">
            {contracts.filter(c => { const a = getAlertLevel(c.fecha_fin); return a && a.level !== "low" }).slice(0, 6).map(c => {
              const alert = getAlertLevel(c.fecha_fin)!
              return (
                <div key={c.id} className={`rounded-xl border p-4 ${alert.bg}`}>
                  <div className="flex items-center justify-between mb-1"><p className="font-bold text-sm truncate">{c.nombre}</p><Badge s={c.estado} /></div>
                  <p className="text-xs text-gray-500">{c.supplier?.razon_social || c.supplier_id}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{formatDate(c.fecha_fin)}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-${alert.color}-100 text-${alert.color}-700 dark:bg-${alert.color}-900/30 dark:text-${alert.color}-400`}>{alert.label}</span>
                  </div>
                  <div className="mt-2"><HealthBar pct={Math.max(0, (daysUntil(c.fecha_fin) || 0) / 60 * 100)} color={`bg-${alert.color}-500`} /></div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timeline Overview */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-primary" />Línea de Tiempo de Acuerdos</h3>
        <div className="relative overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {contracts.filter(c => c.fecha_inicio).sort((a, b) => (a.fecha_inicio || "").localeCompare(b.fecha_inicio || "")).slice(0, 20).map(c => {
              const start = new Date(c.fecha_inicio + "T00:00:00").getTime()
              const end = new Date(c.fecha_fin + "T00:00:00").getTime()
              const total = end - start
              const progress = Math.min(100, Math.max(0, ((Date.now() - start) / total) * 100))
              const isActive = c.estado === "activo"
              return (
                <div key={c.id} className="flex-shrink-0 w-48">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{formatDate(c.fecha_inicio)}</p>
                    <div className="h-1 bg-gray-300 dark:bg-gray-600 rounded-full mb-1"><div className={`h-full rounded-full ${isActive ? "bg-primary" : "bg-gray-400"}`} style={{ width: `${progress}%` }} /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{formatDate(c.fecha_fin)}</p>
                    <p className="text-xs font-bold mt-1 truncate">{c.nombre}</p>
                    <p className="text-[10px] text-gray-400">{c.supplier?.razon_social || ""}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Rebates Summary */}
      {rebates.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4"><Percent className="w-4 h-4 text-purple-500" />Rebates Pendientes de Liquidación</h3>
          <div className="grid grid-cols-3 gap-3">
            {rebates.filter((r: any) => r.estado === "pendiente").map((r: any) => (
              <div key={r.id} className="border border-purple-200 dark:border-purple-800 rounded-xl p-4 bg-purple-50/50 dark:bg-purple-950/10">
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-purple-700 dark:text-purple-400">{r.tipo?.toUpperCase()}</span><span className="text-xs text-gray-500">{r.periodo}</span></div>
                <p className="text-lg font-bold mt-1">{formatPYG(r.valor_rebate)}</p>
                <div className="flex items-center justify-between mt-2"><span className="text-[10px] text-gray-400">Umbral: {formatPYG(r.umbral_desde)}</span><button onClick={() => { api.commercialAgreements.rebates.liquidate(r.id, user?.id || "").then(() => { toast.success("Liquidado"); fetchAll() }).catch(e => toast.error("Error", e.message)) }} className="px-3 py-1 text-[10px] font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700">Liquidar</button></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ---- COMPONENT: Contracts Table (enhanced) ----
  const ContractsTab = () => (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-header">
            <th className="table-cell">Proveedor</th><th className="table-cell">Contrato</th><th className="table-cell">Vigencia</th><th className="table-cell">Monto</th><th className="table-cell">Ejecución</th><th className="table-cell">Alerta</th><th className="table-cell">Estado</th><th className="table-cell">Acciones</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-gray-400"><FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />Sin contratos. Creá tu primer acuerdo comercial.</td></tr>
            ) : filtered.map(c => {
              const alert = getAlertLevel(c.fecha_fin)
              const pctEjecucion = c.monto_total_acordado > 0 ? Math.round((Number(c.monto_ejecutado || 0) / Number(c.monto_total_acordado)) * 100) : 0
              return (
                <tr key={c.id} className="table-row hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="table-td"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center"><Building2 className="w-4 h-4 text-primary" /></div><span className="font-medium text-sm">{c.supplier?.razon_social || c.supplier_id}</span></div></td>
                  <td className="table-td"><span className="font-bold text-sm">{c.nombre}</span><p className="text-xs text-gray-400 font-mono">{c.numero}</p></td>
                  <td className="table-td text-xs">{formatDate(c.fecha_inicio)} → {formatDate(c.fecha_fin)}</td>
                  <td className="table-td font-mono font-bold">{formatPYG(c.monto_total_acordado)}</td>
                  <td className="table-td"><div className="flex items-center gap-2"><HealthBar pct={pctEjecucion} color="bg-primary" /><span className="text-xs font-mono w-10 text-right">{pctEjecucion}%</span></div></td>
                  <td className="table-td">{alert ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-${alert.color}-100 text-${alert.color}-700`}>{alert.label}</span> : "-"}</td>
                  <td className="table-td"><Badge s={c.estado} /></td>
                  <td className="table-td">
                    <div className="flex gap-0.5">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Editar"><Edit className="w-3.5 h-3.5 text-gray-400" /></button>
                      {(c.estado === "borrador") && <button onClick={() => quickActions.approve(c.id)} className="p-1.5 rounded-lg hover:bg-blue-50" title="Aprobar"><CheckCircle className="w-3.5 h-3.5 text-blue-600" /></button>}
                      {(c.estado === "aprobado") && <button onClick={() => quickActions.activate(c.id)} className="p-1.5 rounded-lg hover:bg-emerald-50" title="Activar"><Zap className="w-3.5 h-3.5 text-emerald-600" /></button>}
                      {(c.estado === "activo") && <button onClick={() => quickActions.renew(c.id)} className="p-1.5 rounded-lg hover:bg-sky-50" title="Renovar"><RefreshCw className="w-3.5 h-3.5 text-sky-600" /></button>}
                      {c.estado !== "rescindido" && c.estado !== "vencido" && c.estado !== "cancelado" && <button onClick={() => quickActions.cancel(c.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Cancelar"><XCircle className="w-3.5 h-3.5 text-red-500" /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ---- COMPONENT: Acuerdos with Price Waterfall ----
  const AcuerdosTab = () => (
    <div className="space-y-4">
      {filteredAgreements.length === 0 ? (
        <div className="card p-12 text-center text-gray-400"><Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />Sin acuerdos comerciales</div>
      ) : filteredAgreements.map(a => {
        const isExpanded = expandedAgreement === a.id
        const items = a.items || []
        const totalLista = items.reduce((s: number, i: any) => s + (Number(i.precio_lista || 0) * (i.cantidad_minima || 1)), 0)
        const totalAcordado = items.reduce((s: number, i: any) => s + (Number(i.precio_acordado || 0) * (i.cantidad_minima || 1)), 0)
        const ahorro = totalLista - totalAcordado
        const pctAhorro = totalLista > 0 ? Math.round((ahorro / totalLista) * 100) : 0
        return (
          <div key={a.id} className="card overflow-hidden">
            <div className="p-5 cursor-pointer" onClick={() => setExpandedAgreement(isExpanded ? null : a.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><Percent className="w-5 h-5 text-white" /></div>
                  <div><p className="font-bold">{a.nombre}</p><p className="text-xs text-gray-400">{a.supplier?.razon_social || ""} · {a.tipo} · {formatDate(a.fecha_inicio)} → {formatDate(a.fecha_fin)}</p></div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right"><p className="text-xs text-gray-400">Ahorro estimado</p><p className="text-lg font-bold text-emerald-600">{formatPYG(ahorro)} <span className="text-sm">({pctAhorro}%)</span></p></div>
                  <Badge s={a.estado} />
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-5 bg-gray-50/50 dark:bg-slate-800/50">
                {/* Price Waterfall */}
                <div className="mb-5">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" />Price Waterfall</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white dark:bg-slate-700 rounded-xl p-3 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Precio Lista</p><p className="text-lg font-bold">{formatPYG(totalLista)}</p></div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                    <div className="flex-1 bg-white dark:bg-slate-700 rounded-xl p-3 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dto. Negociado</p><p className="text-lg font-bold text-emerald-600">-{formatPYG(ahorro)}</p></div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                    <div className="flex-1 bg-white dark:bg-slate-700 rounded-xl p-3 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Precio Final</p><p className="text-lg font-bold text-primary">{formatPYG(totalAcordado)}</p></div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                    <div className="flex-1 bg-white dark:bg-slate-700 rounded-xl p-3 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rebate Est.</p><p className="text-lg font-bold text-purple-600">{a.aplica_rebate ? `${formatPYG(Math.round(totalAcordado * (Number(a.porcentaje_rebate_1 || 0) / 100)))}` : "-"}</p></div>
                  </div>
                </div>
                {/* Line Items */}
                {items.length > 0 && (
                  <div><h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Productos del Acuerdo ({items.length})</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {items.map((it: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-700 rounded-lg p-3">
                          <div className="flex items-center gap-3"><Package className="w-4 h-4 text-gray-400" /><span className="text-sm font-medium">{it.producto?.nombre || it.descripcion || it.product_id}</span></div>
                          <div className="flex items-center gap-6 text-xs font-mono">
                            <span className="text-gray-400">Lista: {formatPYG(it.precio_lista)}</span>
                            <span className="font-bold text-emerald-600">Acordado: {formatPYG(it.precio_acordado)}</span>
                            {it.descuento_pct > 0 && <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 px-2 py-0.5 rounded-full">-{it.descuento_pct}%</span>}
                            {it.bono_pct > 0 && <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 px-2 py-0.5 rounded-full">+{it.bono_pct}% bono</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(a) }} className="btn-outline text-xs"><Edit className="w-4 h-4" />Editar</button>
                  {a.estado === "activo" && <button onClick={(e) => { e.stopPropagation(); quickActions.renew(a.id) }} className="btn-outline text-xs"><RefreshCw className="w-4 h-4" />Renovar</button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // ---- COMPONENT: Kanban Negotiations ----
  const NegociacionesTab = () => {
    const columns: { key: NegStatus; label: string; icon: any; color: string }[] = [
      { key: "abierta", label: "Abiertas", icon: ClipboardList, color: "violet" },
      { key: "en_curso", label: "En Curso", icon: Zap, color: "blue" },
      { key: "cerrada_exitosa", label: "Cerradas (OK)", icon: CheckCircle, color: "emerald" },
      { key: "cerrada_sin_acuerdo", label: "Sin Acuerdo", icon: XCircle, color: "rose" },
    ]
    return (
      <div className="grid grid-cols-4 gap-4">
        {columns.map(col => {
          const items = negotiations.filter((n: any) => n.estado === col.key)
          return (
            <div key={col.key} className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><col.icon className={`w-4 h-4 text-${col.color}-500`} /><h3 className="font-bold text-sm">{col.label}</h3></div>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-mono">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((n: any) => (
                  <div key={n.id} className={`border border-${col.color}-200 dark:border-${col.color}-800 rounded-xl p-3 bg-${col.color}-50/30 dark:bg-${col.color}-950/10`}>
                    <p className="font-bold text-sm">{n.titulo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{n.supplier?.razon_social || ""}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{n.tipo}</span>
                      {n.meta_precio && <span className="font-mono text-gray-500">Meta: {formatPYG(n.meta_precio)}</span>}
                    </div>
                    {n.estado === "abierta" && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => api.commercialAgreements.negotiations.close(n.id, "cerrada_exitosa").then(() => { toast.success("Cerrada exitosamente"); fetchAll() }).catch(e => toast.error("Error", e.message))} className="text-[10px] px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold flex-1">✅ Cerrar exitosa</button>
                        <button onClick={() => api.commercialAgreements.negotiations.close(n.id, "cerrada_sin_acuerdo").then(() => { toast.success("Cerrada sin acuerdo"); fetchAll() }).catch(e => toast.error("Error", e.message))} className="text-[10px] px-3 py-1 bg-rose-600 text-white rounded-lg font-bold flex-1">❌ Sin acuerdo</button>
                      </div>
                    )}
                    {n.estado === "cerrada_exitosa" && n.precio_final && <p className="text-xs font-bold text-emerald-600 mt-2">Precio final: {formatPYG(n.precio_final)}</p>}
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin items</p>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ---- COMPONENT: Compliance Tracking ----
  const CumplimientoTab = () => (
    <div className="space-y-4">
      {agreements.filter((a: any) => a.volumes?.length > 0).length === 0 ? (
        <div className="card p-12 text-center text-gray-400"><Gauge className="w-12 h-12 mx-auto mb-3 opacity-30" />Sin datos de cumplimiento. Los volúmenes se registran automáticamente al facturar.</div>
      ) : agreements.filter((a: any) => a.volumes?.length > 0).map(a => (
        <div key={a.id} className="card p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold">{a.nombre}</h3><Badge s={a.estado} /></div>
          <div className="space-y-3">
            {(a.volumes || []).map((v: any) => {
              const pct = v.porcentaje_cumplimiento ? Number(v.porcentaje_cumplimiento) : 0
              const pctColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
              return (
                <div key={v.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-gray-500 uppercase">{v.periodo}</span><span className={`text-sm font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>{pct.toFixed(1)}%</span></div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2"><div className={`h-full rounded-full transition-all ${pctColor}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Vol: {Number(v.volumen_real || 0).toLocaleString()} / {Number(v.volumen_comprometido || 0).toLocaleString()}</span>
                    <span>Monto: {formatPYG(v.monto_real)} / {formatPYG(v.monto_comprometido)}</span>
                  </div>
                  {v.bonificacion_ganada > 0 && <p className="text-xs text-emerald-600 mt-1 font-bold">+{formatPYG(v.bonificacion_ganada)} bonificación</p>}
                  {v.multa_aplicada > 0 && <p className="text-xs text-red-600 mt-1 font-bold">-{formatPYG(v.multa_aplicada)} multa</p>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  // ---- MODAL: Multi-step form ----
  const supplierOptions = useMemo(() => [
    { id: "00000000-0000-0000-0000-000000000060", name: "Distribuidora Trebol S.A." },
    { id: "00000000-0000-0000-0000-000000000061", name: "Coca-Cola Paraguay S.A." },
    ...suppliers.map((s: any) => ({ id: s.id, name: s.razon_social || s.nombre_fantasia || s.nombre || s.id }))
  ].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i), [suppliers])

  const FormModal = () => (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditingAgreement(null); setFormStep(1) }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header + stepper */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{editingAgreement ? "Editar Acuerdo" : "Nuevo Acuerdo Comercial"}</h2>
            <button onClick={() => { setShowForm(false); setEditingAgreement(null); setFormStep(1) }} className="btn-ghost"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            {["1. Datos Generales", "2. Productos & Precios", "3. Rebates & Volumen", "4. Revisión"].map((step, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div onClick={() => setFormStep(i + 1)} className={`flex-1 text-center px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${formStep >= i + 1 ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-400"}`}>{step}</div>
                {i < 3 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Steps content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {formStep === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="input-label label-required">Proveedor</label>
                <select className="input-field" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">Seleccionar proveedor...</option>
                  {supplierOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="input-label label-required">Nombre del acuerdo</label><input className="input-field" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Acuerdo Marco Trebol 2026" /></div>
              <div><label className="input-label">Tipo</label><select className="input-field" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}><option value="compra">Compra</option><option value="descuento_volumen">Descuento por Volumen</option><option value="rebate">Rebate</option><option value="promocion">Promoción</option><option value="precio_especial">Precio Especial</option><option value="exclusividad">Exclusividad</option></select></div>
              <div><label className="input-label">Moneda</label><select className="input-field" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}><option value="PYG">PYG (Gs)</option><option value="USD">USD ($)</option></select></div>
              <div><label className="input-label label-required">Fecha inicio</label><input type="date" className="input-field" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
              <div><label className="input-label label-required">Fecha fin</label><input type="date" className="input-field" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} /></div>
              <div className="col-span-2"><label className="input-label">Condiciones de pago</label><input className="input-field" value={form.condiciones_pago} onChange={e => setForm(f => ({ ...f, condiciones_pago: e.target.value }))} placeholder="Ej: 30% anticipo, 70% contra entrega" /></div>
              <div><label className="input-label">Plazo pago (días)</label><input type="number" className="input-field" value={form.plazo_pago_dias} onChange={e => setForm(f => ({ ...f, plazo_pago_dias: +e.target.value }))} /></div>
              <div><label className="input-label">Días aviso renovación</label><input type="number" className="input-field" value={form.dias_aviso_renovacion} onChange={e => setForm(f => ({ ...f, dias_aviso_renovacion: +e.target.value }))} /></div>
              <div><label className="input-label">Monto total acordado</label><input type="number" className="input-field" value={form.monto_total_acordado} onChange={e => setForm(f => ({ ...f, monto_total_acordado: e.target.value }))} /></div>
              <div><label className="input-label">Monto mínimo por orden</label><input type="number" className="input-field" value={form.monto_minimo_orden} onChange={e => setForm(f => ({ ...f, monto_minimo_orden: e.target.value }))} /></div>
              <div><label className="input-label">Volumen mínimo mensual</label><input type="number" className="input-field" value={form.volumen_minimo_mensual} onChange={e => setForm(f => ({ ...f, volumen_minimo_mensual: e.target.value }))} /></div>
              <div className="col-span-2"><label className="input-label">Objeto del acuerdo</label><textarea className="input-field" rows={2} value={form.objeto} onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))} placeholder="Descripción del alcance..." /></div>
              <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-primary" /><div><p className="text-sm font-bold">Exclusividad</p><p className="text-xs text-gray-400">El proveedor se compromete a no vender a competidores</p></div></div>
                <button onClick={() => setForm(f => ({ ...f, exclusividad: !f.exclusividad }))} className={`w-12 h-6 rounded-full transition-all ${form.exclusividad ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"} relative`}><div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${form.exclusividad ? "left-6" : "left-0.5"}`} /></button>
              </div>
              {form.exclusividad && <div className="col-span-2"><label className="input-label">Zona de exclusividad</label><input className="input-field" value={form.zona_exclusividad} onChange={e => setForm(f => ({ ...f, zona_exclusividad: e.target.value }))} placeholder="Ej: Asunción y Área Metropolitana" /></div>}
              <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="flex items-center gap-3"><RefreshCw className="w-5 h-5 text-primary" /><div><p className="text-sm font-bold">Renovación automática</p><p className="text-xs text-gray-400">Al vencer se genera un nuevo período automáticamente</p></div></div>
                <button onClick={() => setForm(f => ({ ...f, renovacion_automatica: !f.renovacion_automatica }))} className={`w-12 h-6 rounded-full transition-all ${form.renovacion_automatica ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"} relative`}><div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${form.renovacion_automatica ? "left-6" : "left-0.5"}`} /></button>
              </div>
            </div>
          )}

          {formStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">Productos del Acuerdo ({form.items.length})</h3>
                <button onClick={() => { setShowProductPicker(true); setProductSearch("") }} className="btn-primary text-xs"><Plus className="w-4 h-4" />Agregar producto</button>
              </div>
              {form.items.length === 0 && <div className="text-center py-12 text-gray-400"><Package className="w-10 h-10 mx-auto mb-3 opacity-30" />Agregá productos con precios acordados, descuentos y bonificaciones</div>}
              {form.items.map((it, idx) => (
                <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /><span className="font-bold text-sm">{it.producto_nombre}</span></div><button onClick={() => removeItem(idx)} className="p-1 hover:bg-red-50 rounded-lg"><X className="w-4 h-4 text-red-400" /></button></div>
                  <div className="grid grid-cols-5 gap-3">
                    <div><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Precio acordado</label><input type="number" className="input-field text-sm" value={it.precio_acordado} onChange={e => updateItem(idx, "precio_acordado", e.target.value)} /></div>
                    <div><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dto. %</label><input type="number" className="input-field text-sm" value={it.descuento_pct} onChange={e => updateItem(idx, "descuento_pct", e.target.value)} /></div>
                    <div><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cant. mínima</label><input type="number" className="input-field text-sm" value={it.cantidad_minima} onChange={e => updateItem(idx, "cantidad_minima", e.target.value)} /></div>
                    <div><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Bono %</label><input type="number" className="input-field text-sm" value={it.bono_pct} onChange={e => updateItem(idx, "bono_pct", e.target.value)} /></div>
                    <div><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Lead time (días)</label><input type="number" className="input-field text-sm" value={it.lead_time_dias} onChange={e => updateItem(idx, "lead_time_dias", e.target.value)} /></div>
                  </div>
                </div>
              ))}
              {/* Product Picker Modal */}
              {showProductPicker && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setShowProductPicker(false)}>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between"><h3 className="font-bold">Seleccionar Producto</h3><button onClick={() => setShowProductPicker(false)} className="btn-ghost"><X className="w-4 h-4" /></button></div>
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700"><Search className="absolute left-7 mt-2.5 w-4 h-4 text-gray-400" /><input className="input-field pl-10" placeholder="Buscar producto..." autoFocus value={productSearch} onChange={e => setProductSearch(e.target.value)} /></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {filteredProducts.length === 0 ? <p className="text-center py-8 text-gray-400">Sin resultados</p> :
                        filteredProducts.map(p => (
                          <button key={p.id} onClick={() => addItem(p)} className="w-full text-left p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3"><Package className="w-4 h-4 text-gray-400" /><div><p className="text-sm font-bold">{p.nombre}</p><p className="text-xs text-gray-400">{p.sku}</p></div></div>
                            <span className="text-xs font-mono text-primary">{formatPYG(p.precio_venta)}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {formStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="flex items-center gap-3"><Percent className="w-5 h-5 text-purple-500" /><div><p className="text-sm font-bold">Aplica Rebate</p><p className="text-xs text-gray-400">Compensación por cumplimiento de metas</p></div></div>
                <button onClick={() => setForm(f => ({ ...f, aplica_rebate: !f.aplica_rebate }))} className={`w-12 h-6 rounded-full transition-all ${form.aplica_rebate ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"} relative`}><div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${form.aplica_rebate ? "left-6" : "left-0.5"}`} /></button>
              </div>
              {form.aplica_rebate && (
                <div className="border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3 bg-purple-50/30 dark:bg-purple-950/10">
                  <h4 className="text-sm font-bold text-purple-700 dark:text-purple-400">Configuración de Rebate</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="input-label">Tipo</label><select className="input-field" value={form.tipo_rebate} onChange={e => setForm(f => ({ ...f, tipo_rebate: e.target.value }))}><option value="anual">Anual</option><option value="trimestral">Trimestral</option><option value="mensual">Mensual</option></select></div>
                    <div><label className="input-label">Frec. liquidación</label><select className="input-field" value={form.frecuencia_liquidacion_rebate || "anual"} onChange={e => setForm(f => ({ ...f, frecuencia_liquidacion_rebate: e.target.value }))}><option value="anual">Anual</option><option value="trimestral">Trimestral</option><option value="mensual">Mensual</option></select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="input-label">Umbral ($)</label><input type="number" className="input-field" value={form.umbral_rebate_1} onChange={e => setForm(f => ({ ...f, umbral_rebate_1: e.target.value }))} placeholder="Monto mínimo para aplicar" /></div>
                    <div><label className="input-label">Porcentaje (%)</label><input type="number" className="input-field" value={form.porcentaje_rebate_1} onChange={e => setForm(f => ({ ...f, porcentaje_rebate_1: e.target.value }))} placeholder="% sobre el monto ejecutado" /></div>
                  </div>
                </div>
              )}
              <div><label className="input-label">URL del archivo (PDF firmado)</label><input className="input-field" value={form.archivo_url} onChange={e => setForm(f => ({ ...f, archivo_url: e.target.value }))} placeholder="https://..." /></div>
              <div><label className="input-label">Observaciones internas</label><textarea className="input-field" rows={3} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Notas internas, condiciones especiales..." /></div>
            </div>
          )}

          {formStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Resumen del Acuerdo</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedor</p><p className="font-bold">{supplierOptions.find(s => s.id === form.supplier_id)?.name || form.supplier_id}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre</p><p className="font-bold">{form.nombre}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vigencia</p><p className="font-bold">{formatDate(form.fecha_inicio)} → {formatDate(form.fecha_fin)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo / Moneda</p><p className="font-bold">{form.tipo} · {form.moneda}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto acordado</p><p className="font-bold text-lg text-primary">{formatPYG(form.monto_total_acordado || 0)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Productos</p><p className="font-bold">{form.items.length} items</p>
                  {form.items.length > 0 && <p className="text-xs text-gray-400 mt-1">{form.items.map(i => i.producto_nombre).join(", ")}</p>}
                </div>
                {form.aplica_rebate && <div className="col-span-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">Rebate</p><p className="font-bold text-purple-700 dark:text-purple-400">{form.porcentaje_rebate_1}% sobre compras &gt; {formatPYG(form.umbral_rebate_1 || 0)}</p>
                </div>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex gap-2">
            {formStep > 1 && <button onClick={() => setFormStep(s => s - 1)} className="btn-outline text-sm">← Anterior</button>}
            {formStep < 4 && <button onClick={() => setFormStep(s => s + 1)} className="btn-primary text-sm">Siguiente →</button>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditingAgreement(null); setFormStep(1) }} className="btn-outline text-sm">Cancelar</button>
            {formStep === 4 && <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingAgreement ? "Guardar cambios" : "Crear acuerdo"}</button>}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acuerdos con Proveedores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gestión state-of-the-art de contratos, precios, rebates y cumplimiento</p>
        </div>
        <button onClick={() => { setEditingAgreement(null); setForm(defaultForm()); setFormStep(1); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo acuerdo</button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
        {([{ k: "dashboard" as Tab, l: "Dashboard", i: BarChart3 }, { k: "contratos" as Tab, l: "Contratos", i: FileSignature }, { k: "acuerdos" as Tab, l: "Acuerdos", i: Percent }, { k: "negociaciones" as Tab, l: "Negociaciones", i: KanbanSquare }, { k: "cumplimiento" as Tab, l: "Cumplimiento", i: Gauge }]).map(({ k, l, i: Icon }) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}><Icon className="w-4 h-4" />{l}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input className="input-field pl-10" placeholder="Buscar por nombre, número o proveedor..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="input-field w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">Todos los estados</option><option value="activo">Activo</option><option value="borrador">Borrador</option><option value="vencido">Vencido</option><option value="aprobado">Aprobado</option><option value="cancelado">Cancelado</option></select>
        <select className="input-field w-auto" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}><option value="all">Todos los proveedores</option>{supplierOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>

      {/* Tab Content */}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> :
        tab === "dashboard" ? <DashboardTab /> :
        tab === "contratos" ? <ContractsTab /> :
        tab === "acuerdos" ? <AcuerdosTab /> :
        tab === "negociaciones" ? <NegociacionesTab /> :
        <CumplimientoTab />}

      {/* Form Modal */}
      {showForm && <FormModal />}

      {/* History indicator */}
      <div className="text-center"><p className="text-xs text-gray-400 flex items-center justify-center gap-1"><History className="w-3 h-3" /> Historial de cambios: próximamente disponible en detalle de cada acuerdo</p></div>
    </div>
  )
}
