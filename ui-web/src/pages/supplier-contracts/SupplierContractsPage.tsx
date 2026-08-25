import { useState, useEffect, useMemo, useCallback } from "react"
import {
  FileSignature, Percent, ClipboardList, BarChart3, Search, Plus,
  Loader2, CheckCircle2, XCircle, AlertTriangle, Eye, RefreshCw,
  DollarSign, Calendar, User, FileText, TrendingUp, TrendingDown,
  Clock, Zap, Shield, ChevronRight, ChevronDown, Tag, Package,
  ArrowRight, Upload, Download, Filter, Bell, Gauge,
  ShoppingBag, Layers, Repeat, Edit, Trash2, Save, X, Building2,
  KanbanSquare, ArrowUpRight, Target, History, Sparkles, Check
} from "lucide-react"
import { api, type CommercialAgreement } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatCurrency } from "../../utils/format"

type Tab = "dashboard" | "contratos" | "rebates" | "negociaciones" | "cumplimiento"
type NegStatus = "abierta" | "en_curso" | "cerrada_exitosa" | "cerrada_sin_acuerdo"

const daysUntil = (d?: string) => d ? Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000) : null

const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  activo: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900/50" },
  borrador: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" },
  vencido: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-900/50" },
  cancelado: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-900/50" },
  renovado: { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300", border: "border-sky-200 dark:border-sky-900/50" },
  aprobado: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-900/50" },
  pendiente: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-900/50" },
  abierta: { bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-900/50" },
  en_curso: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-900/50" },
  cerrada_exitosa: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900/50" },
  cerrada_sin_acuerdo: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-900/50" },
}

const StatusBadge = ({ s }: { s: string }) => {
  const style = statusStyles[s] || { bg: "bg-gray-100 dark:bg-slate-800", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-slate-700" }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${style.bg} ${style.text} ${style.border}`}>
      {s?.replace(/_/g, " ") || "Borrador"}
    </span>
  )
}

interface AgreementFormData {
  supplier_id: string
  nombre: string
  tipo: string
  fecha_inicio: string
  fecha_fin: string
  condiciones_pago: string
  plazo_pago_dias: number
  moneda: string
  monto_minimo_orden: number | ""
  monto_total_acordado: number | ""
  volumen_minimo_mensual: number | ""
  aplica_rebate: boolean
  tipo_rebate: string
  umbral_rebate_1: number | ""
  porcentaje_rebate_1: number | ""
  exclusividad: boolean
  zona_exclusividad: string
  renovacion_automatica: boolean
  dias_aviso_renovacion: number
  objeto: string
  observaciones: string
  archivo_url: string
  items: Array<{
    id?: string
    product_id: string
    producto_nombre: string
    precio_acordado: number | ""
    descuento_pct: number | ""
    cantidad_minima: number | ""
    bono_pct: number | ""
    lead_time_dias: number | ""
  }>
}

export default function SupplierContractsPage() {
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || (user as any)?.tenant_id || "00000000-0000-0000-0000-000000000010"
  const toast = useToast()

  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [contracts, setContracts] = useState<any[]>([])
  const [rebates, setRebates] = useState<any[]>([])
  const [negotiations, setNegotiations] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  // Filtros
  const [search, setSearch] = useState("")
  const [filterSupplier, setFilterSupplier] = useState("all")
  const [filterTipo, setFilterTipo] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  // Modal Nuevo/Editar Contrato
  const [showForm, setShowForm] = useState(false)
  const [formStep, setFormStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [editingAgreement, setEditingAgreement] = useState<any>(null)
  const [form, setForm] = useState<AgreementFormData>(defaultForm())

  // Modal Negociación
  const [showNegModal, setShowNegModal] = useState(false)
  const [savingNeg, setSavingNeg] = useState(false)
  const [negForm, setNegForm] = useState({
    supplier_id: "", agreement_id: "", fecha: new Date().toISOString().split("T")[0],
    tema: "", resultado: "en_curso", compromisos: "", proxima_reunion: "", observaciones: ""
  })

  // Selector de productos en paso 2
  const [productSearch, setProductSearch] = useState("")
  const [showProductPicker, setShowProductPicker] = useState(false)

  function defaultForm(): AgreementFormData {
    return {
      supplier_id: "", nombre: "", tipo: "compra",
      fecha_inicio: new Date().toISOString().split("T")[0],
      fecha_fin: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
      condiciones_pago: "30 días fecha factura", plazo_pago_dias: 30, moneda: "PYG",
      monto_minimo_orden: "", monto_total_acordado: "", volumen_minimo_mensual: "",
      aplica_rebate: false, tipo_rebate: "anual", umbral_rebate_1: "", porcentaje_rebate_1: "",
      exclusividad: false, zona_exclusividad: "", renovacion_automatica: true,
      dias_aviso_renovacion: 30, objeto: "", observaciones: "", archivo_url: "",
      items: [],
    }
  }

  const fetchAll = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [cRes, pRes, supRes, prodRes, negRes] = await Promise.allSettled([
        api.commercialAgreements.list(companyId),
        api.commercialAgreements.rebates.pending(companyId),
        api.purchases.listSuppliers(),
        api.products.list({ limit: 500 }),
        api.commercialAgreements.negotiations.list(companyId),
      ])

      if (cRes.status === "fulfilled" && Array.isArray(cRes.value)) setContracts(cRes.value)
      if (pRes.status === "fulfilled" && Array.isArray(pRes.value)) setRebates(pRes.value)
      if (supRes.status === "fulfilled" && Array.isArray(supRes.value)) setSuppliers(supRes.value)
      if (prodRes.status === "fulfilled" && Array.isArray(prodRes.value)) setProducts(prodRes.value)
      if (negRes.status === "fulfilled" && Array.isArray(negRes.value)) setNegotiations(negRes.value)
    } catch (e: any) {
      toast.error("Error al cargar contratos", e.message)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Analytics calculados
  const analytics = useMemo(() => {
    const activos = contracts.filter(c => c.estado === "activo" || c.activo)
    const porVencer = contracts.filter(c => {
      const days = daysUntil(c.fecha_fin)
      return (c.estado === "activo" || c.activo) && days !== null && days <= 30 && days > 0
    })
    const vencidos = contracts.filter(c => c.estado === "vencido" || ((c.estado === "activo" || c.activo) && daysUntil(c.fecha_fin) !== null && daysUntil(c.fecha_fin)! <= 0))
    const totalMonto = activos.reduce((s, c) => s + (Number(c.monto_total_acordado || c.limite_credito || 0)), 0)
    const totalEjecutado = activos.reduce((s, c) => s + (Number(c.monto_ejecutado || 0)), 0)
    const cumplimientoGlobal = totalMonto > 0 ? Math.round((totalEjecutado / totalMonto) * 100) : 0
    const rebatesPendientes = rebates.filter((r: any) => r.estado === "pendiente").length
    const rebatesMonto = rebates.filter((r: any) => r.estado === "pendiente").reduce((s: number, r: any) => s + (Number(r.valor_rebate || r.monto || 0)), 0)
    const proveedoresConContrato = new Set(contracts.map(c => c.supplier_id)).size

    return {
      activos: activos.length,
      porVencer: porVencer.length,
      vencidos: vencidos.length,
      totalMonto,
      totalEjecutado,
      cumplimientoGlobal,
      rebatesPendientes,
      rebatesMonto,
      proveedoresConContrato
    }
  }, [contracts, rebates])

  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {}
    suppliers.forEach((s: any) => { map[s.id] = s.razon_social || s.nombre_fantasia || s.nombre || s.ruc })
    return map
  }, [suppliers])

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const matchesSearch = !search ||
        (c.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
        (supplierMap[c.supplier_id] || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.objeto || "").toLowerCase().includes(search.toLowerCase())

      const matchesSupplier = filterSupplier === "all" || c.supplier_id === filterSupplier
      const matchesTipo = filterTipo === "all" || c.tipo === filterTipo
      const matchesStatus = filterStatus === "all" || c.estado === filterStatus

      return matchesSearch && matchesSupplier && matchesTipo && matchesStatus
    })
  }, [contracts, search, filterSupplier, filterTipo, filterStatus, supplierMap])

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 30)
    const s = productSearch.toLowerCase()
    return products.filter((p: any) =>
      (p.nombre || "").toLowerCase().includes(s) ||
      (p.sku || "").toLowerCase().includes(s)
    ).slice(0, 50)
  }, [products, productSearch])

  // Acciones de ciclo de vida de contrato
  const handleApprove = async (id: string) => {
    try {
      await api.commercialAgreements.approve(id, user?.id || "")
      toast.success("Contrato Aprobado", "El acuerdo comercial fue ratificado.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al aprobar", e.message)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await api.commercialAgreements.activate(id)
      toast.success("Contrato Activado", "Las condiciones comerciales entraron en vigencia.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al activar", e.message)
    }
  }

  const handleRenew = async (id: string) => {
    try {
      await api.commercialAgreements.renew(id)
      toast.success("Contrato Renovado", "Se extendió la vigencia por un nuevo período.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al renovar", e.message)
    }
  }

  const handleCancel = async (id: string) => {
    const motivo = prompt("Ingresá el motivo de la rescisión o cancelación:")
    if (!motivo) return
    try {
      await api.commercialAgreements.cancel(id, motivo)
      toast.success("Contrato Rescindido", "El acuerdo fue dado de baja.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al cancelar", e.message)
    }
  }

  const handleLiquidateRebate = async (rebateId: string) => {
    try {
      await api.commercialAgreements.rebates.liquidate(rebateId, user?.id || "")
      toast.success("Rebate Liquidado", "Se acreditó el bono por volumen a la cuenta corriente del proveedor.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al liquidar rebate", e.message)
    }
  }

  const handleSaveNegotiation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!negForm.supplier_id) { toast.error("Seleccioná un proveedor", ""); return }
    setSavingNeg(true)
    try {
      await api.commercialAgreements.negotiations.create({
        ...negForm,
        company_id: companyId,
      })
      toast.success("Minuta de Negociación Guardada", "El registro quedó asentado en el historial comercial.")
      setShowNegModal(false)
      setNegForm({ supplier_id: "", agreement_id: "", fecha: new Date().toISOString().split("T")[0], tema: "", resultado: "en_curso", compromisos: "", proxima_reunion: "", observaciones: "" })
      fetchAll()
    } catch (err: any) {
      toast.error("Error al registrar negociación", err.message)
    } finally {
      setSavingNeg(false)
    }
  }

  const handleSaveAgreement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.supplier_id) { toast.error("Seleccioná un proveedor", ""); setFormStep(1); return }
    if (!form.nombre) { toast.error("Ingresá un nombre para el acuerdo", ""); setFormStep(1); return }

    setSaving(true)
    try {
      const payload: any = {
        ...form,
        company_id: companyId,
        monto_total_acordado: form.monto_total_acordado ? Number(form.monto_total_acordado) : undefined,
        monto_minimo_orden: form.monto_minimo_orden ? Number(form.monto_minimo_orden) : undefined,
        volumen_minimo_mensual: form.volumen_minimo_mensual ? Number(form.volumen_minimo_mensual) : undefined,
        umbral_rebate_1: form.umbral_rebate_1 ? Number(form.umbral_rebate_1) : undefined,
        porcentaje_rebate_1: form.porcentaje_rebate_1 ? Number(form.porcentaje_rebate_1) : undefined,
        estado: "borrador",
        activo: true,
      }

      if (editingAgreement?.id) {
        await api.commercialAgreements.update(editingAgreement.id, payload)
        toast.success("Acuerdo Actualizado", "Los cambios fueron guardados exitosamente.")
      } else {
        await api.commercialAgreements.create(payload)
        toast.success("Acuerdo Comercial Creado", "El contrato quedó registrado en estado borrador.")
      }

      setShowForm(false)
      setEditingAgreement(null)
      setForm(defaultForm())
      setFormStep(1)
      fetchAll()
    } catch (err: any) {
      toast.error("Error al guardar contrato", err.message)
    } finally {
      setSaving(false)
    }
  }

  const addProductToForm = (prod: any) => {
    if (form.items.some(i => i.product_id === prod.id)) {
      toast.error("El producto ya está en el acuerdo", "")
      return
    }
    setForm(f => ({
      ...f,
      items: [
        ...f.items,
        {
          product_id: prod.id,
          producto_nombre: prod.nombre,
          precio_acordado: prod.precio_costo || "",
          descuento_pct: 0,
          cantidad_minima: 1,
          bono_pct: 0,
          lead_time_dias: 3,
        }
      ]
    }))
    setShowProductPicker(false)
  }

  const removeProductFromForm = (idx: number) => {
    setForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx)
    }))
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">
              Contratos & Acuerdos con Proveedores
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 uppercase">
              Negociaciones B2B & Rebates
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Gestión integral de condiciones comerciales pactadas con proveedores: acuerdos marco de precios, escalas de rebate por volumen de compra, cláusulas de exclusividad, alertas de renovación y actas de negociación.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchAll} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /><span>Actualizar</span>
          </button>
          <button onClick={() => setShowNegModal(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/50">
            <KanbanSquare className="w-3.5 h-3.5" /><span>Nueva Negociación</span>
          </button>
          <button onClick={() => { setEditingAgreement(null); setForm(defaultForm()); setFormStep(1); setShowForm(true) }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /><span>Nuevo Acuerdo Comercial</span>
          </button>
        </div>
      </div>

      {/* BANNER EXPLICATIVO */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-900/40 flex items-start gap-3 text-xs text-violet-900 dark:text-violet-300">
        <Sparkles className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-violet-950 dark:text-violet-200 mb-0.5">
            Control de Rentabilidad en Compras & Retornos por Volumen (Rebates)
          </p>
          <p className="text-violet-800 dark:text-violet-400 leading-relaxed">
            Cada acuerdo comercial define las reglas del juego con tus proveedores: lista de precios congelados por contrato, plazos de pago preferenciales, umbrales de compra para cobro de rebates anuales o semestrales y penalizaciones por quiebre de stock. El sistema audita automáticamente si las órdenes de compra emitidas cumplen los precios y volúmenes pactados.
          </p>
        </div>
      </div>

      {/* KPIs EJECUTIVOS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Contratos Vigentes", val: analytics.activos, color: "text-emerald-600", icon: CheckCircle2 },
          { label: "Por Vencer (< 30d)", val: analytics.porVencer, color: analytics.porVencer > 0 ? "text-amber-600" : "text-gray-500", icon: AlertTriangle },
          { label: "Vencidos", val: analytics.vencidos, color: analytics.vencidos > 0 ? "text-red-600" : "text-gray-500", icon: XCircle },
          { label: "Proveedores c/ Acuerdo", val: `${analytics.proveedoresConContrato} / ${suppliers.length}`, color: "text-blue-600", icon: Building2 },
          { label: "Rebates Acumulados", val: formatPYG(analytics.rebatesMonto), color: "text-purple-600", icon: DollarSign },
          { label: "Cumplimiento Metas", val: `${analytics.cumplimientoGlobal}%`, color: "text-indigo-600", icon: Target },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className={`text-base font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard", label: "Resumen Ejecutivo" },
            { id: "contratos", label: `Acuerdos Vigentes (${contracts.length})` },
            { id: "rebates", label: `Rebates & Retornos (${rebates.length})` },
            { id: "negociaciones", label: `Minutas & Negociación (${negotiations.length})` },
            { id: "cumplimiento", label: "Metas de Volumen" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-purple-600 text-purple-600 dark:text-purple-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB DASHBOARD */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Acuerdos Próximos a Vencer */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" /> Alertas de Renovación & Vencimiento
            </h3>
            {contracts.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin contratos comerciales registrados.</p>
                <p className="mt-1">Creá tu primer acuerdo con un proveedor estratégico.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {contracts.slice(0, 5).map((c: any) => {
                  const days = daysUntil(c.fecha_fin)
                  const esUrgente = days !== null && days <= 30
                  return (
                    <div key={c.id} className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-gray-900 dark:text-white">{c.nombre}</p>
                          <StatusBadge s={c.estado || "activo"} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{supplierMap[c.supplier_id] || "Proveedor"} · Plazo pago: {c.plazo_pago_dias || 30} días</p>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-bold ${esUrgente ? "text-amber-600" : "text-gray-500"}`}>
                          {days !== null ? (days > 0 ? `${days} días rest.` : "Vencido") : "Sin fecha"}
                        </span>
                        <p className="text-[10px] text-gray-400">{c.fecha_fin ? formatDate(c.fecha_fin) : "—"}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Rebates Pendientes de Liquidación */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-600" /> Rebates Ganados por Compras Acumuladas
            </h3>
            {rebates.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin rebates pendientes de liquidación.</p>
                <p className="mt-1">Los bonos por escala de compra se calculan al alcanzar las metas.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {rebates.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-purple-950 dark:text-purple-200">{r.proveedor_nombre || supplierMap[r.supplier_id] || "Proveedor"}</p>
                      <p className="text-[10px] text-purple-700 dark:text-purple-400">Período: {r.periodo || "2026"} · Meta: {formatPYG(r.volumen_objetivo || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black font-mono text-purple-700 dark:text-purple-300">{formatPYG(r.valor_rebate || r.monto || 0)}</p>
                      <button onClick={() => handleLiquidateRebate(r.id)} className="mt-1 px-2 py-0.5 bg-purple-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-purple-700 transition">
                        Liquidar Bono
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTRATOS */}
      {tab === "contratos" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 flex-wrap text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contrato, proveedor u objeto..." className="input text-xs pl-8 w-full" />
            </div>
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="input text-xs w-auto">
              <option value="all">Todos los Proveedores</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre}</option>)}
            </select>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="input text-xs w-auto">
              <option value="all">Todos los Tipos</option>
              <option value="compra">Compra General</option>
              <option value="descuento_volumen">Descuento por Volumen</option>
              <option value="rebate">Rebate Escalonado</option>
              <option value="exclusividad">Exclusividad</option>
              <option value="precio_especial">Precio Especial</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input text-xs w-auto">
              <option value="all">Todos los Estados</option>
              <option value="activo">Activo</option>
              <option value="borrador">Borrador</option>
              <option value="aprobado">Aprobado</option>
              <option value="vencido">Vencido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Tabla de Contratos */}
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando contratos comerciales...
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <FileSignature className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No se encontraron acuerdos comerciales</p>
                <p className="mt-1 max-w-xs mx-auto">Creá un acuerdo comercial para formalizar listas de precios, plazos de pago y bonificaciones por escala con tus proveedores.</p>
                <button onClick={() => { setEditingAgreement(null); setForm(defaultForm()); setFormStep(1); setShowForm(true) }} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Nuevo Acuerdo
                </button>
              </div>
            ) : (
              <table className="w-full text-xs min-w-[750px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 text-left">Acuerdo / Proveedor</th>
                    <th className="p-3.5 text-left">Tipo & Moneda</th>
                    <th className="p-3.5 text-left">Vigencia</th>
                    <th className="p-3.5 text-right">Monto Comprometido</th>
                    <th className="p-3.5 text-center">Rebate</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {filteredContracts.map((c: any) => (
                    <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <p className="font-extrabold text-gray-900 dark:text-white">{c.nombre}</p>
                        <p className="text-[10px] text-gray-400">{supplierMap[c.supplier_id] || "Proveedor Registrado"}</p>
                        {c.exclusividad && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded">
                            Exclusividad {c.zona_exclusividad ? `(${c.zona_exclusividad})` : ""}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-gray-800 dark:text-gray-200 uppercase">{c.tipo || "Compra"}</p>
                        <p className="text-[10px] text-gray-400">{c.moneda || "PYG"} · {c.plazo_pago_dias || 30}d plazo</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-mono text-gray-800 dark:text-gray-200">{c.fecha_inicio ? formatDate(c.fecha_inicio) : "—"} al {c.fecha_fin ? formatDate(c.fecha_fin) : "—"}</p>
                        <p className="text-[10px] text-gray-400">{c.renovacion_automatica ? "Renovación automática" : "Sin renovación"}</p>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                        {c.monto_total_acordado ? formatCurrency(c.monto_total_acordado, c.moneda) : "Abierto"}
                      </td>
                      <td className="p-3.5 text-center">
                        {c.aplica_rebate || c.porcentaje_rebate_1 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-purple-700 bg-purple-50 dark:bg-purple-950/40">
                            {c.porcentaje_rebate_1 ? `${c.porcentaje_rebate_1}%` : "Aplica"}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="p-3.5 text-center">
                        <StatusBadge s={c.estado || "activo"} />
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.estado === "borrador" && (
                            <button onClick={() => handleApprove(c.id)} className="btn-secondary text-[10px] px-2 py-1 text-blue-600 border-blue-200 hover:bg-blue-50">
                              Aprobar
                            </button>
                          )}
                          {c.estado === "aprobado" && (
                            <button onClick={() => handleActivate(c.id)} className="btn-primary text-[10px] px-2 py-1 bg-emerald-600 hover:bg-emerald-700">
                              Activar
                            </button>
                          )}
                          {c.estado === "activo" && (
                            <button onClick={() => handleRenew(c.id)} className="btn-secondary text-[10px] px-2 py-1 text-sky-600 border-sky-200 hover:bg-sky-50">
                              Renovar
                            </button>
                          )}
                          {c.estado === "activo" && (
                            <button onClick={() => handleCancel(c.id)} className="btn-secondary text-[10px] px-2 py-1 text-red-600 border-red-200 hover:bg-red-50">
                              Rescindir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB REBATES */}
      {tab === "rebates" && (
        <div className="space-y-4">
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <Percent className="w-4 h-4 text-purple-600" /> Liquidación de Bonos por Volumen
              </h3>
            </div>
            {rebates.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin rebates pendientes</p>
                <p className="mt-1">Al cumplirse los períodos de evaluación pactados en los contratos, los rebates calculados aparecerán aquí para su liquidación.</p>
              </div>
            ) : (
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 text-left">Proveedor</th>
                    <th className="p-3.5 text-left">Período</th>
                    <th className="p-3.5 text-right">Volumen Objetivo</th>
                    <th className="p-3.5 text-right">Volumen Alcanzado</th>
                    <th className="p-3.5 text-right">Rebate Ganado</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {rebates.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-extrabold text-gray-900 dark:text-white">{r.proveedor_nombre || supplierMap[r.supplier_id] || "Proveedor"}</td>
                      <td className="p-3.5 text-gray-500 font-mono">{r.periodo || "2026"}</td>
                      <td className="p-3.5 text-right font-mono">{formatPYG(r.volumen_objetivo || 0)}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-blue-600">{formatPYG(r.volumen_alcanzado || 0)}</td>
                      <td className="p-3.5 text-right font-mono font-black text-purple-600">{formatPYG(r.valor_rebate || r.monto || 0)}</td>
                      <td className="p-3.5 text-center"><StatusBadge s={r.estado || "pendiente"} /></td>
                      <td className="p-3.5 text-right">
                        <button onClick={() => handleLiquidateRebate(r.id)} className="btn-primary text-[10px] px-3 py-1 bg-purple-600 hover:bg-purple-700">
                          Liquidar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB NEGOCIACIONES */}
      {tab === "negociaciones" && (
        <div className="space-y-4">
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <KanbanSquare className="w-4 h-4 text-violet-600" /> Bitácora de Minutas & Reuniones Comerciales
              </h3>
              <button onClick={() => setShowNegModal(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nueva Minuta
              </button>
            </div>
            {negotiations.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <KanbanSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin negociaciones asentadas</p>
                <p className="mt-1 max-w-xs mx-auto">Registrá las minutas de reuniones, acuerdos verbales, compromisos de entrega y revisiones de precios con proveedores.</p>
                <button onClick={() => setShowNegModal(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Asentar Primera Minuta
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {negotiations.map((n: any) => (
                  <div key={n.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-sm text-gray-900 dark:text-white">{n.tema || "Reunión Comercial"}</p>
                        <StatusBadge s={n.resultado || n.estado || "en_curso"} />
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 font-bold">{supplierMap[n.supplier_id] || "Proveedor"}</p>
                      {n.compromisos && <p className="text-gray-500 mt-1 bg-gray-50 dark:bg-slate-800 p-2 rounded-xl border border-gray-100 dark:border-slate-700"><span className="font-bold">Compromisos:</span> {n.compromisos}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-gray-500">{n.fecha ? formatDate(n.fecha) : "—"}</p>
                      {n.proxima_reunion && <p className="text-[10px] text-purple-600 font-bold mt-1">Próx: {formatDate(n.proxima_reunion)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CUMPLIMIENTO */}
      {tab === "cumplimiento" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" /> Monitoreo de Cumplimiento de Metas por Contrato
            </h3>
          </div>
          {contracts.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin datos de cumplimiento</p>
              <p className="mt-1">Asociá metas de volumen mensual en tus contratos para ver la barra de progreso en vivo.</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {contracts.map((c: any) => {
                const target = Number(c.monto_total_acordado || c.volumen_minimo_mensual || 1)
                const actual = Number(c.monto_ejecutado || 0)
                const pct = Math.min(Math.round((actual / target) * 100), 100)
                return (
                  <div key={c.id} className="p-4 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-gray-900 dark:text-white">{c.nombre}</p>
                        <p className="text-[10px] text-gray-400">{supplierMap[c.supplier_id] || "Proveedor"}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{pct}% cumplido</span>
                        <p className="text-[10px] text-gray-400">{formatPYG(actual)} de {formatPYG(target)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL MULTI-PASO: NUEVO ACUERDO COMERCIAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">
                  {editingAgreement ? "Editar Acuerdo Comercial" : "Nuevo Acuerdo Comercial B2B"}
                </h2>
                <p className="text-[11px] text-gray-500">Paso {formStep} de 4</p>
              </div>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-1">
              {["1. Condiciones", "2. Productos", "3. Rebates", "4. Revisión"].map((st, i) => (
                <button key={st} onClick={() => setFormStep(i + 1)}
                  className={`flex-1 py-1.5 rounded-lg text-center font-bold text-[10px] uppercase transition ${formStep === i + 1 ? "bg-purple-600 text-white" : formStep > i + 1 ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" : "bg-gray-100 text-gray-400 dark:bg-slate-800"}`}>
                  {st}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveAgreement} className="space-y-4 text-xs">
              {/* PASO 1: CONDICIONES GENERALES */}
              {formStep === 1 && (
                <div className="space-y-3">
                  <div>
                    <label className="label-sm">Proveedor Registrado *</label>
                    <select required className="input text-xs" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                      <option value="">Seleccionar proveedor...</option>
                      {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre} ({s.ruc})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-sm">Nombre del Acuerdo *</label>
                    <input required className="input text-xs" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Acuerdo Anual Lácteos Trebol 2026" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-sm">Tipo de Acuerdo</label>
                      <select className="input text-xs" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                        <option value="compra">Compra General</option>
                        <option value="descuento_volumen">Descuento por Volumen</option>
                        <option value="rebate">Rebate Escalonado</option>
                        <option value="exclusividad">Exclusividad de Marca</option>
                        <option value="precio_especial">Precio Especial / Promoción</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-sm">Moneda</label>
                      <select className="input text-xs" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                        <option value="PYG">Guaraníes (Gs.)</option>
                        <option value="USD">Dólares (USD $)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-sm">Fecha Inicio *</label>
                      <input type="date" required className="input text-xs" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-sm">Fecha Fin *</label>
                      <input type="date" required className="input text-xs" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-sm">Plazo de Pago (días)</label>
                      <input type="number" className="input text-xs" value={form.plazo_pago_dias} onChange={e => setForm(f => ({ ...f, plazo_pago_dias: parseInt(e.target.value) || 30 }))} />
                    </div>
                    <div>
                      <label className="label-sm">Monto Total Comprometido</label>
                      <input type="number" className="input text-xs" value={form.monto_total_acordado} onChange={e => setForm(f => ({ ...f, monto_total_acordado: e.target.value ? parseFloat(e.target.value) : "" }))} placeholder="Ej: 500000000" />
                    </div>
                  </div>
                  <div>
                    <label className="label-sm">Objeto y Cláusulas Especiales</label>
                    <textarea className="input text-xs h-14" value={form.objeto} onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))} placeholder="Detalle de condiciones de entrega, devoluciones y plazos..." />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">Renovación Automática</p>
                      <p className="text-[10px] text-gray-400">Extender contrato al vencer si no hay aviso previo</p>
                    </div>
                    <input type="checkbox" checked={form.renovacion_automatica} onChange={e => setForm(f => ({ ...f, renovacion_automatica: e.target.checked }))} className="w-4 h-4 accent-purple-600" />
                  </div>
                </div>
              )}

              {/* PASO 2: PRODUCTOS & PRECIOS PACTADOS */}
              {formStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900 dark:text-white">Productos con Precio Congelado</p>
                    <button type="button" onClick={() => setShowProductPicker(true)} className="btn-secondary text-[10px] px-2.5 py-1 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Agregar Producto
                    </button>
                  </div>

                  {showProductPicker && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-2xl space-y-2">
                      <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Buscar por SKU o nombre..." className="input text-xs w-full" autoFocus />
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {filteredProducts.map((p: any) => (
                          <div key={p.id} onClick={() => addProductToForm(p)} className="p-2 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-between cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition text-xs">
                            <span className="font-bold text-gray-800 dark:text-gray-200">{p.nombre}</span>
                            <span className="font-mono text-gray-400">{p.sku}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.items.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-xs card bg-gray-50 dark:bg-slate-800 rounded-2xl">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Sin productos asignados aún.</p>
                      <p className="mt-1">Agregá productos para fijar listas de precios pactadas.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {form.items.map((item, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 dark:text-white">{item.producto_nombre}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="text-[9px] text-gray-400 block">Precio Gs.</span>
                              <input type="number" className="input text-xs w-24 py-1" value={item.precio_acordado} onChange={e => {
                                const val = parseFloat(e.target.value) || 0
                                setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, precio_acordado: val } : it) }))
                              }} />
                            </div>
                            <div>
                              <span className="text-[9px] text-gray-400 block">Desc %</span>
                              <input type="number" className="input text-xs w-16 py-1" value={item.descuento_pct} onChange={e => {
                                const val = parseFloat(e.target.value) || 0
                                setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, descuento_pct: val } : it) }))
                              }} />
                            </div>
                            <button type="button" onClick={() => removeProductFromForm(idx)} className="text-red-500 hover:text-red-700 p-1 mt-3">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PASO 3: REBATES & ESCALAS */}
              {formStep === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-2xl">
                    <div>
                      <p className="font-bold text-purple-950 dark:text-purple-200">Habilitar Esquema de Rebates</p>
                      <p className="text-[10px] text-purple-700 dark:text-purple-400">Devolución porcentual por cumplimiento de volumen de compra</p>
                    </div>
                    <input type="checkbox" checked={form.aplica_rebate} onChange={e => setForm(f => ({ ...f, aplica_rebate: e.target.checked }))} className="w-4 h-4 accent-purple-600" />
                  </div>

                  {form.aplica_rebate && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                      <div>
                        <label className="label-sm">Frecuencia de Evaluación</label>
                        <select className="input text-xs" value={form.tipo_rebate} onChange={e => setForm(f => ({ ...f, tipo_rebate: e.target.value }))}>
                          <option value="mensual">Mensual</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="semestral">Semestral</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                      <div>
                        <label className="label-sm">Porcentaje de Rebate (%)</label>
                        <input type="number" step="0.1" className="input text-xs" value={form.porcentaje_rebate_1} onChange={e => setForm(f => ({ ...f, porcentaje_rebate_1: e.target.value ? parseFloat(e.target.value) : "" }))} placeholder="Ej: 3.5" />
                      </div>
                      <div className="col-span-2">
                        <label className="label-sm">Umbral de Compra Mínimo (Gs.)</label>
                        <input type="number" className="input text-xs" value={form.umbral_rebate_1} onChange={e => setForm(f => ({ ...f, umbral_rebate_1: e.target.value ? parseFloat(e.target.value) : "" }))} placeholder="Ej: 100000000" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PASO 4: REVISIÓN FINAL */}
              {formStep === 4 && (
                <div className="space-y-3">
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-2xl space-y-2">
                    <p className="font-extrabold text-sm text-purple-950 dark:text-purple-200">{form.nombre}</p>
                    <p className="text-xs text-purple-800 dark:text-purple-300">Proveedor: <b>{supplierMap[form.supplier_id] || "No seleccionado"}</b></p>
                    <p className="text-xs text-purple-800 dark:text-purple-300">Vigencia: {form.fecha_inicio} al {form.fecha_fin}</p>
                    <p className="text-xs text-purple-800 dark:text-purple-300">Plazo Pago: {form.plazo_pago_dias} días ({form.condiciones_pago})</p>
                    <p className="text-xs text-purple-800 dark:text-purple-300">Productos pactados: {form.items.length} items</p>
                    {form.aplica_rebate && <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Rebate activo: {form.porcentaje_rebate_1}% por encima de {formatPYG(Number(form.umbral_rebate_1) || 0)}</p>}
                  </div>
                </div>
              )}

              {/* Controles del Stepper */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
                {formStep > 1 ? (
                  <button type="button" onClick={() => setFormStep(s => s - 1)} className="btn-secondary text-xs px-4 py-2">
                    Atrás
                  </button>
                ) : <div />}

                {formStep < 4 ? (
                  <button type="button" onClick={() => setFormStep(s => s + 1)} className="btn-primary text-xs px-4 py-2 flex items-center gap-1">
                    Siguiente <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button type="submit" disabled={saving} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar Contrato
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA NEGOCIACIÓN */}
      {showNegModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase flex items-center gap-2">
              <KanbanSquare className="w-5 h-5 text-violet-600" /> Asentar Minuta de Negociación
            </h2>
            <form onSubmit={handleSaveNegotiation} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Proveedor *</label>
                <select required className="input text-xs" value={negForm.supplier_id} onChange={e => setNegForm(f => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre} ({s.ruc})</option>)}
                </select>
              </div>
              <div>
                <label className="label-sm">Tema Principal *</label>
                <input required className="input text-xs" value={negForm.tema} onChange={e => setNegForm(f => ({ ...f, tema: e.target.value }))} placeholder="Ej: Negociación de Rebate Trimestral Q3" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Fecha de Reunión</label>
                  <input type="date" className="input text-xs" value={negForm.fecha} onChange={e => setNegForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className="label-sm">Resultado</label>
                  <select className="input text-xs" value={negForm.resultado} onChange={e => setNegForm(f => ({ ...f, resultado: e.target.value }))}>
                    <option value="en_curso">En Curso</option>
                    <option value="cerrada_exitosa">Acuerdo Exitoso</option>
                    <option value="cerrada_sin_acuerdo">Sin Acuerdo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label-sm">Compromisos Acordados</label>
                <textarea className="input text-xs h-16" value={negForm.compromisos} onChange={e => setNegForm(f => ({ ...f, compromisos: e.target.value }))} placeholder="Ej: Proveedor mantiene precio hasta fin de año a cambio de pago a 15 días." />
              </div>
              <div>
                <label className="label-sm">Fecha Próxima Reunión</label>
                <input type="date" className="input text-xs" value={negForm.proxima_reunion} onChange={e => setNegForm(f => ({ ...f, proxima_reunion: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowNegModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingNeg} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700">
                  {savingNeg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar Minuta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
