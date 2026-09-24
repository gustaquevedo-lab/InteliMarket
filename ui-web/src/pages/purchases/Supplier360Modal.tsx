import React, { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  X, Building2, Download, AlertTriangle, CheckCircle2, Clock,
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, Package,
  FileText, ShieldAlert, CreditCard, RefreshCw, Layers, Eye,
  BarChart3, Calendar, Truck, ArrowUpRight, ArrowDownRight,
  Search, ExternalLink, HelpCircle, Check, Sparkles, Printer,
  Wallet, Tag, FileCheck, Filter, ShieldCheck, ChevronDown
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell
} from "recharts"
import { api, type Supplier360Response } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

type Tab360 =
  | "overview"
  | "deudas"
  | "cheques"
  | "pagos"
  | "compras"
  | "nc_reclamos"
  | "stock"
  | "informe"

type SubTabNc =
  | "monedero"
  | "etapa1_requerimientos"
  | "devoluciones"
  | "aplicaciones"

interface Props {
  supplierId: string
  supplierNombre?: string
  onClose: () => void
}

const TAB_CONFIG: Array<{ key: Tab360; label: string; icon: any }> = [
  { key: "overview", label: "Dashboard 360°", icon: BarChart3 },
  { key: "deudas", label: "Deudas & Facturas (AP)", icon: DollarSign },
  { key: "nc_reclamos", label: "Monedero & NCs", icon: Wallet },
  { key: "cheques", label: "Cheques Diferidos", icon: CreditCard },
  { key: "pagos", label: "Historial de Pagos", icon: Clock },
  { key: "compras", label: "Compras & Recepciones", icon: ShoppingCart },
  { key: "stock", label: "Catálogo & Stock", icon: Package },
  { key: "informe", label: "Informe Gerencial", icon: FileText },
]

export default function Supplier360Modal({ supplierId, supplierNombre, onClose }: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab360>("overview")
  const [data, setData] = useState<Supplier360Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingPdfTab, setDownloadingPdfTab] = useState<string | null>(null)

  // Filtros internos de Facturas (Deudas)
  const [searchFactura, setSearchFactura] = useState("")
  const [filterVencimiento, setFilterVencimiento] = useState("all")
  const [filterNcFactura, setFilterNcFactura] = useState("all")
  const [filterFaseFactura, setFilterFaseFactura] = useState("all")

  // Filtros internos de Monedero / NC
  const [subTabNc, setSubTabNc] = useState<SubTabNc>("monedero")
  const [filterNcOrigen, setFilterNcOrigen] = useState("all")
  const [filterNcEtapa, setFilterNcEtapa] = useState("all")
  const [searchNc, setSearchNc] = useState("")

  // Filtros de Productos
  const [searchProducto, setSearchProducto] = useState("")

  // Cargar datos en vivo
  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.purchases.getSupplier360(supplierId)
      setData(res)
    } catch (err: any) {
      toast.error("Error al cargar Visión 360°", err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (supplierId) loadData()
  }, [supplierId])

  // Manejo de tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // Descarga del PDF (soporta tab específico o reporte general 360)
  const handleDownloadPdf = async (targetTab?: string) => {
    if (!data) return
    const tabKey = targetTab || "general"
    setDownloadingPdfTab(tabKey)
    try {
      await api.purchases.downloadSupplier360Pdf(
        supplierId,
        data.supplier.razon_social || supplierNombre || "proveedor",
        targetTab
      )
      toast.success(
        "PDF Generado Exitosamente",
        targetTab
          ? `Se descargó el informe detallado de la pestaña ${targetTab.toUpperCase()}.`
          : "Se descargó el Informe Gerencial 360° completo con gráficos y auditoría."
      )
    } catch (err: any) {
      toast.error("Error al generar PDF", err.message)
    } finally {
      setDownloadingPdfTab(null)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Filtrado de Facturas
  const facturasFiltradas = useMemo(() => {
    if (!data?.facturas) return []
    return data.facturas.filter(f => {
      const matchText =
        !searchFactura ||
        f.numero_factura.toLowerCase().includes(searchFactura.toLowerCase()) ||
        (f.timbrado || "").includes(searchFactura)

      const matchVenc =
        filterVencimiento === "all" ||
        (filterVencimiento === "vencidas" && f.es_vencida) ||
        (filterVencimiento === "al_dia" && !f.es_vencida) ||
        (filterVencimiento === "pendientes" && f.saldo_pendiente > 0)

      const matchNc =
        filterNcFactura === "all" ||
        (filterNcFactura === "con_nc" && ((f.monto_nc_aplicado || 0) > 0 || (f.ncs_vinculadas && f.ncs_vinculadas.length > 0))) ||
        (filterNcFactura === "retenida" && (f.requiere_nc || (f.monto_retenido_nc || 0) > 0 || f.bloqueada_para_pago)) ||
        (filterNcFactura === "sin_nc" && (!f.monto_nc_aplicado && !f.requiere_nc && (!f.ncs_vinculadas || f.ncs_vinculadas.length === 0)))

      const matchFase =
        filterFaseFactura === "all" ||
        f.fase_pago === filterFaseFactura

      return matchText && matchVenc && matchNc && matchFase
    })
  }, [data?.facturas, searchFactura, filterVencimiento, filterNcFactura, filterFaseFactura])

  // Filtrado de NCs en Monedero
  const monederoItemsFiltrados = useMemo(() => {
    if (!data?.monedero_nc?.items) return []
    return data.monedero_nc.items.filter(item => {
      const matchText =
        !searchNc ||
        item.numero.toLowerCase().includes(searchNc.toLowerCase()) ||
        (item.timbrado || "").includes(searchNc) ||
        item.origen_label.toLowerCase().includes(searchNc.toLowerCase()) ||
        (item.motivo || "").toLowerCase().includes(searchNc.toLowerCase())

      const matchOrigen =
        filterNcOrigen === "all" ||
        item.origen_clave === filterNcOrigen

      const matchEtapa =
        filterNcEtapa === "all" ||
        item.etapa_codigo === filterNcEtapa

      return matchText && matchOrigen && matchEtapa
    })
  }, [data?.monedero_nc?.items, searchNc, filterNcOrigen, filterNcEtapa])

  // Filtrado de Reclamos en Etapa 1
  const reclamosFiltrados = useMemo(() => {
    if (!data?.monedero_nc?.reclamos) return []
    return data.monedero_nc.reclamos.filter(r => {
      const matchText =
        !searchNc ||
        r.numero_solicitud.toLowerCase().includes(searchNc.toLowerCase()) ||
        (r.invoice_numero || "").toLowerCase().includes(searchNc.toLowerCase()) ||
        (r.origen_label || "").toLowerCase().includes(searchNc.toLowerCase())

      const matchOrigen =
        filterNcOrigen === "all" ||
        r.origen_clave === filterNcOrigen

      const matchEtapa =
        filterNcEtapa === "all" ||
        r.etapa_codigo === filterNcEtapa

      return matchText && matchOrigen && matchEtapa
    })
  }, [data?.monedero_nc?.reclamos, searchNc, filterNcOrigen, filterNcEtapa])

  // Filtrado de Devoluciones Físicas
  const devolucionesFiltradas = useMemo(() => {
    if (!data?.monedero_nc?.devoluciones_fisicas) return []
    return data.monedero_nc.devoluciones_fisicas.filter(d => {
      const matchText =
        !searchNc ||
        d.codigo.toLowerCase().includes(searchNc.toLowerCase()) ||
        (d.nota_credito_numero || "").toLowerCase().includes(searchNc.toLowerCase())

      const matchOrigen =
        filterNcOrigen === "all" ||
        d.origen_clave === filterNcOrigen

      const matchEtapa =
        filterNcEtapa === "all" ||
        d.etapa_codigo === filterNcEtapa

      return matchText && matchOrigen && matchEtapa
    })
  }, [data?.monedero_nc?.devoluciones_fisicas, searchNc, filterNcOrigen, filterNcEtapa])

  // Filtrado de Productos
  const productosFiltrados = useMemo(() => {
    if (!data?.productos) return []
    if (!searchProducto) return data.productos
    const s = searchProducto.toLowerCase()
    return data.productos.filter(p =>
      p.nombre.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s) ||
      p.codigo_barra.toLowerCase().includes(s)
    )
  }, [data?.productos, searchProducto])

  const s = data?.supplier
  const kpis = data?.kpis
  const aging = data?.aging_buckets
  const monedero = data?.monedero_nc

  // Aging donut data
  const agingChartData = useMemo(() => {
    if (!aging) return []
    return [
      { name: "Vencido", value: aging.vencido, color: "#ef4444" },
      { name: "1 a 30 Días", value: aging.dias_1_30, color: "#f59e0b" },
      { name: "31 a 60 Días", value: aging.dias_31_60, color: "#3b82f6" },
      { name: "+60 Días", value: aging.dias_mas_60, color: "#64748b" },
    ].filter(x => x.value > 0)
  }, [aging])

  // Helper para badge de fase de pago
  const getFaseBadge = (fase?: string, label?: string) => {
    const f = fase || "al_dia"
    if (f === "liquidada") {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">F4: Liquidada</span>
    }
    if (f === "bloqueada_nc") {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">F1: Retenida NC</span>
    }
    if (f === "en_lote") {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">F2: En Lote SIPAP</span>
    }
    if (f === "vencida") {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">F1: Vencida</span>
    }
    return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">F1: Al Día</span>
  }

  // Helper para icono de origen
  const getOrigenIcon = (clave: string) => {
    switch (clave) {
      case "recepcion_deposito":
        return <Truck className="w-3.5 h-3.5 text-sky-600" />
      case "promociones":
        return <Tag className="w-3.5 h-3.5 text-purple-600" />
      case "devolucion_merma":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
      case "diferencia_precio":
        return <DollarSign className="w-3.5 h-3.5 text-rose-600" />
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500" />
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden print:h-auto print:border-none print:shadow-none">

        {/* 🌟 CABECERA EJECUTIVA INTELIMARKET */}
        <div className="bg-slate-900 text-white px-6 py-4 shrink-0 border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                    {s?.razon_social || supplierNombre || "Proveedor"}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Visión 360° Integral
                  </span>
                  {monedero && monedero.saldo_disponible > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> Monedero: {formatPYG(monedero.saldo_disponible)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span><b>RUC:</b> {s?.ruc || "S/RUC"}</span>
                  <span><b>Condición:</b> {s?.plazo_pago_dias ? `${s.plazo_pago_dias} días crédito` : "Contado"}</span>
                  <span><b>Banco:</b> {s?.banco || "—"} ({s?.cuenta_bancaria || "S/Cta"})</span>
                  <span><b>Rating:</b> {"★".repeat(Math.round(s?.rating || 5))} ({s?.rating || 5.0}/5)</span>
                </p>
              </div>
            </div>

            {/* Acciones Superiores */}
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={() => handleDownloadPdf()}
                disabled={downloadingPdfTab !== null}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 hover:shadow-rose-600/50 transition disabled:opacity-50"
                title="Descargar Informe Completo en PDF (4 Páginas)"
              >
                <Download className={`w-4 h-4 ${downloadingPdfTab === "general" ? "animate-bounce" : ""}`} />
                <span>{downloadingPdfTab === "general" ? "Generando..." : "Informe Completo (PDF)"}</span>
              </button>

              <button
                onClick={handlePrint}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                title="Imprimir Pantalla"
              >
                <Printer className="w-4 h-4" />
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-400" : ""}`} />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-900/60 text-slate-400 hover:text-white border border-slate-700 transition"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 🌟 NAVEGACIÓN EN PESTAÑAS */}
          <div className="flex items-center gap-1.5 mt-5 overflow-x-auto pb-1 border-t border-slate-800/80 pt-3 text-xs scrollbar-thin">
            {TAB_CONFIG.map(t => {
              const Icon = t.icon
              const isActive = tab === t.key
              const hasMonederoBadge = t.key === "nc_reclamos" && monedero && monedero.saldo_disponible > 0
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition ${
                    isActive
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                  {hasMonederoBadge && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 🌟 BODY CONTENT CON SCROLL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-rose-500" />
              <p className="font-bold text-sm">Consolidando operaciones, deudas y sell-out del proveedor...</p>
            </div>
          ) : !data ? (
            <div className="py-20 text-center text-slate-400">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-500" />
              <p className="font-bold">No se pudo cargar la información del proveedor.</p>
            </div>
          ) : (
            <>
              {/* ─────────────────────────────────────────────────────────────
                  TAB: OVERVIEW / DASHBOARD 360
                  ───────────────────────────────────────────────────────────── */}
              {tab === "overview" && (
                <div className="space-y-6">
                  {/* Hero Toolbar */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white">Tablero Ejecutivo de Rendimiento & Deudas</h3>
                      <p className="text-xs text-slate-500">Métricas consolidadas de pasivos, monedero de crédito, cheques en tránsito y sell-out</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf("overview")}
                        disabled={downloadingPdfTab !== null}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-500" />
                        <span>Exportar PDF</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  {/* Hero KPIs Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    {/* 1. Deuda Facturada Bruta */}
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400">Deuda Facturada Bruta</span>
                        <DollarSign className="w-4 h-4 text-rose-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-rose-700 dark:text-rose-300 mt-1">
                        {formatPYG(kpis?.deuda_total_facturas || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {kpis?.facturas_pendientes_count} facturas abiertas
                      </p>
                    </div>

                    {/* 2. Monedero de NC (Crédito a Favor) */}
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">Monedero NC Disponible</span>
                        <Wallet className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-emerald-800 dark:text-emerald-300 mt-1">
                        {formatPYG(monedero?.saldo_disponible || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {monedero?.cantidad_con_saldo || 0} NCs con saldo activo a favor
                      </p>
                    </div>

                    {/* 3. Deuda Neta Real Supermercado */}
                    <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-purple-700 dark:text-purple-400">Deuda Neta Efectiva</span>
                        <Layers className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-purple-800 dark:text-purple-300 mt-1">
                        {formatPYG(kpis?.deuda_neta_efectiva || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Facturas AP menos crédito de Monedero
                      </p>
                    </div>

                    {/* 4. Cheques Diferidos */}
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400">Cheques Dif. No Compensados</span>
                        <CreditCard className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-amber-800 dark:text-amber-300 mt-1">
                        {formatPYG(kpis?.cheques_diferidos_pendientes_monto || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {kpis?.cheques_diferidos_pendientes_count} cheques diferidos en tránsito
                      </p>
                    </div>

                    {/* 5. Stock Valorizado */}
                    <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-sky-600 dark:text-sky-400">Stock Valorizado (PPP)</span>
                        <Package className="w-4 h-4 text-sky-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-sky-700 dark:text-sky-300 mt-1">
                        {formatPYG(kpis?.stock_valorizado_costo || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {kpis?.stock_unidades_total?.toFixed(0)} un. ({kpis?.total_productos_suministrados} artículos)
                      </p>
                    </div>

                    {/* 6. Ventas Sell-Out */}
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Ventas Sell-Out (12M)</span>
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                        {formatPYG(kpis?.ventas_sellout_monto || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {kpis?.ventas_sellout_unidades?.toFixed(0)} un. despachadas en cajas
                      </p>
                    </div>

                    {/* 7. Margen Bruto */}
                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Margen Bruto (%)</span>
                        <BarChart3 className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-indigo-700 dark:text-indigo-300 mt-1">
                        {kpis?.margen_bruto_pct || 0}%
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Ganancia: {formatPYG(kpis?.ganancia_bruta_monto || 0)}
                      </p>
                    </div>

                    {/* 8. Cumplimiento OTIF */}
                    <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-teal-600 dark:text-teal-400">Cumplimiento OTIF</span>
                        <Truck className="w-4 h-4 text-teal-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-teal-700 dark:text-teal-300 mt-1">
                        {kpis?.otif_rate || 95}%
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Entrega a tiempo en depósito
                      </p>
                    </div>
                  </div>

                  {/* Gráficos de Evolución & Aging */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Gráfico Compras vs Pagos (2 cols) */}
                    <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-rose-500" /> Evolución Mensual: Compras vs Pagos
                        </h4>
                        <span className="text-[11px] text-slate-400 font-mono">Últimos 12 meses</span>
                      </div>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.evolucion_mensual}>
                            <defs>
                              <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorPagos" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis dataKey="label" fontSize={10} tickLine={false} />
                            <YAxis fontSize={10} tickLine={false} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} />
                            <Tooltip formatter={(v: any) => formatPYG(Number(v))} />
                            <Legend />
                            <Area type="monotone" dataKey="compras" name="Facturado (Compras)" stroke="#f43f5e" fillOpacity={1} fill="url(#colorCompras)" />
                            <Area type="monotone" dataKey="pagos" name="Pagado (Efectivo/SIPAP)" stroke="#10b981" fillOpacity={1} fill="url(#colorPagos)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Aging Donut (1 col) */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col">
                      <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" /> Aging de Vencimientos AP
                      </h4>
                      <div className="flex-1 h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={agingChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {agingChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: any) => formatPYG(Number(v))} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 font-mono">
                        <div>
                          <span className="text-red-500 font-bold">● Vencido:</span> {formatPYG(aging?.vencido || 0)}
                        </div>
                        <div>
                          <span className="text-amber-500 font-bold">● 1 a 30d:</span> {formatPYG(aging?.dias_1_30 || 0)}
                        </div>
                        <div>
                          <span className="text-blue-500 font-bold">● 31 a 60d:</span> {formatPYG(aging?.dias_31_60 || 0)}
                        </div>
                        <div>
                          <span className="text-slate-500 font-bold">● +60d:</span> {formatPYG(aging?.dias_mas_60 || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: DEUDAS & FACTURAS (AP) CON NC VINCULADAS Y FASES DE PAGO
                  ───────────────────────────────────────────────────────────── */}
              {tab === "deudas" && (
                <div className="space-y-4">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-rose-500" />
                        Cuentas por Pagar (AP), NCs Vinculadas y Fases de Pago
                      </h3>
                      <p className="text-xs text-slate-500">
                        Total Facturas: {data.facturas.length} · Deuda Bruta: <span className="font-bold text-rose-600">{formatPYG(kpis?.deuda_total_facturas || 0)}</span> · Deuda Neta tras Monedero: <span className="font-bold text-purple-600">{formatPYG(kpis?.deuda_neta_efectiva || 0)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf("deudas")}
                        disabled={downloadingPdfTab !== null}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-500" />
                        <span>Exportar PDF (Deudas)</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  {/* Filtros de Facturas */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por N° Factura o Timbrado..."
                        value={searchFactura}
                        onChange={e => setSearchFactura(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <select
                      value={filterVencimiento}
                      onChange={e => setFilterVencimiento(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      <option value="all">Vencimiento: Todos</option>
                      <option value="vencidas">Solo Vencidas ({kpis?.facturas_vencidas_count})</option>
                      <option value="al_dia">Al día</option>
                      <option value="pendientes">Con Saldo Pendiente</option>
                    </select>

                    <select
                      value={filterNcFactura}
                      onChange={e => setFilterNcFactura(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      <option value="all">Notas de Crédito: Todas</option>
                      <option value="con_nc">Con NC Aplicada / Deducción</option>
                      <option value="retenida">Retenida por NC en Trámite</option>
                      <option value="sin_nc">Sin NC Vinculada</option>
                    </select>

                    <select
                      value={filterFaseFactura}
                      onChange={e => setFilterFaseFactura(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      <option value="all">Fase de Pago: Todas</option>
                      <option value="liquidada">Fase 4: Liquidada 100%</option>
                      <option value="en_lote">Fase 2: En Lote SIPAP</option>
                      <option value="bloqueada_nc">Fase 1: Retenida por NC</option>
                      <option value="vencida">Fase 1: Vencida</option>
                      <option value="al_dia">Fase 1: Al Día</option>
                    </select>
                  </div>

                  {/* Tabla de Facturas */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">N° Factura</th>
                            <th className="p-3">Emisión</th>
                            <th className="p-3">Vencimiento</th>
                            <th className="p-3 text-right">Total Factura</th>
                            <th className="p-3 text-center">NC Vinculada / Deducción</th>
                            <th className="p-3 text-right">Saldo Neto Real</th>
                            <th className="p-3 text-center">Fase de Pago</th>
                            <th className="p-3 text-center">Condición</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {facturasFiltradas.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-slate-400">
                                No se encontraron facturas con los filtros seleccionados.
                              </td>
                            </tr>
                          ) : (
                            facturasFiltradas.map(f => {
                              const mNc = f.monto_nc_aplicado || 0
                              const hasNc = mNc > 0 || (f.ncs_vinculadas && f.ncs_vinculadas.length > 0)
                              const isRetenida = f.requiere_nc || (f.monto_retenido_nc || 0) > 0 || f.bloqueada_para_pago

                              return (
                                <tr key={f.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                  <td className="p-3 font-mono font-bold">
                                    {f.numero_factura}
                                    {f.timbrado && <span className="block text-[10px] text-slate-400 font-normal">Timb: {f.timbrado}</span>}
                                  </td>
                                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{f.fecha_emision}</td>
                                  <td className="p-3 font-mono font-bold">
                                    <span className={f.es_vencida ? "text-red-600" : "text-emerald-600"}>
                                      {f.fecha_vencimiento}
                                    </span>
                                    <span className="block text-[9px] font-medium">
                                      {f.es_vencida ? `+${f.dias_vencido}d vencida` : `${Math.abs(f.dias_vencido)}d restantes`}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {formatPYG(f.total)}
                                  </td>
                                  <td className="p-3 text-center">
                                    {hasNc ? (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black font-mono text-[10px] border border-emerald-300 dark:border-emerald-800">
                                          -{formatPYG(mNc)}
                                        </span>
                                        {f.ncs_vinculadas && f.ncs_vinculadas.length > 0 && (
                                          <span className="text-[9px] text-slate-400 mt-0.5">
                                            {f.ncs_vinculadas.map(a => a.numero_nc).join(", ")}
                                          </span>
                                        )}
                                      </div>
                                    ) : isRetenida ? (
                                      <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-black text-[9px] border border-purple-300 dark:border-purple-800">
                                        Retenida por NC
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">Sin NC</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                                    {formatPYG(f.saldo_neto_real !== undefined ? f.saldo_neto_real : f.saldo_pendiente)}
                                  </td>
                                  <td className="p-3 text-center">
                                    {getFaseBadge(f.fase_pago, f.fase_pago_label)}
                                    {f.lote_pago && (
                                      <span className="block text-[9px] text-indigo-500 font-mono mt-0.5">
                                        {f.lote_pago.nombre}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center text-slate-500 uppercase text-[10px] font-bold">
                                    {f.condicion}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: MONEDERO DE NC & RECLAMOS (CRITICAL REQUIREMENT)
                  ───────────────────────────────────────────────────────────── */}
              {tab === "nc_reclamos" && (
                <div className="space-y-6">
                  {/* Hero Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        Monedero de Notas de Crédito, Reclamos & Devoluciones
                      </h3>
                      <p className="text-xs text-slate-500">
                        Trazabilidad por origen (depósito, promociones, mermas) y control de etapas (Requerimiento → Emitida → Compensada)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf("nc_reclamos")}
                        disabled={downloadingPdfTab !== null}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-500" />
                        <span>Exportar PDF (Monedero & NCs)</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  {/* 🌟 HERO CARDS: MONEDERO & CRÉDITO DEL PROVEEDOR */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Saldo Disponible Monedero */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                          <Wallet className="w-4 h-4" /> Saldo Monedero Disponible
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Etapa 2 (Emitida)
                        </span>
                      </div>
                      <p className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-2">
                        {formatPYG(monedero?.saldo_disponible || 0)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        <b>{monedero?.cantidad_con_saldo || 0} NCs</b> con crédito activo a favor del supermercado
                      </p>
                    </div>

                    {/* Card 2: Requerimientos en Etapa 1 */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" /> Etapa 1: Obligación Pendiente
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Sin NC Emitida
                        </span>
                      </div>
                      <p className="text-2xl font-black font-mono text-amber-700 dark:text-amber-300 mt-2">
                        {formatPYG(monedero?.obligaciones_pendientes_emision || 0)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Reclamos en muelle, promos o mermas pendientes de emisión formal
                      </p>
                    </div>

                    {/* Card 3: Crédito Potencial Total */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent border border-sky-500/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" /> Crédito Potencial Total
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          Consolidado
                        </span>
                      </div>
                      <p className="text-2xl font-black font-mono text-sky-700 dark:text-sky-300 mt-2">
                        {formatPYG(monedero?.credito_total_potencial || 0)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Monedero disponible + Obligaciones pendientes de emisión
                      </p>
                    </div>

                    {/* Card 4: Deuda Neta Real Supermercado */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                          <Layers className="w-4 h-4" /> Deuda Neta Efectiva
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          Post-Monedero
                        </span>
                      </div>
                      <p className="text-2xl font-black font-mono text-purple-700 dark:text-purple-300 mt-2">
                        {formatPYG(kpis?.deuda_neta_efectiva || 0)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Deuda facturada ({formatPYG(kpis?.deuda_total_facturas || 0)}) menos monedero
                      </p>
                    </div>
                  </div>

                  {/* Sub-Tabs de Navegación Interna */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <button
                        onClick={() => setSubTabNc("monedero")}
                        className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition ${
                          subTabNc === "monedero"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Monedero de NCs ({monedero?.items?.length || 0})</span>
                      </button>

                      <button
                        onClick={() => setSubTabNc("etapa1_requerimientos")}
                        className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition ${
                          subTabNc === "etapa1_requerimientos"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Etapa 1: Requerimientos Pendientes ({reclamosFiltrados.length})</span>
                      </button>

                      <button
                        onClick={() => setSubTabNc("devoluciones")}
                        className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition ${
                          subTabNc === "devoluciones"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5 text-sky-500" />
                        <span>Devoluciones Físicas ({monedero?.devoluciones_fisicas?.length || 0})</span>
                      </button>

                      <button
                        onClick={() => setSubTabNc("aplicaciones")}
                        className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition ${
                          subTabNc === "aplicaciones"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Compensaciones a Facturas ({monedero?.aplicaciones_historial?.length || 0})</span>
                      </button>
                    </div>

                    {/* Filtros de Origen y Etapa */}
                    <div className="flex items-center gap-2 text-xs">
                      <select
                        value={filterNcOrigen}
                        onChange={e => setFilterNcOrigen(e.target.value)}
                        className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        <option value="all">Origen: Todos</option>
                        <option value="recepcion_deposito">Recepción en Depósito / Muelle</option>
                        <option value="promociones">Promociones & Rebates</option>
                        <option value="devolucion_merma">Devolución Salón / Mermas</option>
                        <option value="diferencia_precio">Diferencia de Precio</option>
                        <option value="administrativo">Administrativo</option>
                      </select>

                      <select
                        value={filterNcEtapa}
                        onChange={e => setFilterNcEtapa(e.target.value)}
                        className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        <option value="all">Etapa: Todas</option>
                        <option value="1_requerimiento">Etapa 1: Obligación Pendiente</option>
                        <option value="2_emitida_monedero">Etapa 2: NC Emitida en Monedero</option>
                        <option value="3_aplicada_total">Etapa 3: Aplicada Totalmente</option>
                      </select>
                    </div>
                  </div>

                  {/* ── SUBTAB 1: MONEDERO DE NCS EMITIDAS ── */}
                  {subTabNc === "monedero" && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">N° NC Fiscal</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Origen & Motivo</th>
                            <th className="p-3">Factura Origen</th>
                            <th className="p-3 text-right">Monto Original</th>
                            <th className="p-3 text-right">Monto Aplicado</th>
                            <th className="p-3 text-right">Saldo Monedero</th>
                            <th className="p-3 text-center">Etapa & Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {monederoItemsFiltrados.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-slate-400">
                                Sin notas de crédito registradas para los filtros seleccionados.
                              </td>
                            </tr>
                          ) : (
                            monederoItemsFiltrados.map(nc => (
                              <tr key={nc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                  {nc.numero}
                                  {nc.timbrado && <span className="block text-[10px] text-slate-400 font-normal">Timb: {nc.timbrado}</span>}
                                </td>
                                <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{nc.fecha}</td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5">
                                    {getOrigenIcon(nc.origen_clave)}
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{nc.origen_label}</span>
                                  </div>
                                  {nc.motivo && <span className="block text-[10px] text-slate-400 mt-0.5">{nc.motivo}</span>}
                                </td>
                                <td className="p-3 font-mono text-slate-500">{nc.numero_factura_origen}</td>
                                <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {formatPYG(nc.monto_original)}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-500">
                                  {formatPYG(nc.monto_aplicado)}
                                </td>
                                <td className="p-3 text-right font-mono font-black">
                                  <span className={nc.saldo_disponible > 0 ? "text-emerald-600 dark:text-emerald-400 text-sm" : "text-slate-400"}>
                                    {formatPYG(nc.saldo_disponible)}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    nc.saldo_disponible > 0
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  }`}>
                                    {nc.saldo_disponible > 0 ? "Saldo Disponible" : "Agotada"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── SUBTAB 2: ETAPA 1 - REQUERIMIENTOS PENDIENTES ── */}
                  {subTabNc === "etapa1_requerimientos" && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">N° Solicitud</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Origen del Reclamo</th>
                            <th className="p-3">Factura Afectada</th>
                            <th className="p-3 text-right">Monto Reclamado</th>
                            <th className="p-3">NC Fiscal Asignada</th>
                            <th className="p-3 text-center">Etapa Operativa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {reclamosFiltrados.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-400">
                                Sin requerimientos ni reclamos en esta etapa.
                              </td>
                            </tr>
                          ) : (
                            reclamosFiltrados.map(r => {
                              const isPendiente = r.etapa_codigo === "1_requerimiento"
                              return (
                                <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                  <td className="p-3 font-mono font-bold text-rose-600">{r.numero_solicitud}</td>
                                  <td className="p-3 font-mono text-slate-500">{r.created_at}</td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-1.5">
                                      {getOrigenIcon(r.origen_clave || "administrativo")}
                                      <span className="font-bold text-slate-800 dark:text-slate-200">{r.origen_label}</span>
                                    </div>
                                    <span className="block text-[10px] text-slate-400 mt-0.5 capitalize">{r.tipo_motivo.replace(/_/g, " ")}</span>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {r.invoice_numero || "Factura S/N"}
                                  </td>
                                  <td className="p-3 text-right font-mono font-black text-rose-600">
                                    {formatPYG(r.monto_reclamado)}
                                  </td>
                                  <td className="p-3 font-mono font-bold">
                                    {r.nc_recibida_numero ? (
                                      <span className="text-emerald-600 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> {r.nc_recibida_numero}
                                      </span>
                                    ) : (
                                      <span className="text-amber-500 italic">Pendiente emisión</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                      isPendiente
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                                    }`}>
                                      {isPendiente ? "Etapa 1: Obligación Pendiente" : "Etapa 2: NC Emitida"}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── SUBTAB 3: DEVOLUCIONES FÍSICAS EN DEPÓSITO ── */}
                  {subTabNc === "devoluciones" && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">Código Devolución</th>
                            <th className="p-3">Fecha Entrega</th>
                            <th className="p-3">Tipo de Devolución</th>
                            <th className="p-3 text-right">Valor Estimado Gs.</th>
                            <th className="p-3">NC Proveedor</th>
                            <th className="p-3 text-center">Etapa Actual</th>
                            <th className="p-3 text-center">Estado Físico</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {devolucionesFiltradas.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-400">
                                Sin devoluciones físicas registradas en depósito.
                              </td>
                            </tr>
                          ) : (
                            devolucionesFiltradas.map(d => (
                              <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{d.codigo}</td>
                                <td className="p-3 font-mono text-slate-500">{d.fecha}</td>
                                <td className="p-3 capitalize font-bold text-slate-700 dark:text-slate-300">
                                  {d.tipo.replace(/_/g, " ")}
                                </td>
                                <td className="p-3 text-right font-mono font-black text-rose-600">
                                  {formatPYG(d.valor_estimado)}
                                </td>
                                <td className="p-3 font-mono font-bold">
                                  {d.nota_credito_numero ? (
                                    <span className="text-emerald-600">{d.nota_credito_numero}</span>
                                  ) : (
                                    <span className="text-amber-500 italic">Pendiente de NC</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    d.tiene_nc
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  }`}>
                                    {d.tiene_nc ? "Etapa 2: NC Emitida" : "Etapa 1: Obligación Pendiente"}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 uppercase text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                    {d.estado}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── SUBTAB 4: HISTORIAL DE COMPENSACIONES A FACTURAS ── */}
                  {subTabNc === "aplicaciones" && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">Fecha Imputación</th>
                            <th className="p-3">N° NC Utilizada</th>
                            <th className="p-3">Origen / Motivo NC</th>
                            <th className="p-3 text-right">Monto Compensado</th>
                            <th className="p-3">Detalle / Observación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {(!monedero?.aplicaciones_historial || monedero.aplicaciones_historial.length === 0) ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400">
                                Sin compensaciones registradas contra facturas.
                              </td>
                            </tr>
                          ) : (
                            monedero.aplicaciones_historial.map((app, i) => (
                              <tr key={app.id || i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-mono text-slate-500">{app.fecha}</td>
                                <td className="p-3 font-mono font-bold text-emerald-600">{app.numero_nc}</td>
                                <td className="p-3 font-bold text-slate-700 dark:text-slate-300 capitalize">
                                  {app.motivo_nc || app.motivo_categoria || "Compensación"}
                                </td>
                                <td className="p-3 text-right font-mono font-black text-emerald-600">
                                  -{formatPYG(app.monto_aplicado)}
                                </td>
                                <td className="p-3 text-slate-500">{app.observaciones || "Compensación contra factura"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: CHEQUES DIFERIDOS
                  ───────────────────────────────────────────────────────────── */}
              {tab === "cheques" && (
                <div className="space-y-4">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-amber-500" />
                        Cheques Diferidos Emitidos al Proveedor (Pasivo en Tránsito)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Deuda comercial pagada con cheques que aún <b>NO han sido compensados ni debitados</b> de cuentas bancarias.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf("cheques")}
                        disabled={downloadingPdfTab !== null}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-500" />
                        <span>Exportar PDF (Cheques)</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Banner */}
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Monto No Compensado</span>
                        <p className="text-xl font-black font-mono text-amber-600">
                          {formatPYG(kpis?.cheques_diferidos_pendientes_monto || 0)}
                        </p>
                      </div>
                      <div className="pl-4 border-l border-amber-200 dark:border-amber-800">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Total Cheques</span>
                        <p className="text-xl font-black font-mono text-slate-800 dark:text-white">
                          {kpis?.cheques_diferidos_pendientes_count || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">N° Cheque</th>
                          <th className="p-3">Banco Emisor</th>
                          <th className="p-3">Beneficiario</th>
                          <th className="p-3">Fecha Emisión</th>
                          <th className="p-3">Fecha Cobro Diferido</th>
                          <th className="p-3">Días Restantes</th>
                          <th className="p-3 text-right">Monto</th>
                          <th className="p-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {data.cheques.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400">
                              No hay cheques diferidos registrados para este proveedor.
                            </td>
                          </tr>
                        ) : (
                          data.cheques.map(ch => (
                            <tr key={ch.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <td className="p-3 font-mono font-bold text-amber-600">{ch.numero}</td>
                              <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{ch.banco_emisor || "Banco Itaú"}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-400">{ch.beneficiario || s?.razon_social}</td>
                              <td className="p-3 font-mono text-slate-500">{ch.fecha_emision}</td>
                              <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{ch.fecha_pago}</td>
                              <td className="p-3 font-mono font-bold">
                                {ch.dias_restantes >= 0 ? (
                                  <span className={ch.dias_restantes <= 7 ? "text-amber-600" : "text-slate-600 dark:text-slate-400"}>
                                    {ch.dias_restantes} días
                                  </span>
                                ) : (
                                  <span className="text-red-600">Vencido (+{Math.abs(ch.dias_restantes)}d)</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(ch.monto)}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  ch.estado === "compensado"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : ch.estado === "anulado"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}>
                                  {ch.estado}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: HISTORIAL DE PAGOS
                  ───────────────────────────────────────────────────────────── */}
              {tab === "pagos" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        Historial de Pagos & Desembolsos
                      </h3>
                      <p className="text-xs text-slate-500">Registro cronológico de cancelaciones, transferencias SIPAP y órdenes de pago.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf("pagos")}
                        disabled={downloadingPdfTab !== null}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-500" />
                        <span>Exportar PDF (Pagos)</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">Fecha Pago</th>
                          <th className="p-3">Factura Afectada</th>
                          <th className="p-3">Método de Pago</th>
                          <th className="p-3">Comprobante / Referencia</th>
                          <th className="p-3 text-right">Monto Pagado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {data.pagos_historial.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400">
                              Sin registros de pago aplicados directamente.
                            </td>
                          </tr>
                        ) : (
                          data.pagos_historial.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-400">{p.fecha_pago}</td>
                              <td className="p-3 font-mono font-extrabold text-slate-800 dark:text-white">{p.invoice_numero}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold uppercase text-[10px] text-slate-700 dark:text-slate-300">
                                  {p.payment_method.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-slate-500">{p.referencia || "—"}</td>
                              <td className="p-3 text-right font-mono font-black text-emerald-600">{formatPYG(p.monto)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: COMPRAS & RECEPCIONES
                  ───────────────────────────────────────────────────────────── */}
              {tab === "compras" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-rose-500" />
                        Historial de Compras, Órdenes & Recepciones
                      </h3>
                      <p className="text-xs text-slate-500">Control de abastecimiento y remitos de mercadería en muelle</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf("compras")}
                        disabled={downloadingPdfTab !== null}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-500" />
                        <span>Exportar PDF (Compras)</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  {/* Órdenes de Compra */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-rose-500" /> Órdenes de Compra (OCs)
                    </h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">N° Orden</th>
                            <th className="p-3">Fecha Emisión</th>
                            <th className="p-3">Entrega Estimada</th>
                            <th className="p-3">Condición</th>
                            <th className="p-3 text-right">Total Gs.</th>
                            <th className="p-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {data.ordenes_compra.length === 0 ? (
                            <tr><td colSpan={6} className="p-6 text-center text-slate-400">Sin órdenes de compra registradas.</td></tr>
                          ) : (
                            data.ordenes_compra.map(o => (
                              <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-mono font-bold text-rose-600">{o.numero}</td>
                                <td className="p-3 font-mono text-slate-500">{o.fecha}</td>
                                <td className="p-3 font-mono text-slate-600">{o.fecha_entrega_estimada || "—"}</td>
                                <td className="p-3 text-slate-500">{o.condiciones_pago || "Crédito"}</td>
                                <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(o.total)}</td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {o.estado}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recepciones / Remitos en Depósito */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-sky-500" /> Recepciones & Remitos en Depósito
                    </h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">N° Recepción</th>
                            <th className="p-3">Fecha Ingreso</th>
                            <th className="p-3">Remito / Ref. Proveedor</th>
                            <th className="p-3 text-right">Total Recepcionado</th>
                            <th className="p-3 text-center">Control de Muelle</th>
                            <th className="p-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {data.recepciones.length === 0 ? (
                            <tr><td colSpan={6} className="p-6 text-center text-slate-400">Sin remitos de recepción registrados.</td></tr>
                          ) : (
                            data.recepciones.map(r => (
                              <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{r.numero}</td>
                                <td className="p-3 font-mono text-slate-500">{r.fecha}</td>
                                <td className="p-3 font-mono text-slate-600">{r.proveedor_ref || "S/Ref"}</td>
                                <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(r.total)}</td>
                                <td className="p-3 text-center">
                                  {r.requiere_revision ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-700">
                                      Requiere Ajuste / NC
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700">
                                      Conforme
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {r.estado}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: CATÁLOGO & STOCK
                  ───────────────────────────────────────────────────────────── */}
              {tab === "stock" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-sky-500" />
                        Catálogo de Artículos, Stock & Rentabilidad Comercial
                      </h3>
                      <p className="text-xs text-slate-500">
                        {data.productos.length} artículos suministrados · Stock Valorizado: <span className="font-bold text-sky-600">{formatPYG(kpis?.stock_valorizado_costo || 0)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf("stock")}
                        disabled={downloadingPdfTab !== null}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-500" />
                        <span>Exportar PDF (Stock)</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative w-72">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar producto por SKU, nombre o código..."
                      value={searchProducto}
                      onChange={e => setSearchProducto(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">SKU / Barra</th>
                            <th className="p-3">Descripción del Producto</th>
                            <th className="p-3 text-right">Stock Actual</th>
                            <th className="p-3 text-right">PPP (Costo)</th>
                            <th className="p-3 text-right">PVP (Venta)</th>
                            <th className="p-3 text-center">Margen %</th>
                            <th className="p-3 text-right">Ventas 12M</th>
                            <th className="p-3 text-right">Ganancia Bruta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {productosFiltrados.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">Sin productos coincidentes.</td></tr>
                          ) : (
                            productosFiltrados.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-mono text-slate-500">{p.sku || p.codigo_barra || "—"}</td>
                                <td className="p-3 font-bold text-slate-900 dark:text-white">{p.nombre}</td>
                                <td className="p-3 text-right font-mono font-black">
                                  <span className={p.estado_stock === "quiebre" ? "text-red-600" : p.estado_stock === "bajo" ? "text-amber-600" : "text-slate-800 dark:text-slate-200"}>
                                    {p.stock_actual.toFixed(0)} un.
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatPYG(p.costo_promedio)}</td>
                                <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{formatPYG(p.precio_venta)}</td>
                                <td className="p-3 text-center font-bold">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                    p.margen_unitario_pct >= 20 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {p.margen_unitario_pct.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{formatPYG(p.ventas_gs)}</td>
                                <td className="p-3 text-right font-mono font-black text-emerald-600">{formatPYG(p.ganancia_bruta_gs)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: INFORME GERENCIAL NARRATIVO EXTENSO
                  ──────────────────────────────────────────────────────────── */}
              {tab === "informe" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-rose-500" />
                        Dictamen Gerencial Extenso & Diagnóstico Estratégico
                      </h3>
                      <p className="text-xs text-slate-500">Auditoría automática de salud financiera, pasivos, riesgos y rentabilidad</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPdf("informe")}
                        disabled={downloadingPdfTab !== null}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-500" />
                        <span>Exportar PDF (Informe)</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-5">
                    <div className="space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-[11px] mb-1 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-rose-500" />
                          1. Resumen Ejecutivo
                        </h4>
                        <p>{data.informe_gerencial.resumen_ejecutivo}</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-[11px] mb-1 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-500" />
                          2. Diagnóstico de Pasivos, Vencimientos y Cobertura de Cheques Diferidos
                        </h4>
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 mb-2">
                          {data.informe_gerencial.salud_deuda}
                        </span>
                        <p>{data.informe_gerencial.diagnostico_deuda}</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-[11px] mb-1 flex items-center gap-2">
                          <Truck className="w-4 h-4 text-teal-500" />
                          3. Evaluación de Eficiencia Operativa y Abastecimiento
                        </h4>
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase bg-teal-100 text-teal-800 mb-2">
                          {data.informe_gerencial.evaluacion_operativa}
                        </span>
                        <p>{data.informe_gerencial.diagnostico_operativo}</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-[11px] mb-1 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-purple-500" />
                          4. Rentabilidad Comercial y Contribución al Margen
                        </h4>
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase bg-purple-100 text-purple-800 mb-2">
                          {data.informe_gerencial.evaluacion_rentabilidad}
                        </span>
                        <p>{data.informe_gerencial.diagnostico_rentabilidad}</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
                        <h4 className="font-extrabold text-blue-900 dark:text-blue-300 uppercase text-[11px]">
                          5. Recomendaciones Estratégicas para Compras & Tesorería
                        </h4>
                        <ul className="space-y-1.5 list-disc pl-4 text-slate-600 dark:text-slate-300">
                          {data.informe_gerencial.recomendaciones.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
