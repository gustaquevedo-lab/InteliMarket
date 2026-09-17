import React, { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  X, Building2, Download, AlertTriangle, CheckCircle2, Clock,
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, Package,
  FileText, ShieldAlert, CreditCard, RefreshCw, Layers, Eye,
  BarChart3, Calendar, Truck, ArrowUpRight, ArrowDownRight,
  Search, ExternalLink, HelpCircle, Check, Sparkles
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

interface Props {
  supplierId: string
  supplierNombre?: string
  onClose: () => void
}

const TAB_CONFIG: Array<{ key: Tab360; label: string; icon: any }> = [
  { key: "overview", label: "Dashboard 360°", icon: BarChart3 },
  { key: "deudas", label: "Deudas & Facturas (AP)", icon: DollarSign },
  { key: "cheques", label: "Cheques Diferidos", icon: CreditCard },
  { key: "pagos", label: "Historial de Pagos", icon: Clock },
  { key: "compras", label: "Compras & Recepciones", icon: ShoppingCart },
  { key: "nc_reclamos", label: "Reclamos & NC", icon: ShieldAlert },
  { key: "stock", label: "Catálogo & Stock", icon: Package },
  { key: "informe", label: "Informe Gerencial", icon: FileText },
]

export default function Supplier360Modal({ supplierId, supplierNombre, onClose }: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab360>("overview")
  const [data, setData] = useState<Supplier360Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Filtros internos
  const [searchFactura, setSearchFactura] = useState("")
  const [filterVencimiento, setFilterVencimiento] = useState("all")
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

  // Descarga del PDF Premium
  const handleDownloadPdf = async () => {
    if (!data) return
    setDownloadingPdf(true)
    try {
      await api.purchases.downloadSupplier360Pdf(
        supplierId,
        data.supplier.razon_social || supplierNombre || "proveedor"
      )
      toast.success("Informe Gerencial Generado", "Se descargó el PDF con gráficos y auditoría completa.")
    } catch (err: any) {
      toast.error("Error al generar PDF", err.message)
    } finally {
      setDownloadingPdf(false)
    }
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

      return matchText && matchVenc
    })
  }, [data?.facturas, searchFactura, filterVencimiento])

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

  // Aging donut data
  const agingChartData = useMemo(() => {
    if (!aging) return []
    return [
      { name: "Vencido", value: aging.vencido, color: "#ef4444" },
      { name: "1 a 30 Días", value: aging.dias_1_30, color: "#f59e0b" },
      { name: "31 a 60 Días", value: aging.dias_31_60, color: "#3b82f6" },
      { name: "+60 Días", value: aging.dias_mas_60, color: "#94a3b8" },
    ].filter(x => x.value > 0)
  }, [aging])

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-hidden">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-7xl max-h-[96vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">

        {/* 🌟 LUXURY COMMAND HEADER */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950 text-white border-b border-rose-500/20 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-rose-600 to-orange-500 border border-rose-400/30 flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    VISIÓN 360° · PROVEEDOR
                  </span>
                  {s?.ruc && (
                    <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      RUC: {s.ruc}
                    </span>
                  )}
                  {s?.plazo_pago_dias !== undefined && (
                    <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Plazo: {s.plazo_pago_dias}d
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                  {s?.razon_social || supplierNombre || "Cargando proveedor..."}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap font-medium">
                  <span>{s?.contacto_nombre ? `Contacto: ${s.contacto_nombre}` : "Sin contacto asignado"}</span>
                  {s?.telefono && <span>· Tel: {s.telefono}</span>}
                  {s?.banco && <span>· {s.banco} ({s.cuenta_bancaria || "Cta"})</span>}
                </div>
              </div>
            </div>

            {/* Acciones principales y Badges de Pasivo */}
            <div className="flex items-center gap-2.5 flex-wrap self-end md:self-auto">
              <div className="flex flex-col text-right pr-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Exposición Total</span>
                <span className="text-sm font-black font-mono text-rose-300">
                  {kpis ? formatPYG(kpis.exposicion_financiera_total) : "—"}
                </span>
              </div>

              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || loading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-50"
                title="Descargar informe editorial en PDF"
              >
                <Download className={`w-4 h-4 ${downloadingPdf ? "animate-bounce" : ""}`} />
                <span>{downloadingPdf ? "Generando..." : "Descargar PDF"}</span>
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
                  {/* Hero KPIs Grid (8 métricas clave) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    {/* 1. Deuda Facturada */}
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400">Deuda Facturada AP</span>
                        <DollarSign className="w-4 h-4 text-rose-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-rose-700 dark:text-rose-300 mt-1">
                        {formatPYG(kpis?.deuda_total_facturas || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {kpis?.facturas_pendientes_count} facturas pendientes
                      </p>
                    </div>

                    {/* 2. Cheques Diferidos (CRITICAL) */}
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400">Cheques Dif. No Compensados</span>
                        <CreditCard className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-amber-800 dark:text-amber-300 mt-1">
                        {formatPYG(kpis?.cheques_diferidos_pendientes_monto || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {kpis?.cheques_diferidos_pendientes_count} cheques en tránsito bancario
                      </p>
                    </div>

                    {/* 3. Exposición Neta Total */}
                    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400">Exposición Total Neta</span>
                        <Layers className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                        {formatPYG(kpis?.exposicion_financiera_total || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Facturas abiertas + Cheques emitidos
                      </p>
                    </div>

                    {/* 4. Deuda Vencida */}
                    <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-red-600 dark:text-red-400">Deuda Vencida</span>
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-red-700 dark:text-red-300 mt-1">
                        {formatPYG(kpis?.deuda_vencida || 0)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {kpis?.facturas_vencidas_count} vencidas · {formatPYG(kpis?.deuda_al_dia || 0)} al día
                      </p>
                    </div>

                    {/* 5. Stock en Depósito */}
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
                    <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-purple-600 dark:text-purple-400">Margen Bruto (%)</span>
                        <Sparkles className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-purple-700 dark:text-purple-300 mt-1">
                        {kpis?.margen_bruto_pct}%
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Ganancia: {formatPYG(kpis?.ganancia_bruta_monto || 0)}
                      </p>
                    </div>

                    {/* 8. Cumplimiento OTIF */}
                    <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-teal-600 dark:text-teal-400">Cumplimiento Entregas</span>
                        <Truck className="w-4 h-4 text-teal-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-black font-mono text-teal-700 dark:text-teal-300 mt-1">
                        {kpis?.otif_rate}% OTIF
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        DPO efectivo: {kpis?.dpo_promedio_dias} días
                      </p>
                    </div>
                  </div>

                  {/* Diagnóstico Ejecutivo Rápido */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-rose-500" /> Síntesis del Diagnóstico Gerencial
                      </h3>
                      <button onClick={() => setTab("informe")} className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">
                        Ver informe completo <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {data.informe_gerencial.resumen_ejecutivo}
                    </p>
                  </div>

                  {/* Gráficos Recharts */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Evolución Compras vs Pagos (2 cols) */}
                    <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-rose-500" /> Evolución 12 Meses: Compras vs Pagos
                      </h3>
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
                            <XAxis dataKey="label" fontSize={10} />
                            <YAxis fontSize={10} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
                            <Tooltip formatter={(v: any) => formatPYG(v)} />
                            <Legend />
                            <Area type="monotone" dataKey="compras" name="Compras (Gs)" stroke="#f43f5e" fillOpacity={1} fill="url(#colorCompras)" />
                            <Area type="monotone" dataKey="pagos" name="Pagos (Gs)" stroke="#10b981" fillOpacity={1} fill="url(#colorPagos)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Matriz de Antigüedad de Deuda (1 col) */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-500" /> Antigüedad de Deuda (Aging)
                        </h3>
                        <div className="h-44 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={agingChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={65}
                                paddingAngle={3}
                              >
                                {agingChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: any) => formatPYG(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex justify-between font-mono">
                          <span className="text-red-500 font-bold">● Vencido:</span>
                          <span className="font-black">{formatPYG(aging?.vencido || 0)}</span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-amber-500 font-bold">● 1 a 30 Días:</span>
                          <span className="font-black">{formatPYG(aging?.dias_1_30 || 0)}</span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-blue-500 font-bold">● 31 a 60 Días:</span>
                          <span className="font-black">{formatPYG(aging?.dias_31_60 || 0)}</span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400 font-bold">● +60 Días:</span>
                          <span className="font-black">{formatPYG(aging?.dias_mas_60 || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: DEUDAS & FACTURAS (AP)
                  ───────────────────────────────────────────────────────────── */}
              {tab === "deudas" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="relative w-64">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar N° Factura / Timbrado..."
                          value={searchFactura}
                          onChange={e => setSearchFactura(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      <select
                        value={filterVencimiento}
                        onChange={e => setFilterVencimiento(e.target.value)}
                        className="text-xs rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-none font-bold text-slate-700 dark:text-slate-300"
                      >
                        <option value="all">Todas las facturas ({data.facturas.length})</option>
                        <option value="vencidas">Solo Vencidas ({kpis?.facturas_vencidas_count})</option>
                        <option value="al_dia">Al día</option>
                        <option value="pendientes">Con Saldo Pendiente</option>
                      </select>
                    </div>

                    <div className="text-xs font-mono font-bold text-slate-500">
                      Saldo Total: <span className="text-rose-600 font-black">{formatPYG(kpis?.deuda_total_facturas || 0)}</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">N° Factura</th>
                            <th className="p-3">Emisión</th>
                            <th className="p-3">Vencimiento</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3 text-right">Saldo Pendiente</th>
                            <th className="p-3 text-center">Condición</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {facturasFiltradas.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-400">
                                No se encontraron facturas con el criterio seleccionado.
                              </td>
                            </tr>
                          ) : (
                            facturasFiltradas.map(f => (
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
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    f.saldo_pendiente <= 0 ? "bg-emerald-100 text-emerald-700" : f.es_vencida ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {f.saldo_pendiente <= 0 ? "Pagada" : f.es_vencida ? "Vencida" : "Al día"}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatPYG(f.total)}</td>
                                <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">{formatPYG(f.saldo_pendiente)}</td>
                                <td className="p-3 text-center text-slate-500 uppercase text-[10px] font-bold">{f.condicion}</td>
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
                  TAB: CHEQUES DIFERIDOS (CRITICAL REQUIREMENT)
                  ───────────────────────────────────────────────────────────── */}
              {tab === "cheques" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-amber-600" />
                        Cheques Diferidos Emitidos al Proveedor (Pasivo en Tránsito)
                      </h3>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        Deuda comercial pagada con cheques que aún <b>NO han sido compensados ni debitados</b> de nuestras cuentas bancarias.
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Monto No Compensado</span>
                        <p className="text-xl font-black font-mono text-amber-600">
                          {formatPYG(kpis?.cheques_diferidos_pendientes_monto || 0)}
                        </p>
                      </div>
                      <div className="text-right pl-4 border-l border-amber-200 dark:border-amber-800">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Total Cheques</span>
                        <p className="text-xl font-black font-mono text-slate-800 dark:text-white">
                          {kpis?.cheques_diferidos_pendientes_count || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">N° Cheque</th>
                            <th className="p-3">Banco Emisor</th>
                            <th className="p-3">Fecha Emisión</th>
                            <th className="p-3">Fecha Cobro / Vencimiento</th>
                            <th className="p-3">Días Restantes</th>
                            <th className="p-3 text-right">Monto Cheque</th>
                            <th className="p-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {data.cheques.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-400">
                                No se registran cheques emitidos para este proveedor.
                              </td>
                            </tr>
                          ) : (
                            data.cheques.map(c => {
                              const isPend = c.estado === "pendiente" || c.estado === "entregado"
                              const isComp = c.estado === "compensado"
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                  <td className="p-3 font-mono font-black">{c.numero}</td>
                                  <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{c.banco_emisor || "Banco Itaú"}</td>
                                  <td className="p-3 font-mono text-slate-500">{c.fecha_emision}</td>
                                  <td className="p-3 font-mono font-bold text-amber-600">{c.fecha_pago}</td>
                                  <td className="p-3">
                                    {isPend ? (
                                      <span className={`font-mono font-bold ${c.dias_restantes <= 5 ? "text-red-600" : "text-amber-600"}`}>
                                        {c.dias_restantes >= 0 ? `En ${c.dias_restantes} días` : `Vencido (-${Math.abs(c.dias_restantes)}d)`}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">
                                    {formatPYG(c.monto)}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                      isComp ? "bg-emerald-100 text-emerald-700" : isPend ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"
                                    }`}>
                                      {c.estado}
                                    </span>
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
                  TAB: HISTORIAL DE PAGOS
                  ───────────────────────────────────────────────────────────── */}
              {tab === "pagos" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-slate-500">Registro cronológico de cancelaciones, transferencias SIPAP y órdenes de pago.</p>
                    <span className="font-bold">Total Pagado: {formatPYG(kpis?.total_compras_historico || 0)}</span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
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
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: COMPRAS & RECEPCIONES
                  ───────────────────────────────────────────────────────────── */}
              {tab === "compras" && (
                <div className="space-y-6">
                  {/* Órdenes de Compra */}
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-rose-500" /> Órdenes de Compra (OCs)
                    </h3>
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
                    <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-500" /> Recepciones de Mercadería en Depósito
                    </h3>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">N° Remito / Recepción</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Ref. Proveedor</th>
                            <th className="p-3 text-right">Total Recepcionado</th>
                            <th className="p-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {data.recepciones.length === 0 ? (
                            <tr><td colSpan={5} className="p-6 text-center text-slate-400">Sin recepciones registradas.</td></tr>
                          ) : (
                            data.recepciones.map(r => (
                              <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-mono font-bold">{r.numero}</td>
                                <td className="p-3 font-mono text-slate-500">{r.fecha}</td>
                                <td className="p-3 text-slate-500">{r.proveedor_ref || "—"}</td>
                                <td className="p-3 text-right font-mono font-black">{formatPYG(r.total)}</td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
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
                  TAB: RECLAMOS & NOTAS DE CRÉDITO
                  ───────────────────────────────────────────────────────────── */}
              {tab === "nc_reclamos" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-slate-500">Control de devoluciones por averías, diferencias de precio y regularizaciones de NC.</p>
                    <span className="font-bold text-amber-600">
                      Reclamos Pendientes: {formatPYG(kpis?.reclamos_nc_pendientes_monto || 0)}
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">N° Solicitud</th>
                          <th className="p-3">Factura Afectada</th>
                          <th className="p-3">Motivo Reclamo</th>
                          <th className="p-3 text-right">Monto Reclamado</th>
                          <th className="p-3">N° NC Fiscal Recibida</th>
                          <th className="p-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {data.reclamos_nc.length === 0 ? (
                          <tr><td colSpan={6} className="p-8 text-center text-slate-400">Sin reclamos de notas de crédito registrados.</td></tr>
                        ) : (
                          data.reclamos_nc.map(n => (
                            <tr key={n.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <td className="p-3 font-mono font-bold text-rose-600">{n.numero_solicitud}</td>
                              <td className="p-3 font-mono font-bold">{n.invoice_numero}</td>
                              <td className="p-3 capitalize">{n.tipo_motivo.replace(/_/g, " ")}</td>
                              <td className="p-3 text-right font-mono font-black text-rose-600">{formatPYG(n.monto_reclamado)}</td>
                              <td className="p-3 font-mono font-bold text-emerald-600">
                                {n.nc_recibida_numero || <span className="text-amber-500 font-normal italic">Pendiente de emisión</span>}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  n.estado === "resuelta" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                }`}>
                                  {n.estado.replace(/_/g, " ")}
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
                  TAB: CATÁLOGO & STOCK
                  ───────────────────────────────────────────────────────────── */}
              {tab === "stock" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative w-64">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar artículo por nombre / SKU..."
                        value={searchProducto}
                        onChange={e => setSearchProducto(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono font-bold">
                      <span>Total Stock: <b className="text-sky-600">{kpis?.stock_unidades_total?.toFixed(0)} un</b></span>
                      <span>Valorización: <b className="text-slate-900 dark:text-white">{formatPYG(kpis?.stock_valorizado_costo || 0)}</b></span>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">SKU / Código</th>
                          <th className="p-3">Descripción del Producto</th>
                          <th className="p-3 text-right">Stock Actual</th>
                          <th className="p-3 text-right">Costo PPP</th>
                          <th className="p-3 text-right">PVP (Venta)</th>
                          <th className="p-3 text-right">Margen</th>
                          <th className="p-3 text-right">Ventas 12M</th>
                          <th className="p-3 text-center">Estado Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {productosFiltrados.length === 0 ? (
                          <tr><td colSpan={8} className="p-8 text-center text-slate-400">Sin productos coincidentes.</td></tr>
                        ) : (
                          productosFiltrados.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <td className="p-3 font-mono font-bold text-slate-500">{p.sku || p.codigo_barra || "—"}</td>
                              <td className="p-3 font-extrabold text-slate-900 dark:text-white">{p.nombre}</td>
                              <td className="p-3 text-right font-mono font-black">{p.stock_actual.toFixed(0)} un</td>
                              <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatPYG(p.costo_promedio)}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(p.precio_venta)}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600">{p.margen_unitario_pct.toFixed(1)}%</td>
                              <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(p.ventas_gs)}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  p.estado_stock === "quiebre" ? "bg-red-100 text-red-700" : p.estado_stock === "bajo" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {p.estado_stock}
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
                  TAB: INFORME GERENCIAL EXTENSO
                  ───────────────────────────────────────────────────────────── */}
              {tab === "informe" && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-6">
                    <div className="border-b border-slate-200 dark:border-slate-700 pb-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-500">AUDITORÍA INTEGRAL DE PROVEEDOR</span>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                          Informe Técnico-Gerencial: {s?.razon_social}
                        </h3>
                      </div>
                      <button
                        onClick={handleDownloadPdf}
                        className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center gap-2 hover:bg-rose-500 transition shadow-md"
                      >
                        <Download className="w-4 h-4" /> Descargar PDF
                      </button>
                    </div>

                    <div className="space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-[11px] mb-1">
                          1. Resumen Ejecutivo de la Cuenta Comercial
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
