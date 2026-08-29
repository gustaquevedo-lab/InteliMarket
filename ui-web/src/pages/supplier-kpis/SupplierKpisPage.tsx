import ErrorBoundary from "../../components/ErrorBoundary"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { 
  Percent, Plus, Trash2, Loader2, TrendingUp, CircleCheck, CircleAlert, 
  Search, X, Sparkles, SlidersHorizontal, ArrowUpRight, 
  Layers, Package, CheckCircle2, AlertTriangle, FileText, Download, Edit3, Lock,
  Building2, Calendar, Target, Award, ArrowRight, Bot, Users, Phone, MapPin, 
  ShoppingBag, HelpCircle, Check, Copy, Store, ChevronRight, BarChart3,
  Flame, Filter, CheckCircle, Clock, Save, RefreshCw, Printer, Info, ShieldCheck,
  Zap, Droplet, GlassWater
} from "lucide-react"
import { 
  api, type Supplier, type SupplierKpiPeriod, type SupplierKpiSummary, 
  type SupplierKpiIndicator
} from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatNumber, formatPercentage } from "../../utils/format"

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

const PARESA_ID = "1de9068d-9c27-5557-b142-710b227dc153"

interface TramoEscala {
  min_pct: number
  rebate_pct: number
  monto_fijo_gs?: number
}

interface AgreementItem {
  id: string
  supplier_id: string
  supplier_razon_social: string
  supplier_ruc?: string
  periodo: string
  nombre_acuerdo?: string
  meta_monto_gs: number
  tipo_meta: string
  tipo_retorno: string
  rebate_pct_base: number
  piso_minimo_pct: number
  tramos_escala: TramoEscala[]
  ventas_actual_gs: number
  transacciones_count: number
  skus_vendidos_count: number
  cumplimiento_actual_pct: number
  tendencia_proyectada_gs: number
  cumplimiento_proyectado_pct: number
  rebate_ganado_actual_pct: number
  rebate_ganado_actual_gs: number
  rebate_ganado_proy_pct: number
  rebate_ganado_proy_gs: number
  semaforo: "superado" | "en_meta" | "en_riesgo" | "critico"
  observaciones?: string
  estado: string
}

interface MultiSupplierDashboard {
  periodo: string
  dias_transcurridos: number
  dias_totales_mes: number
  meta_total_general_gs: number
  ventas_total_general_gs: number
  cumplimiento_global_pct: number
  tendencia_global_gs: number
  cumplimiento_proyectado_global_pct: number
  rebate_total_estimado_gs: number
  proveedores: AgreementItem[]
}

export default function SupplierKpisPage() {
  const { user } = useAuth()
  const toast = useToast()

  // Main Tab Navigation: "general" (Multiproveedor) vs "paresa" (Especial Coca-Cola)
  const [activeMainTab, setActiveMainTab] = useState<"general" | "paresa">("general")
  const [mes, setMes] = useState(currentMonthStr())
  const [selectedBranch, setSelectedBranch] = useState<string>("all")

  // ─── TAB 1: ESTADOS GENERAL MULTIPROVEEDOR ───
  const [multiDashboard, setMultiDashboard] = useState<MultiSupplierDashboard | null>(null)
  const [loadingGeneral, setLoadingGeneral] = useState(false)
  const [generalSearch, setGeneralSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  // Modal Edición Acuerdo General
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AgreementItem | null>(null)
  const [editMetaGs, setEditMetaGs] = useState<number>(0)
  const [editPisoPct, setEditPisoPct] = useState<number>(80)
  const [editTramos, setEditTramos] = useState<TramoEscala[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  // ─── TAB 2: ESTADOS PARESA ───
  const [supplierId, setSupplierId] = useState<string>(PARESA_ID)
  const [periods, setPeriods] = useState<SupplierKpiPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [summary, setSummary] = useState<SupplierKpiSummary | null>(null)
  const [loadingParesa, setLoadingParesa] = useState(false)

  // Modals PARESA
  const [modalOpen, setModalOpen] = useState(false)
  const [liquidationModalOpen, setLiquidationModalOpen] = useState(false)
  const [savingTargets, setSavingTargets] = useState(false)

  // Tooltip helper state
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  // Edit Targets Local State PARESA
  const [editRebateObjetivo, setEditRebateObjetivo] = useState<number>(4.5)
  const [editObservaciones, setEditObservaciones] = useState<string>("")
  const [editIndicators, setEditIndicators] = useState<{
    id: string
    codigo: string
    nombre: string
    categoria: string
    segmento_paresa?: string
    peso_pct: number
    meta_uc: number
    resultado_uc: number
    es_foco: boolean
    descripcion_skus?: string
    reglas_escala?: any
  }[]>([])

  // ─── CARGA DE DATOS GENERAL MULTIPROVEEDOR ───
  const loadGeneralDashboard = useCallback(async () => {
    setLoadingGeneral(true)
    try {
      const res = await api.supplierRebates.getDashboard(mes, selectedBranch)
      if (res && res.proveedores) {
        setMultiDashboard(res)
      }
    } catch (e: any) {
      console.error("Error loading multi-supplier dashboard:", e)
    } finally {
      setLoadingGeneral(false)
    }
  }, [mes, selectedBranch])

  // ─── CARGA DE DATOS PARESA ───
  const loadParesaSummary = useCallback(async (periodId: string) => {
    if (!periodId) return
    setLoadingParesa(true)
    try {
      const s = await api.supplierKpis.getSummary(periodId, selectedBranch)
      if (s) {
        setSummary(s)
      }
    } catch (e: any) {
      console.error("Error loading PARESA summary:", e)
    } finally {
      setLoadingParesa(false)
    }
  }, [selectedBranch])

  const loadParesaPeriods = useCallback(async () => {
    setLoadingParesa(true)
    try {
      const list = await api.supplierKpis.listPeriods(PARESA_ID)
      if (Array.isArray(list) && list.length > 0) {
        setPeriods(list)
        const currentPeriod = list.find(p => p.periodo.startsWith(mes)) || list[0]
        setSelectedPeriodId(currentPeriod.id)
        await loadParesaSummary(currentPeriod.id)
      }
    } catch (e: any) {
      console.error("Error loading PARESA periods:", e)
    } finally {
      setLoadingParesa(false)
    }
  }, [mes, loadParesaSummary])

  useEffect(() => {
    if (activeMainTab === "general") {
      loadGeneralDashboard()
    }
  }, [activeMainTab, loadGeneralDashboard])

  useEffect(() => {
    if (activeMainTab === "paresa") {
      if (selectedPeriodId) {
        loadParesaSummary(selectedPeriodId)
      } else {
        loadParesaPeriods()
      }
    }
  }, [activeMainTab, selectedPeriodId, loadParesaSummary, loadParesaPeriods])

  // ─── ABRIR MODAL EDICIÓN ACUERDO MULTIPROVEEDOR ───
  const handleOpenEditAgreement = (item: AgreementItem) => {
    setEditingItem(item)
    setEditMetaGs(Number(item.meta_monto_gs))
    setEditPisoPct(Number(item.piso_minimo_pct || 80))
    setEditTramos(item.tramos_escala && item.tramos_escala.length > 0 ? item.tramos_escala : [
      { min_pct: 80, rebate_pct: 1.0 },
      { min_pct: 100, rebate_pct: 2.5 },
      { min_pct: 110, rebate_pct: 3.5 }
    ])
    setEditModalOpen(true)
  }

  const handleAddTramo = () => {
    setEditTramos(prev => [...prev, { min_pct: 100, rebate_pct: 2.0 }])
  }

  const handleRemoveTramo = (idx: number) => {
    setEditTramos(prev => prev.filter((_, i) => i !== idx))
  }

  const handleUpdateTramo = (idx: number, field: keyof TramoEscala, val: number) => {
    setEditTramos(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t))
  }

  const handleSaveAgreement = async () => {
    if (!editingItem) return
    setSavingEdit(true)
    try {
      await (api as any).supplierRebates.updateAgreement(editingItem.id, {
        meta_monto_gs: editMetaGs,
        piso_minimo_pct: editPisoPct,
        tramos_escala: editTramos
      })
      toast.success(`Metas de ${editingItem.supplier_razon_social} actualizadas`)
      setEditModalOpen(false)
      loadGeneralDashboard()
    } catch (e: any) {
      console.error(e)
      toast.error("No se pudo guardar la meta del proveedor", e)
    } finally {
      setSavingEdit(false)
    }
  }

  // ─── FILTRADO TABLA GENERAL ───
  const filteredGeneralList = useMemo(() => {
    if (!multiDashboard?.proveedores) return []
    return multiDashboard.proveedores.filter(p => {
      const matchText = p.supplier_razon_social.toLowerCase().includes(generalSearch.toLowerCase()) ||
                        (p.supplier_ruc && p.supplier_ruc.includes(generalSearch))
      if (!matchText) return false
      if (statusFilter === "superado") return p.semaforo === "superado"
      if (statusFilter === "en_meta") return p.semaforo === "en_meta"
      if (statusFilter === "en_riesgo") return p.semaforo === "en_riesgo"
      if (statusFilter === "critico") return p.semaforo === "critico"
      return true
    })
  }, [multiDashboard, generalSearch, statusFilter])

  // ─── EXPORTACIÓN A CSV ───
  const handleExportCSV = () => {
    if (!multiDashboard?.proveedores) return
    const headers = ["Proveedor", "RUC", "Objetivo Gs", "Ventas Actuales Gs", "% Cumplimiento Actual", "Tendencia Gs", "% Cumplimiento Proyectado", "% Rebate Estimado", "Monto Rebate Estimado Gs", "Estado"]
    const rows = multiDashboard.proveedores.map(p => [
      `"${p.supplier_razon_social}"`,
      `"${p.supplier_ruc || ''}"`,
      p.meta_monto_gs,
      p.ventas_actual_gs,
      `${p.cumplimiento_actual_pct}%`,
      p.tendencia_proyectada_gs,
      `${p.cumplimiento_proyectado_pct}%`,
      `${p.rebate_ganado_proy_pct}%`,
      p.rebate_ganado_proy_gs,
      p.semaforo.toUpperCase()
    ])
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Metas_Proveedores_Casa_Gonzalito_${mes}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Planilla exportada con éxito")
  }

  // ─── PARESA HANDLERS ───
  const handleOpenEditTargets = () => {
    if (!summary) return
    setEditRebateObjetivo(Number(summary.period.rebate_pct_objetivo || 4.5))
    setEditObservaciones(summary.period.observaciones || "")
    setEditIndicators(summary.indicadores.map(ind => ({
      id: ind.id,
      codigo: ind.codigo,
      nombre: ind.nombre,
      categoria: ind.categoria || "volumen",
      segmento_paresa: ind.segmento_paresa || undefined,
      peso_pct: Number(ind.peso_pct || 0),
      meta_uc: Number(ind.meta_uc || ind.meta || 0),
      resultado_uc: Number(ind.resultado_uc || ind.resultado || 0),
      es_foco: ind.es_foco || false,
      descripcion_skus: ind.descripcion_skus || "",
      reglas_escala: ind.reglas_escala
    })))
    setModalOpen(true)
  }

  const handleSaveParesaTargets = async () => {
    if (!summary) return
    setSavingTargets(true)
    try {
      await api.supplierKpis.bulkUpdateIndicators(summary.period.id, {
        rebate_pct_objetivo: editRebateObjetivo,
        observaciones: editObservaciones,
        indicators: editIndicators.map(i => ({
          id: i.id,
          codigo: i.codigo,
          nombre: i.nombre,
          categoria: i.categoria,
          segmento_paresa: i.segmento_paresa,
          unidad_medida: i.categoria === "trade_marketing" ? "pct" : "uc",
          peso_pct: i.peso_pct,
          meta_uc: i.meta_uc,
          resultado_uc: i.resultado_uc,
          es_foco: i.es_foco,
          descripcion_skus: i.descripcion_skus,
          reglas_escala: i.reglas_escala
        }))
      })
      toast.success("Metas y focos de PARESA actualizados con éxito")
      setModalOpen(false)
      loadParesaSummary(summary.period.id)
    } catch (e: any) {
      toast.error("Error al guardar metas de PARESA", e)
    } finally {
      setSavingTargets(false)
    }
  }

  // Grouping PARESA indicators by official category / magnitude
  const paresaVolumeIndicators = useMemo(() => {
    if (!summary) return []
    return summary.indicadores.filter(i => (i.categoria === "volumen" || i.categoria === "sell_in" || i.categoria === "categoria_venta" || i.codigo.startsWith("venta_")) && !i.es_foco && i.codigo !== "total_compra")
  }, [summary])

  const paresaFocusIndicators = useMemo(() => {
    if (!summary) return []
    return summary.indicadores.filter(i => i.es_foco)
  }, [summary])

  const paresaTradeIndicators = useMemo(() => {
    if (!summary) return []
    return summary.indicadores.filter(i => i.categoria === "trade_marketing")
  }, [summary])

  const paresaTotalVolume = useMemo(() => {
    if (!summary) return null
    return summary.indicadores.find(i => i.codigo === "total_compra")
  }, [summary])

  const macroTotals = useMemo(() => {
    const totalPeso = paresaVolumeIndicators.reduce((acc, ind) => acc + Number(ind.peso_pct || 0), 0)
    const totalMeta = paresaVolumeIndicators.reduce((acc, ind) => acc + Number(ind.meta_uc || ind.meta || 0), 0)
    const totalReal = paresaVolumeIndicators.reduce((acc, ind) => acc + Number(ind.resultado_uc || ind.resultado || 0), 0)
    const totalAvancePct = totalMeta > 0 ? ((totalReal / totalMeta) * 100).toFixed(2) : "0.00"
    
    const diasTrans = multiDashboard?.dias_transcurridos || Math.min(new Date().getDate(), 31)
    const diasTot = multiDashboard?.dias_totales_mes || 31
    const totalProy = diasTrans > 0 ? (totalReal / diasTrans) * diasTot : 0
    const totalProyPct = totalMeta > 0 ? ((totalProy / totalMeta) * 100).toFixed(1) : "0.0"
    const totalGap = Math.max(0, totalMeta - totalReal)

    return {
      peso: totalPeso.toFixed(2),
      meta: totalMeta,
      real: totalReal,
      avancePct: totalAvancePct,
      proy: totalProy,
      proyPct: totalProyPct,
      gap: totalGap
    }
  }, [paresaVolumeIndicators, multiDashboard])

  const focusTotals = useMemo(() => {
    const totalMeta = paresaFocusIndicators.reduce((acc, ind) => acc + Number(ind.meta_uc || ind.meta || 0), 0)
    const totalReal = paresaFocusIndicators.reduce((acc, ind) => acc + Number(ind.resultado_uc || ind.resultado || 0), 0)
    const totalAvancePct = totalMeta > 0 ? ((totalReal / totalMeta) * 100).toFixed(2) : "0.00"
    
    const diasTrans = multiDashboard?.dias_transcurridos || Math.min(new Date().getDate(), 31)
    const diasTot = multiDashboard?.dias_totales_mes || 31
    const totalProy = diasTrans > 0 ? (totalReal / diasTrans) * diasTot : 0
    const totalProyPct = totalMeta > 0 ? ((totalProy / totalMeta) * 100).toFixed(1) : "0.0"
    const totalGap = Math.max(0, totalMeta - totalReal)

    return {
      count: paresaFocusIndicators.length,
      meta: totalMeta,
      real: totalReal,
      avancePct: totalAvancePct,
      proy: totalProy,
      proyPct: totalProyPct,
      gap: totalGap
    }
  }, [paresaFocusIndicators, multiDashboard])

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto bg-gray-50/50 dark:bg-slate-950 min-h-screen text-gray-900 dark:text-gray-100">

      {/* ─── BANNER PRINCIPAL CON SELECTOR DE PESTAÑAS ─── */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-7 rounded-3xl shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-inner">
                <Award className="w-3.5 h-3.5 text-amber-400" /> Plan Comercial & Acuerdos de Rebates
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full flex items-center gap-1.5">
                <CircleCheck className="w-3 h-3 text-emerald-400" /> Liquidaciones en Tiempo Real
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Metas de Ventas & Rebates Comerciales
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Monitoreo continuo de cumplimiento de acuerdos comerciales, cálculo de retorno variable (Rebates) y proyección de cierre para todos los proveedores registrados.
            </p>
          </div>

          {/* Selector de Mes y Selector de Pestañas Principales */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Mes Picker */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-2xl shadow-inner">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="month"
                value={mes}
                onChange={e => setMes(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              />
            </div>

            {/* Pestañas Principales */}
            <div className="bg-slate-900/90 border border-slate-700 p-1 rounded-2xl flex items-center gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveMainTab("general")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  activeMainTab === "general"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/40 scale-105"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Store className="w-4 h-4" />
                🏢 Tablero General Multiproveedor
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab("paresa")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  activeMainTab === "paresa"
                    ? "bg-red-600 text-white shadow-md shadow-red-500/40 scale-105"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Award className="w-4 h-4" />
                🔴 Programa Especial PARESA
              </button>
            </div>
          </div>
        </div>

        {/* Selector Territorial de Sucursales y Contexto */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-400 px-2 flex items-center gap-1.5 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              Filtrar Sucursal:
            </span>
            {[
              { id: "all", label: "🏢 Consolidado General", dept: "Amambay + San Pedro" },
              { id: "13bab831-185b-56d7-8c10-74ec2feb9dfb", label: "📍 Casa Central", dept: "Amambay / PJC" },
              { id: "a9a31377-275f-5820-9891-723583b751ed", label: "📍 Sucursal Santa Rosa", dept: "San Pedro" },
              { id: "00fdb863-d8c5-5bb7-aa05-03776a6a2444", label: "📍 Sucursal Capitán Bado", dept: "Amambay" },
            ].map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBranch(b.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  selectedBranch === b.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 ring-2 ring-indigo-400 scale-105"
                    : "bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700/90 border border-slate-700/60"
                }`}
              >
                <span>{b.label}</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-black/30 opacity-80">
                  {b.dept}
                </span>
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            {selectedBranch === "a9a31377-275f-5820-9891-723583b751ed" && (
              <span className="text-amber-300 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                San Pedro • Operación Multimarca (11 proveedores) • Meta ₲ 474M
              </span>
            )}
            {selectedBranch === "13bab831-185b-56d7-8c10-74ec2feb9dfb" && (
              <span className="text-blue-300 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                Amambay • Concesión Exclusiva PARESA + Multimarca Central
              </span>
            )}
            {selectedBranch === "00fdb863-d8c5-5bb7-aa05-03776a6a2444" && (
              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Amambay (Frontera) • Concesión PARESA + Multimarca • Meta ₲ 710M
              </span>
            )}
            {selectedBranch === "all" && (
              <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Consolidado General (Amambay ₲ 7.096M + San Pedro ₲ 474M = Meta ₲ 7.570M)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {/* ─── VISTA 1: TABLERO GENERAL MULTIPROVEEDOR ─── */}
      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === "general" && (
        <ErrorBoundary moduleName="Tablero Multiproveedor" compact onReset={loadGeneralDashboard}>
        <div className="space-y-6">

          {/* 1. MACRO KPI CARDS MULTIPROVEEDOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Meta Consolidada */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                <span>🎯 Meta Global Objetivo</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-black">
                  {multiDashboard?.proveedores?.length ?? 0} Proveedores
                </span>
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-2 font-mono">
                {formatPYG(multiDashboard?.meta_total_general_gs ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Suma de metas pactadas para el mes</p>
            </div>

            {/* Ventas Reales MTD */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                <span>📈 Ventas Reales MTD</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-black">
                  {multiDashboard?.cumplimiento_global_pct || 0}%
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
                {formatPYG(multiDashboard?.ventas_total_general_gs || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Día {multiDashboard?.dias_transcurridos || 15} de {multiDashboard?.dias_totales_mes || 31}</p>
            </div>

            {/* Tendencia Proyectada Fin de Mes */}
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 p-5 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                <span>⚡ Tendencia Cierre</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-black">
                  {multiDashboard?.cumplimiento_proyectado_global_pct || 0}%
                </span>
              </div>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 font-mono">
                {formatPYG(multiDashboard?.tendencia_global_gs || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Proyección lineal al cierre de mes</p>
            </div>

            {/* Rebates Totales Estimados */}
            <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-900/50 p-5 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                <span>💰 Rebates Proyectados</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-black">
                  Retorno Gs
                </span>
              </div>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
                {formatPYG(multiDashboard?.rebate_total_estimado_gs || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">A cobrar según tramos alcanzados</p>
            </div>

          </div>

          {/* 2. TABLA PRINCIPAL Y HERRAMIENTAS */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-gray-200 dark:border-gray-800">
            
            {/* Header de la Tabla: Buscador, Filtros y Acciones */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
              
              {/* Buscador de Proveedor */}
              <div className="relative w-full lg:w-96">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar proveedor por nombre o RUC..."
                  value={generalSearch}
                  onChange={e => setGeneralSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {generalSearch && (
                  <button onClick={() => setGeneralSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtros por Semáforo / Estado */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === "all" ? "bg-indigo-600 text-white shadow" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  Todos ({multiDashboard?.proveedores?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("superado")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === "superado" ? "bg-emerald-600 text-white shadow" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  🚀 Superando ({multiDashboard?.proveedores?.filter(p => p.semaforo === "superado").length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("en_meta")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === "en_meta" ? "bg-blue-600 text-white shadow" : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                  }`}
                >
                  🎯 En Meta ({multiDashboard?.proveedores?.filter(p => p.semaforo === "en_meta").length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("en_riesgo")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === "en_riesgo" ? "bg-amber-600 text-white shadow" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  ⚠️ En Riesgo ({multiDashboard?.proveedores?.filter(p => p.semaforo === "en_riesgo").length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("critico")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === "critico" ? "bg-rose-600 text-white shadow" : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  🔴 Crítico ({multiDashboard?.proveedores?.filter(p => p.semaforo === "critico").length || 0})
                </button>
              </div>

              {/* Botón Exportar CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs font-bold hover:bg-indigo-100 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>

            </div>

            {/* TABLA PRINCIPAL DE PROVEEDORES */}
            {loadingGeneral ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm font-semibold">Calculando avance de metas y proyección de rebates...</p>
              </div>
            ) : filteredGeneralList.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold">No se encontraron proveedores para los filtros seleccionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 dark:bg-slate-800/60 uppercase font-black text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="py-3.5 px-4">Proveedores</th>
                      <th className="py-3.5 px-4 text-right">Objetivo (Gs)</th>
                      <th className="py-3.5 px-4 text-right">Ventas (Gs)</th>
                      <th className="py-3.5 px-4 text-center">% Actual</th>
                      <th className="py-3.5 px-4 text-right">Tendencia (Gs)</th>
                      <th className="py-3.5 px-4 text-center">% Proy.</th>
                      <th className="py-3.5 px-4 text-center">Rebate Est.</th>
                      <th className="py-3.5 px-4 text-center">Estado</th>
                      <th className="py-3.5 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredGeneralList.map((p, idx) => (
                      <tr 
                        key={p.id || idx}
                        className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Proveedor */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0">
                              {p.supplier_razon_social.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                                {p.supplier_razon_social}
                              </p>
                              <p className="text-[10px] text-gray-400 font-mono">
                                RUC: {p.supplier_ruc || "N/D"} • {p.skus_vendidos_count} SKUs
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Objetivo */}
                        <td className="py-3.5 px-4 text-right font-bold text-gray-700 dark:text-gray-300 font-mono">
                          {formatPYG(p.meta_monto_gs)}
                        </td>

                        {/* Ventas Actuales */}
                        <td className="py-3.5 px-4 text-right font-black text-gray-900 dark:text-white font-mono">
                          {formatPYG(p.ventas_actual_gs)}
                        </td>

                        {/* % Cumplimiento Actual con Barra */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-center gap-1 w-24 mx-auto">
                            <span className="font-black text-xs text-gray-900 dark:text-white">
                              {p.cumplimiento_actual_pct}%
                            </span>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  p.cumplimiento_actual_pct >= 50 ? "bg-emerald-500" :
                                  p.cumplimiento_actual_pct >= 30 ? "bg-blue-500" :
                                  p.cumplimiento_actual_pct >= 15 ? "bg-amber-500" : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(p.cumplimiento_actual_pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Tendencia Proyectada */}
                        <td className="py-3.5 px-4 text-right font-black text-blue-600 dark:text-blue-400 font-mono">
                          {formatPYG(p.tendencia_proyectada_gs)}
                        </td>

                        {/* % Proyectado */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            p.cumplimiento_proyectado_pct >= 100 ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300" :
                            p.cumplimiento_proyectado_pct >= 80 ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300" :
                            p.cumplimiento_proyectado_pct >= 50 ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300" :
                            "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                          }`}>
                            {p.cumplimiento_proyectado_pct}%
                          </span>
                        </td>

                        {/* Rebate Estimado */}
                        <td className="py-3.5 px-4 text-center">
                          <div>
                            <span className="font-black text-amber-600 dark:text-amber-400 text-xs font-mono">
                              {formatPYG(p.rebate_ganado_proy_gs)}
                            </span>
                            <p className="text-[10px] text-gray-400 font-semibold">
                              ({p.rebate_ganado_proy_pct}%)
                            </p>
                          </div>
                        </td>

                        {/* Semáforo */}
                        <td className="py-3.5 px-4 text-center">
                          {p.semaforo === "superado" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                              SUPERADO
                            </span>
                          )}
                          {p.semaforo === "en_meta" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300">
                              EN META
                            </span>
                          )}
                          {p.semaforo === "en_riesgo" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300">
                              EN RIESGO
                            </span>
                          )}
                          {p.semaforo === "critico" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300">
                              CRÍTICO
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAgreement(p)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition cursor-pointer"
                            title="Editar Meta y Escalas de Rebate"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                  {/* Totales Generales */}
                  <tfoot className="bg-gray-100/80 dark:bg-slate-800 font-black text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-700">
                    <tr>
                      <td className="py-4 px-4 font-black">TOTAL GENERAL CONSOLIDADO</td>
                      <td className="py-4 px-4 text-right font-mono text-xs">{formatPYG(multiDashboard?.meta_total_general_gs || 0)}</td>
                      <td className="py-4 px-4 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">{formatPYG(multiDashboard?.ventas_total_general_gs || 0)}</td>
                      <td className="py-4 px-4 text-center">{multiDashboard?.cumplimiento_global_pct || 0}%</td>
                      <td className="py-4 px-4 text-right font-mono text-xs text-blue-600 dark:text-blue-400">{formatPYG(multiDashboard?.tendencia_global_gs || 0)}</td>
                      <td className="py-4 px-4 text-center">{multiDashboard?.cumplimiento_proyectado_global_pct || 0}%</td>
                      <td className="py-4 px-4 text-center text-amber-600 dark:text-amber-400 font-mono">{formatPYG(multiDashboard?.rebate_total_estimado_gs || 0)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

          </div>

        </div>
        </ErrorBoundary>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {/* ─── VISTA 2: PROGRAMA ESPECIAL PARESA (COCA-COLA) CON MAGNITUDES Y TOOLTIPS ─── */}
      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === "paresa" && (
        <ErrorBoundary moduleName="Tablero PARESA Coca-Cola" compact onReset={() => selectedPeriodId ? loadParesaSummary(selectedPeriodId) : loadParesaPeriods()}>
        <div className="space-y-6">
          
          {/* Header PARESA: Selector de Período y Botones */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-red-600/30 shrink-0">
                Coca
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">
                    PARAGUAY REFRESCOS S.A.
                  </h2>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    RUC: 80003400-7 • 797 SKUs
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200">
                    🏆 Acuerdo Oficial 2026
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <span>Esquema de Cajas Unitarias (UC = 5,678 Litros)</span>
                  <span>•</span>
                  <span>Sell-In Compras & Sell-Out Facturación</span>
                  <span>•</span>
                  <span>Auditorías Trade Marketing</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleOpenEditTargets}
                className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-800 dark:text-gray-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Edit3 className="w-4 h-4 text-indigo-600" />
                Editar Metas & Focos
              </button>
              <button
                type="button"
                onClick={() => setLiquidationModalOpen(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Liquidación Comercial
              </button>
            </div>
          </div>

          {/* PARESA Macro Cards con Tooltips Informativos */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Sell-In Compras */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative group">
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                  <span>📦 Base Sell-In (Compras)</span>
                  <div className="relative">
                    <Info 
                      className="w-4 h-4 text-gray-400 hover:text-indigo-600 cursor-pointer" 
                      onMouseEnter={() => setActiveTooltip("sell_in")}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    {activeTooltip === "sell_in" && (
                      <div className="absolute right-0 top-6 z-50 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-2xl shadow-2xl border border-slate-700 leading-tight">
                        <b>Sell-In (Compras Netas Sin IVA):</b> Es la base oficial acordada sobre la cual PARESA liquida el porcentaje de Rebate ganado.
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white mt-2 font-mono">
                  {formatPYG(summary.monto_compras_sin_iva)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Total compras netas acumuladas en el mes</p>
              </div>

              {/* Ventas Sell-Out Netas */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                  <span>🛒 Ventas Sell-Out Netas</span>
                  <div className="relative">
                    <Info 
                      className="w-4 h-4 text-gray-400 hover:text-indigo-600 cursor-pointer" 
                      onMouseEnter={() => setActiveTooltip("sell_out")}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    {activeTooltip === "sell_out" && (
                      <div className="absolute right-0 top-6 z-50 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-2xl shadow-2xl border border-slate-700 leading-tight">
                        <b>Sell-Out (Facturación ERP):</b> Total de ventas registradas en todos los depósitos y sucursales sin IVA.
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2 font-mono">
                  {formatPYG(summary.venta_base_sin_iva)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Facturación comercial en todas las sucursales</p>
              </div>

              {/* Volumen Total en UCs */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                  <div className="flex items-center gap-1.5">
                    <span>🥤 Avance Volumen (UCs)</span>
                    <div className="relative">
                      <Info 
                        className="w-4 h-4 text-gray-400 hover:text-indigo-600 cursor-pointer" 
                        onMouseEnter={() => setActiveTooltip("uc_info")}
                        onMouseLeave={() => setActiveTooltip(null)}
                      />
                      {activeTooltip === "uc_info" && (
                        <div className="absolute left-0 top-6 z-50 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-2xl shadow-2xl border border-slate-700 leading-tight">
                          <b>Caja Unitaria (UC):</b> Unidad estándar de The Coca-Cola Company equivalente a 5,678 Litros o 24 botellas de 8 oz.
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-black">
                    {summary.pct_cumplimiento_total}% MTD
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatNumber(paresaTotalVolume?.resultado_uc || 0)}
                  </p>
                  <span className="text-xs text-gray-400 font-bold">
                    / {formatNumber(paresaTotalVolume?.meta_uc ?? 0)} UC ({paresaTotalVolume?.cumplimiento_pct ?? 0}%)
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Avance global del objetivo de volumen</p>
              </div>

              {/* Rebate Ganado */}
              <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-900/60 p-5 rounded-3xl shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                  <span>💰 Rebate Ganado</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-black">
                    +{summary.total_rebate_pct_ganado}%
                  </span>
                </div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
                  {formatPYG(summary.monto_rebate_calculado)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Retorno financiero calculado en vivo</p>
              </div>

            </div>
          )}

          {/* ─── DESGLOSE OFICIAL POR MAGNITUDES Y CATEGORÍAS ─── */}
          {loadingParesa ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400 bg-white dark:bg-slate-900 rounded-3xl">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <p className="text-sm font-semibold">Cargando indicadores de PARESA...</p>
            </div>
          ) : summary && (
            <div className="space-y-6">

              {/* 1. MAGNITUD: VOLUMEN GENERAL Y MACROCATEGORÍAS CON PROYECCIONES */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                        1. Macrocategorías de Volumen (Core Coca-Cola)
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                          Avances & Proyección al Cierre
                        </span>
                      </h3>
                      <p className="text-xs text-gray-400">
                        Venta en Cajas Unitarias (UC) por familia de producto con proyección lineal (Run-Rate) calculada al día {multiDashboard?.dias_transcurridos || new Date().getDate()} de {multiDashboard?.dias_totales_mes || 31}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tarjetas Visuales de Macrocategorías */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {paresaVolumeIndicators.map(ind => {
                    const metaVal = Number(ind.meta_uc || ind.meta || 0)
                    const realVal = Number(ind.resultado_uc || ind.resultado || 0)
                    const diasTrans = multiDashboard?.dias_transcurridos || Math.min(new Date().getDate(), 31)
                    const diasTot = multiDashboard?.dias_totales_mes || 31
                    const proyVal = diasTrans > 0 ? (realVal / diasTrans) * diasTot : 0
                    const proyPct = metaVal > 0 ? ((proyVal / metaVal) * 100).toFixed(1) : "0"
                    const gapVal = Math.max(0, metaVal - realVal)
                    const isSSDs = ind.codigo === "venta_ssds"
                    const isHidra = ind.codigo === "venta_hidratacion"

                    return (
                      <div 
                        key={ind.id} 
                        className={`p-5 rounded-3xl border transition-all relative overflow-hidden space-y-4 ${
                          isSSDs 
                            ? "bg-gradient-to-b from-red-500/5 to-transparent border-red-200 dark:border-red-900/40" 
                            : isHidra 
                            ? "bg-gradient-to-b from-cyan-500/5 to-transparent border-cyan-200 dark:border-cyan-900/40"
                            : "bg-gradient-to-b from-emerald-500/5 to-transparent border-emerald-200 dark:border-emerald-900/40"
                        }`}
                      >
                        {/* Cabecera Tarjeta */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-xl text-white font-black text-xs ${
                              isSSDs ? "bg-red-600 shadow-md shadow-red-500/30" :
                              isHidra ? "bg-cyan-600 shadow-md shadow-cyan-500/30" : "bg-emerald-600 shadow-md shadow-emerald-500/30"
                            }`}>
                              {isSSDs ? "SSDs" : isHidra ? "Agua" : "Nutri"}
                            </div>
                            <div>
                              <p className="font-black text-sm text-gray-900 dark:text-white">{ind.nombre}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{ind.codigo} • Peso {ind.peso_pct}%</p>
                            </div>
                          </div>
                          <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                            Number(proyPct) >= 100 ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300" :
                            Number(proyPct) >= 80 ? "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300" :
                            "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"
                          }`}>
                            Proy: {proyPct}%
                          </span>
                        </div>

                        {/* Métricas Principales */}
                        <div className="grid grid-cols-2 gap-2 bg-white/70 dark:bg-slate-900/70 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] text-gray-400 font-bold block uppercase">Real Actual (MTD)</span>
                            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                              {formatNumber(realVal)} <span className="text-xs font-normal">UC</span>
                            </p>
                            <span className="text-[10px] font-bold text-gray-500">
                              {ind.cumplimiento_pct}% de la meta
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 font-bold block uppercase">Meta Mensual</span>
                            <p className="text-lg font-black text-gray-800 dark:text-gray-200 font-mono">
                              {formatNumber(metaVal)} <span className="text-xs font-normal">UC</span>
                            </p>
                            <span className="text-[10px] font-bold text-gray-400">
                              Faltan {formatNumber(gapVal)} UC
                            </span>
                          </div>
                        </div>

                        {/* Tendencia y Proyección con Porcentaje Explícito */}
                        <div className="flex items-center justify-between text-xs px-1">
                          <span className="text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Tendencia Cierre de Mes:
                          </span>
                          <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-xs">
                            {formatNumber(proyVal)} UC <span className="text-blue-500 font-bold">({proyPct}%)</span>
                          </span>
                        </div>

                        {/* Barra de Progreso Doble (Real vs Proyectado) */}
                        <div className="space-y-1">
                          <div className="w-full bg-gray-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                            {/* Proyección (Barra Fondo) */}
                            <div 
                              className="h-full bg-blue-200 dark:bg-blue-900/60 rounded-full absolute top-0 left-0"
                              style={{ width: `${Math.min(Number(proyPct), 100)}%` }}
                            />
                            {/* Real Actual (Barra Frente) */}
                            <div 
                              className={`h-full rounded-full absolute top-0 left-0 ${
                                isSSDs ? "bg-red-500" : isHidra ? "bg-cyan-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(Number(ind.cumplimiento_pct), 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-indigo-600 dark:text-indigo-400">
                              Real: {ind.cumplimiento_pct}%
                            </span>
                            <span className="text-blue-600 dark:text-blue-400">
                              Proyectado: {proyPct}%
                            </span>
                          </div>
                        </div>

                      </div>
                    )
                  })}
                </div>

                {/* Tabla Detallada Consolidada de Macrocategorías */}
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/80 dark:bg-slate-800/80 uppercase font-black text-gray-500 border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="py-3 px-4">Macrocategoría</th>
                        <th className="py-3 px-4 text-center">Peso</th>
                        <th className="py-3 px-4 text-right">Meta (UC)</th>
                        <th className="py-3 px-4 text-right">Real MTD (UC)</th>
                        <th className="py-3 px-4 text-center">% Avance</th>
                        <th className="py-3 px-4 text-right">Tendencia Cierre (UC)</th>
                        <th className="py-3 px-4 text-center">% Proyectado</th>
                        <th className="py-3 px-4 text-right">Brecha Restante (Gap)</th>
                        <th className="py-3 px-4 text-center">Estado Proyectado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {paresaVolumeIndicators.map(ind => {
                        const metaVal = Number(ind.meta_uc || ind.meta || 0)
                        const realVal = Number(ind.resultado_uc || ind.resultado || 0)
                        const diasTrans = multiDashboard?.dias_transcurridos || Math.min(new Date().getDate(), 31)
                        const diasTot = multiDashboard?.dias_totales_mes || 31
                        const proyVal = diasTrans > 0 ? (realVal / diasTrans) * diasTot : 0
                        const proyPct = metaVal > 0 ? ((proyVal / metaVal) * 100).toFixed(1) : "0"
                        const gapVal = Math.max(0, metaVal - realVal)

                        return (
                          <tr key={ind.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                              {ind.nombre}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-gray-500">
                              {ind.peso_pct}%
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                              {formatNumber(metaVal)} UC
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                              {formatNumber(realVal)} UC
                            </td>
                            <td className="py-3 px-4 text-center font-black">
                              <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200">
                                {ind.cumplimiento_pct}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                              {formatNumber(proyVal)} UC
                            </td>
                            <td className="py-3 px-4 text-center font-black">
                              <span className={`px-2 py-0.5 rounded-lg ${
                                Number(proyPct) >= 100 ? "bg-emerald-100 text-emerald-800" :
                                Number(proyPct) >= 80 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                              }`}>
                                {proyPct}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                              -{formatNumber(gapVal)} UC
                            </td>
                            <td className="py-3 px-4 text-center">
                              {Number(proyPct) >= 100 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300">
                                  SUPERADO
                                </span>
                              ) : Number(proyPct) >= 80 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-300">
                                  EN META
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-300">
                                  EN RIESGO
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100/90 dark:bg-slate-800 font-black border-t-2 border-slate-300 dark:border-slate-700">
                      <tr>
                        <td className="py-3.5 px-4 text-gray-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                          <span>TOTAL MACROCATEGORÍAS</span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700 dark:text-gray-300">
                          {macroTotals.peso}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-gray-900 dark:text-white">
                          {formatNumber(macroTotals.meta)} UC
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                          {formatNumber(macroTotals.real)} UC
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200">
                            {macroTotals.avancePct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-blue-600 dark:text-blue-400">
                          {formatNumber(macroTotals.proy)} UC
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg ${
                            Number(macroTotals.proyPct) >= 100 ? "bg-emerald-100 text-emerald-800" :
                            Number(macroTotals.proyPct) >= 80 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {macroTotals.proyPct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                          -{formatNumber(macroTotals.gap)} UC
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {Number(macroTotals.proyPct) >= 100 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300">
                              🚀 SUPERADO
                            </span>
                          ) : Number(macroTotals.proyPct) >= 80 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-300">
                              🎯 EN META
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-300">
                              ⚠️ EN RIESGO
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

              </div>

              {/* 2. MAGNITUD: FOCOS ESTRATÉGICOS DEL MES (MUST-WIN BATTLES CON PROYECCIONES) */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-6">
                
                {/* Encabezado Sección */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                        2. Líneas Foco Estratégicas (Must-Win Battles)
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                          Proyección de Cierre de Mes
                        </span>
                      </h3>
                      <p className="text-xs text-gray-400">
                        Líneas de productos priorizadas con proyección de ventas lineal al cierre y bonificación directa de Rebate
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tarjetas Visuales de Líneas Foco */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {paresaFocusIndicators.map(ind => {
                    const metaVal = Number(ind.meta_uc || ind.meta || 0)
                    const realVal = Number(ind.resultado_uc || ind.resultado || 0)
                    const diasTrans = multiDashboard?.dias_transcurridos || Math.min(new Date().getDate(), 31)
                    const diasTot = multiDashboard?.dias_totales_mes || 31
                    const proyVal = Number(ind.proyeccion_uc || (diasTrans > 0 ? (realVal / diasTrans) * diasTot : 0))
                    const proyPct = Number(ind.proyeccion_pct || (metaVal > 0 ? ((proyVal / metaVal) * 100) : 0)).toFixed(1)
                    const gapVal = Math.max(0, metaVal - realVal)
                    const isSuperado = Number(proyPct) >= 100
                    const isEnMeta = Number(proyPct) >= 80

                    return (
                      <div 
                        key={ind.id} 
                        className={`p-5 rounded-3xl border transition-all relative overflow-hidden space-y-4 ${
                          isSuperado 
                            ? "bg-gradient-to-b from-emerald-500/10 to-transparent border-emerald-300 dark:border-emerald-800/60 shadow-lg shadow-emerald-500/5" 
                            : isEnMeta 
                            ? "bg-gradient-to-b from-blue-500/10 to-transparent border-blue-300 dark:border-blue-800/60 shadow-lg shadow-blue-500/5" 
                            : "bg-gradient-to-b from-amber-500/10 to-transparent border-amber-300 dark:border-amber-800/60 shadow-lg shadow-amber-500/5"
                        }`}
                      >
                        {/* Cabecera Tarjeta Foco */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-amber-500 text-white font-black text-xs shadow-md shadow-amber-500/30">
                              <Flame className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-black text-sm text-gray-900 dark:text-white leading-tight">{ind.nombre}</p>
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{ind.codigo}</p>
                            </div>
                          </div>
                          <span className={`text-xs font-black px-2.5 py-1 rounded-xl shadow-sm ${
                            isSuperado ? "bg-emerald-600 text-white" :
                            isEnMeta ? "bg-blue-600 text-white" :
                            "bg-amber-600 text-white"
                          }`}>
                            Proy: {proyPct}%
                          </span>
                        </div>

                        {/* Comparativo Real MTD vs Meta */}
                        <div className="grid grid-cols-2 gap-2 bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] text-gray-400 font-bold block uppercase">Real MTD (Avance)</span>
                            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                              {formatNumber(realVal)} <span className="text-xs font-normal">UC</span>
                            </p>
                            <span className="text-[10px] font-bold text-gray-500">
                              {ind.cumplimiento_pct}% de meta
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 font-bold block uppercase">Meta del Mes</span>
                            <p className="text-lg font-black text-gray-800 dark:text-gray-200 font-mono">
                              {formatNumber(metaVal)} <span className="text-xs font-normal">UC</span>
                            </p>
                            <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400">
                              Faltan {formatNumber(gapVal)} UC
                            </span>
                          </div>
                        </div>

                        {/* Proyección y Tendencia de Cierre */}
                        <div className="flex items-center justify-between text-xs px-1">
                          <span className="text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                            Tendencia Estimada Fin de Mes:
                          </span>
                          <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-sm">
                            {formatNumber(proyVal)} UC
                          </span>
                        </div>

                        {/* Barra de Progreso Doble */}
                        <div className="space-y-1">
                          <div className="w-full bg-gray-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                            {/* Proyección Cierre */}
                            <div 
                              className="h-full bg-amber-200 dark:bg-amber-900/60 rounded-full absolute top-0 left-0"
                              style={{ width: `${Math.min(Number(proyPct), 100)}%` }}
                            />
                            {/* Real Actual */}
                            <div 
                              className="h-full rounded-full bg-amber-500 absolute top-0 left-0"
                              style={{ width: `${Math.min(Number(ind.cumplimiento_pct), 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-amber-600 dark:text-amber-400">
                              Real: {ind.cumplimiento_pct}%
                            </span>
                            <span className="text-blue-600 dark:text-blue-400">
                              Proyectado: {proyPct}%
                            </span>
                          </div>
                        </div>

                        {/* Rebate en Juego */}
                        <div className="pt-1 flex items-center justify-between text-xs border-t border-gray-100 dark:border-slate-800/80">
                          <span className="text-gray-500 font-medium">Rebate Asociado:</span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span>Bonificación por Escala</span>
                            {Number(ind.rebate_ganado_pct || 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                                +{ind.rebate_ganado_pct}%
                              </span>
                            )}
                          </span>
                        </div>

                      </div>
                    )
                  })}
                </div>

                {/* Tabla Comparativa Detallada de Líneas Foco */}
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-50/70 dark:bg-slate-800/80 uppercase font-black text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="py-3 px-4">Línea Foco Estratégica</th>
                        <th className="py-3 px-4 text-center">Código</th>
                        <th className="py-3 px-4 text-right">Meta (UC)</th>
                        <th className="py-3 px-4 text-right">Real MTD (UC)</th>
                        <th className="py-3 px-4 text-center">% Avance Actual</th>
                        <th className="py-3 px-4 text-right">Tendencia Cierre (UC)</th>
                        <th className="py-3 px-4 text-center">% Proyectado</th>
                        <th className="py-3 px-4 text-right">Brecha (Faltante)</th>
                        <th className="py-3 px-4 text-center">Estado Proyectado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {paresaFocusIndicators.map(ind => {
                        const metaVal = Number(ind.meta_uc || ind.meta || 0)
                        const realVal = Number(ind.resultado_uc || ind.resultado || 0)
                        const diasTrans = multiDashboard?.dias_transcurridos || Math.min(new Date().getDate(), 31)
                        const diasTot = multiDashboard?.dias_totales_mes || 31
                        const proyVal = Number(ind.proyeccion_uc || (diasTrans > 0 ? (realVal / diasTrans) * diasTot : 0))
                        const proyPct = Number(ind.proyeccion_pct || (metaVal > 0 ? ((proyVal / metaVal) * 100) : 0)).toFixed(1)
                        const gapVal = Math.max(0, metaVal - realVal)
                        const isSuperado = Number(proyPct) >= 100
                        const isEnMeta = Number(proyPct) >= 80

                        return (
                          <tr key={ind.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 font-black text-gray-900 dark:text-white flex items-center gap-2">
                              <Flame className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{ind.nombre}</span>
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono text-[11px] text-gray-500">
                              {ind.codigo}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                              {formatNumber(metaVal)} UC
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                              {formatNumber(realVal)} UC
                            </td>
                            <td className="py-3.5 px-4 text-center font-black">
                              <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200">
                                {ind.cumplimiento_pct}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                              {formatNumber(proyVal)} UC
                            </td>
                            <td className="py-3.5 px-4 text-center font-black">
                              <span className={`px-2 py-0.5 rounded-lg ${
                                isSuperado ? "bg-emerald-100 text-emerald-800 font-black" :
                                isEnMeta ? "bg-blue-100 text-blue-800 font-black" : "bg-amber-100 text-amber-800 font-black"
                              }`}>
                                {proyPct}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                              -{formatNumber(gapVal)} UC
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isSuperado ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300">
                                  🚀 SUPERADO
                                </span>
                              ) : isEnMeta ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-300">
                                  🎯 EN META
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-300">
                                  ⚠️ EN RIESGO
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-amber-50/90 dark:bg-slate-800 font-black border-t-2 border-amber-200 dark:border-slate-700">
                      <tr>
                        <td className="py-3.5 px-4 text-gray-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>TOTAL LÍNEAS FOCO ({focusTotals.count} LÍNEAS)</span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-500 font-mono text-[11px]">
                          SUMATORIA
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-gray-900 dark:text-white">
                          {formatNumber(focusTotals.meta)} UC
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                          {formatNumber(focusTotals.real)} UC
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200">
                            {focusTotals.avancePct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-blue-600 dark:text-blue-400">
                          {formatNumber(focusTotals.proy)} UC
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg ${
                            Number(focusTotals.proyPct) >= 100 ? "bg-emerald-100 text-emerald-800 font-black" :
                            Number(focusTotals.proyPct) >= 80 ? "bg-blue-100 text-blue-800 font-black" : "bg-amber-100 text-amber-800 font-black"
                          }`}>
                            {focusTotals.proyPct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                          -{formatNumber(focusTotals.gap)} UC
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {Number(focusTotals.proyPct) >= 100 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300">
                              🚀 SUPERADO
                            </span>
                          ) : Number(focusTotals.proyPct) >= 80 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-300">
                              🎯 EN META
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-300">
                              ⚠️ EN RIESGO
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

              </div>

              {/* 3. MAGNITUD: TRADE MARKETING Y AUDITORÍAS EN PUNTO DE VENTA */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900 dark:text-white">
                        3. Trade Marketing & Disciplina Comercial
                      </h3>
                      <p className="text-xs text-gray-400">
                        Auditorías de precios sugeridos, activación de combos y pureza de heladeras en salones
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paresaTradeIndicators.map(ind => (
                    <div key={ind.id} className="p-5 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white">{ind.nombre}</h4>
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                            +{ind.rebate_ganado_pct}% Rebate
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {ind.codigo === "tpm_auditoria" 
                            ? "Auditoría de precios sugeridos, respeto de promociones y material publicitario POP."
                            : "Auditoría de planogramas y 100% de pureza en heladeras (sin productos de la competencia). Condicionado a >=80% en ventas."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-slate-700">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-bold">Resultado Auditoría</span>
                          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            {ind.resultado}%
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block font-bold">Meta Requerida</span>
                          <span className="text-sm font-bold text-gray-600 dark:text-gray-400 font-mono">
                            {ind.meta}%
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block font-bold">Estado</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300">
                            CUMPLIDO
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
        </ErrorBoundary>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {/* ─── MODAL EDICIÓN ACUERDO PROVEEDOR GENERAL ─── */}
      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-5">
            
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    Configurar Metas y Rebate
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {editingItem.supplier_razon_social} (RUC {editingItem.supplier_ruc || "N/D"})
                  </p>
                </div>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              
              {/* Meta en Guaraníes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Meta Mensual Objetivo (Guaraníes ₲)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={editMetaGs}
                    onChange={e => setEditMetaGs(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-mono">
                    {formatPYG(editMetaGs)}
                  </span>
                </div>
              </div>

              {/* Piso Mínimo */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Piso Mínimo de Cumplimiento para Alerta (%)
                </label>
                <input
                  type="number"
                  value={editPisoPct}
                  onChange={e => setEditPisoPct(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Tramos de Escala */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Escala de Retorno Comercial (Tramos de Rebate)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTramo}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Tramo
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editTramos.map((tr, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-gray-200 dark:border-slate-700">
                      <div className="flex-1">
                        <span className="text-[10px] text-gray-400 font-bold block mb-0.5">% Mínimo Cumplimiento</span>
                        <input
                          type="number"
                          value={tr.min_pct}
                          onChange={e => handleUpdateTramo(idx, "min_pct", Number(e.target.value))}
                          className="w-full px-3 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-gray-400 font-bold block mb-0.5">% Rebate Retorno</span>
                        <input
                          type="number"
                          step="0.1"
                          value={tr.rebate_pct}
                          onChange={e => handleUpdateTramo(idx, "rebate_pct", Number(e.target.value))}
                          className="w-full px-3 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-amber-600"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTramo(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl mt-3 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAgreement}
                disabled={savingEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Configuración
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {/* ─── MODAL EDICIÓN METAS PARESA ─── */}
      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {modalOpen && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                Editar Metas y Focos PARESA ({summary.period.periodo})
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {editIndicators.map((ind, idx) => (
                <div key={ind.id} className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{ind.nombre}</p>
                    <p className="text-[10px] text-gray-400">{ind.categoria} • Peso: {ind.peso_pct}%</p>
                  </div>
                  <div className="w-32">
                    <span className="text-[10px] text-gray-400 font-bold block">
                      {ind.categoria === "trade_marketing" ? "Meta %" : "Meta UC"}
                    </span>
                    <input
                      type="number"
                      value={ind.meta_uc}
                      onChange={e => {
                        const val = Number(e.target.value)
                        setEditIndicators(prev => prev.map((item, i) => i === idx ? { ...item, meta_uc: val } : item))
                      }}
                      className="w-full px-3 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>
                  {ind.categoria === "trade_marketing" && (
                    <div className="w-32">
                      <span className="text-[10px] text-gray-400 font-bold block">Auditoría Real %</span>
                      <input
                        type="number"
                        value={ind.resultado_uc}
                        onChange={e => {
                          const val = Number(e.target.value)
                          setEditIndicators(prev => prev.map((item, i) => i === idx ? { ...item, resultado_uc: val } : item))
                        }}
                        className="w-full px-3 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveParesaTargets}
                disabled={savingTargets}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-red-600/30 cursor-pointer"
              >
                {savingTargets ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Metas PARESA
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {/* ─── MODAL LIQUIDACIÓN COMERCIAL PARESA ─── */}
      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {liquidationModalOpen && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    Liquidación de Rebate Comercial — PARESA
                  </h3>
                  <p className="text-xs text-gray-400">Período: {summary.period.periodo}</p>
                </div>
              </div>
              <button onClick={() => setLiquidationModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold">Base Sell-In (Compras Netas Sin IVA):</span>
                <span className="font-black font-mono text-gray-900 dark:text-white">{formatPYG(summary.monto_compras_sin_iva)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold">Ventas Sell-Out Netas Sin IVA:</span>
                <span className="font-black font-mono text-indigo-600 dark:text-indigo-400">{formatPYG(summary.venta_base_sin_iva)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold">% Cumplimiento Ponderado:</span>
                <span className="font-black text-emerald-600 font-mono">{summary.pct_cumplimiento_total}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold">Tasa Total de Rebate Ganada:</span>
                <span className="font-black text-amber-600 font-mono">+{summary.total_rebate_pct_ganado}%</span>
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-sm font-black text-gray-900 dark:text-white">Total Liquidación Estimada:</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatPYG(summary.monto_rebate_calculado)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLiquidationModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print()
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir Liquidación
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
