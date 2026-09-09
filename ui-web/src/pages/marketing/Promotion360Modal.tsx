import React, { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  X, Sparkles, TrendingUp, TrendingDown, DollarSign, Package,
  Users, BarChart3, FileText, Download, Printer, ShieldCheck,
  AlertCircle, CheckCircle2, Clock, Calendar, ArrowRight,
  HelpCircle, ChevronRight, Tag, Percent, RefreshCw, Loader2, Store,
  Building2, Receipt, Award, Share2
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts"
import { api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

interface Promotion360ModalProps {
  promoId: string
  onClose: () => void
  onUpdate?: () => void
}

type TabType = "finanzas" | "graficos" | "clientes" | "ia" | "informe_encargados"

export const Promotion360Modal: React.FC<Promotion360ModalProps> = ({
  promoId,
  onClose,
  onUpdate
}) => {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>("finanzas")
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingProductsPdf, setDownloadingProductsPdf] = useState(false)
  const [data, setData] = useState<any>(null)
  const [clientSearch, setClientSearch] = useState("")

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.promotions.analytics360(promoId)
      setData(res)
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Error al cargar Visión 360°",
        message: err?.message || "No se pudieron obtener los datos analíticos de la promoción"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (promoId) {
      loadData()
    }
  }, [promoId])

  // Filtrado de clientes en Tab 3
  const filteredClients = useMemo(() => {
    if (!data?.top_clientes) return []
    if (!clientSearch.trim()) return data.top_clientes
    const q = clientSearch.toLowerCase()
    return data.top_clientes.filter((c: any) =>
      (c.nombre && c.nombre.toLowerCase().includes(q)) ||
      (c.ruc && c.ruc.toLowerCase().includes(q))
    )
  }, [data?.top_clientes, clientSearch])

  // Descarga del Informe Oficial PDF
  const handleDownloadReportPdf = async () => {
    if (!data) return
    setDownloadingPdf(true)
    try {
      await api.promotions.downloadReportPdf(promoId, data.nombre)
      addToast({
        type: "success",
        title: "Informe Generado",
        message: "El informe oficial para encargados se descargó con éxito."
      })
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Error de Descarga",
        message: err?.message || "No se pudo generar el documento PDF"
      })
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Descarga de la Lista de Productos en PDF A4 Horizontal (landscape)
  const handleDownloadProductsPdf = async () => {
    if (!data) return
    setDownloadingProductsPdf(true)
    try {
      await api.promotions.downloadProductsReportPdf(promoId, data.nombre)
      addToast({
        type: "success",
        title: "Lista Descargada",
        message: "La lista de productos en formato A4 horizontal se descargó con éxito."
      })
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Error de Descarga",
        message: err?.message || "No se pudo generar el PDF de productos"
      })
    } finally {
      setDownloadingProductsPdf(false)
    }
  }

  // Impresión directa del informe
  const handlePrint = () => {
    window.print()
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER SUPERIOR */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {data?.nombre || "Detalle de Promoción 360°"}
                </h2>
                {data && (
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                      data.activo
                        ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-slate-700/30 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {data.activo ? "Vigente / Activa" : "Pausada"}
                  </span>
                )}
                {data?.tipo && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300">
                    {data.tipo.replace(/_/g, " ").toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Vigencia: {data?.valido_desde} al {data?.valido_hasta}</span>
                {data?.supplier_nombre && (
                  <>
                    <span>•</span>
                    <span className="text-amber-700 dark:text-amber-300/90 font-medium">Prov: {data.supplier_nombre}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadReportPdf}
              disabled={downloadingPdf || loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition"
              title="Descargar Ficha e Informe para Encargados en PDF"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Descargar PDF Oficial</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shrink-0 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab("finanzas")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "finanzas"
                ? "border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Finanzas & Trade Spend</span>
          </button>
          <button
            onClick={() => setActiveTab("graficos")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "graficos"
                ? "border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Gráficos de Desempeño</span>
          </button>
          <button
            onClick={() => setActiveTab("clientes")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "clientes"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Padrón de Clientes ({data?.top_clientes?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("ia")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "ia"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Trade Intelligence (IA)</span>
          </button>
          <button
            onClick={() => setActiveTab("informe_encargados")}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "informe_encargados"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Informe para Encargados (Salón y Cajas)</span>
          </button>
        </div>

        {/* CUERPO DEL MODAL (CON SCROLL INDEPENDIENTE) */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-sm">Consolidando métricas comerciales y financieras...</p>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-500 dark:text-slate-400">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <p className="text-sm">No se encontraron datos para esta promoción.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: FINANZAS & TRADE SPEND */}
              {activeTab === "finanzas" && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Venta Neta Promoción</span>
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {formatPYG(data.total_ventas_promo_pyg)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <span>Reg. teórico:</span>
                        <span className="line-through">{formatPYG(data.total_ventas_regular_pyg)}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Descuento Total Cedido</span>
                        <Tag className="w-4 h-4 text-rose-500" />
                      </div>
                      <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                        {formatPYG(data.total_descuento_cedido_pyg)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        En {data.unidades_totales_vendidas || 0} un. bonificadas
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Aporte Proveedor (Scan-Back)</span>
                        <ShieldCheck className="w-4 h-4 text-cyan-500" />
                      </div>
                      <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
                        {formatPYG(data.total_nc_scanback_pyg)}
                      </div>
                      <div className="text-[11px] text-cyan-700 dark:text-cyan-300/80 mt-1">
                        Subsidia el {data.total_descuento_cedido_pyg > 0 ? ((data.total_nc_scanback_pyg / data.total_descuento_cedido_pyg) * 100).toFixed(0) : 0}% del descuento
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Margen Neto Real (c/ Scan-Back)</span>
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                        {data.margen_bruto_real_pct}%
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-1">
                        {formatPYG(data.margen_bruto_real_pyg)} de ganancia bruta
                      </div>
                    </div>
                  </div>

                  {/* Trade Marketing Split & Desglose Operativo */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Barra de Co-Financiamiento */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 lg:col-span-2">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        Reparto Financiero de la Bonificación (Trade Spend)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Distribución del esfuerzo promocional entre el aporte del proveedor (vía Nota de Crédito) y la asunción directa de la tienda.
                      </p>

                      <div className="space-y-3">
                        <div className="h-6 w-full rounded-lg overflow-hidden flex bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                          <div
                            style={{
                              width: `${
                                data.total_descuento_cedido_pyg > 0
                                  ? (data.total_nc_scanback_pyg / data.total_descuento_cedido_pyg) * 100
                                  : 50
                              }%`
                            }}
                            className="bg-cyan-500 flex items-center justify-center text-[10px] font-bold text-white px-2 truncate transition-all"
                            title="Aporte Proveedor Scan-Back"
                          >
                            Proveedor: {formatPYG(data.total_nc_scanback_pyg)}
                          </div>
                          <div
                            style={{
                              width: `${
                                data.total_descuento_cedido_pyg > 0
                                  ? (data.total_aporte_tienda_pyg / data.total_descuento_cedido_pyg) * 100
                                  : 50
                              }%`
                            }}
                            className="bg-amber-500 flex items-center justify-center text-[10px] font-bold text-slate-950 px-2 truncate transition-all"
                            title="Aporte Supermercado"
                          >
                            Tienda: {formatPYG(data.total_aporte_tienda_pyg)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                          <div className="p-3 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 rounded-lg">
                            <span className="text-cyan-700 dark:text-cyan-400 font-semibold block">Aporte Proveedor</span>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">{formatPYG(data.total_nc_scanback_pyg)}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Recuperable mediante Nota de Crédito</span>
                          </div>
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                            <span className="text-amber-700 dark:text-amber-400 font-semibold block">Aporte Extra Supermercado</span>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">{formatPYG(data.total_aporte_tienda_pyg)}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Sacrificio de margen de salón</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPIs de Cajas & Tickets */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-500" />
                        Impacto en Salón y Cajas
                      </h3>
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Tickets con la promoción:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{data.tickets_totales_count || 0}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Unidades facturadas:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{data.unidades_totales_vendidas || 0} un.</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Ticket medio promocional:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{formatPYG(data.ticket_promedio_promo_pyg)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Uplift de rotación estimado:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">+{data.uplift_rotacion_pct || 0}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ranking de Productos Participantes */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      Rendimiento Individual de Productos en la Campaña
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">Producto</th>
                            <th className="py-2.5 px-3">Código</th>
                            <th className="py-2.5 px-3 text-right">Costo Ref.</th>
                            <th className="py-2.5 px-3 text-right">P. Regular</th>
                            <th className="py-2.5 px-3 text-right">P. Promo</th>
                            <th className="py-2.5 px-3 text-right">Un. Vendidas</th>
                            <th className="py-2.5 px-3 text-right">Facturación</th>
                            <th className="py-2.5 px-3 text-right">Margen Bruto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {data.ranking_productos?.length > 0 ? (
                            data.ranking_productos.map((p: any) => (
                              <tr key={p.producto_id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition">
                                <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{p.nombre}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">{p.codigo_barra || "—"}</td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">{formatPYG(p.costo_promedio)}</td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">{formatPYG(p.precio_regular)}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">{formatPYG(p.precio_promocional)}</td>
                                <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">{p.unidades_vendidas}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatPYG(p.total_ventas_pyg)}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                  <span className={p.margen_pct >= 15 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                                    {p.margen_pct}% ({formatPYG(p.margen_bruto_pyg)})
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="py-4 text-center text-slate-500">
                                No hay productos con ventas registradas en esta campaña todavía.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GRÁFICOS DE DESEMPEÑO */}
              {activeTab === "graficos" && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="bg-slate-100/60 dark:bg-slate-100 dark:bg-slate-800/60 border border-slate-300/80 dark:border-slate-300 dark:border-slate-700/80 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Curva Diaria de Ventas Promocionales (Gs.)</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Evolución de facturación real vs unidades vendidas por día</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                          <span className="text-slate-600 dark:text-slate-300">Ventas Promo (Gs.)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                          <span className="text-slate-600 dark:text-slate-300">Descuento Cedido (Gs.)</span>
                        </div>
                      </div>
                    </div>

                    {data.evolucion_diaria?.length > 0 ? (
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.evolucion_diaria}>
                            <defs>
                              <linearGradient id="colorPromo" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                              </linearGradient>
                              <linearGradient id="colorDesc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                              dataKey="fecha"
                              stroke="#94a3b8"
                              tick={{ fontSize: 11 }}
                              tickFormatter={(val) => val.slice(5)}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              tick={{ fontSize: 11 }}
                              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }}
                              formatter={(value: any) => [formatPYG(value), ""]}
                              labelFormatter={(label) => `Fecha: ${label}`}
                            />
                            <Area
                              type="monotone"
                              dataKey="total_ventas_pyg"
                              name="Venta Promo"
                              stroke="#10b981"
                              fillOpacity={1}
                              fill="url(#colorPromo)"
                            />
                            <Area
                              type="monotone"
                              dataKey="descuento_otorgado_pyg"
                              name="Descuento"
                              stroke="#f59e0b"
                              fillOpacity={1}
                              fill="url(#colorDesc)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                        Aún no se han consolidado ventas diarias en el período de la promoción.
                      </div>
                    )}
                  </div>

                  {/* Desglose de Medios de Pago */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
                      Medios de Pago Utilizados en los Tickets de la Campaña
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {data.desglose_medios_pago?.length > 0 ? (
                        data.desglose_medios_pago.map((mp: any) => (
                          <div key={mp.forma_pago} className="p-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-lg shadow-2xs">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">{mp.forma_pago}</span>
                            <span className="text-base font-black text-slate-900 dark:text-white">{formatPYG(mp.monto)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-4 text-xs text-slate-500 py-2">
                          No hay transacciones discriminadas por medio de pago aún.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PADRÓN DE CLIENTES */}
              {activeTab === "clientes" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Padrón de Clientes Compradores ({filteredClients.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Historial de clientes y tickets que aprovecharon las condiciones promocionales
                      </p>
                    </div>
                    <div className="w-72">
                      <input
                        type="text"
                        placeholder="Buscar por RUC o Razón Social..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">Cliente / Razón Social</th>
                          <th className="py-2.5 px-3">RUC / Cédula</th>
                          <th className="py-2.5 px-3 text-right">Tickets</th>
                          <th className="py-2.5 px-3 text-right">Unidades</th>
                          <th className="py-2.5 px-3 text-right">Total Facturado</th>
                          <th className="py-2.5 px-3 text-right">Ahorro Obtenido</th>
                          <th className="py-2.5 px-3 text-center">Última Compra</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((c: any, idx: number) => (
                            <tr key={c.cliente_id || idx} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{c.nombre}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">{c.ruc || "—"}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200">{c.cantidad_tickets}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{c.unidades_compradas} un.</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(c.total_gastado_pyg)}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">{formatPYG(c.descuento_obtenido_pyg)}</td>
                              <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400">{c.ultimo_ticket_fecha || "—"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-500">
                              No se encontraron clientes compradores con ese criterio de búsqueda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: TRADE INTELLIGENCE (IA) */}
              {activeTab === "ia" && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Score Card */}
                  <div className="bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 dark:from-purple-950/40 dark:via-slate-800/60 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-800/40 rounded-xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-600 dark:text-purple-300">
                        <Sparkles className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            Evaluación Comercial de la Campaña (Trade Marketing AI)
                          </h3>
                          <span className="text-xs uppercase font-black px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/30 text-purple-700 dark:text-purple-200 border border-purple-300 dark:border-purple-400/40">
                            {data.trade_intelligence?.calificacion_general || "Muy Buena"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Diagnóstico algorítmico sobre rotación, blindaje de margen y poder de negociación de compra
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Índice de Eficiencia</span>
                      <span className="text-3xl font-black text-purple-700 dark:text-purple-300">
                        {data.trade_intelligence?.score_eficiencia || 85}
                        <span className="text-base font-normal text-slate-400">/100</span>
                      </span>
                    </div>
                  </div>

                  {/* Resumen Ejecutivo & Elasticidad */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Resumen Ejecutivo & Rotación
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {data.trade_intelligence?.resumen_ejecutivo}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-amber-500" />
                        Elasticidad de Precio & Comportamiento del Consumidor
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {data.trade_intelligence?.analisis_elasticidad}
                      </p>
                    </div>
                  </div>

                  {/* Blindaje de Margen y Negociación */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-4 h-4 text-cyan-500" />
                        Blindaje Financiero de Margen (Scan-Back)
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {data.trade_intelligence?.analisis_margen}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                        <Store className="w-4 h-4 text-indigo-500" />
                        Recomendación Táctica para Negociación de Compra
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {data.trade_intelligence?.recomendacion_proveedor}
                      </p>
                    </div>
                  </div>

                  {/* Bullets clave */}
                  {data.trade_intelligence?.puntos_clave?.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Puntos Críticos de Gestión:</h4>
                      <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {data.trade_intelligence.puntos_clave.map((pt: string, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: INFORME OFICIAL PARA ENCARGADOS */}
              {activeTab === "informe_encargados" && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Barra de Acciones del Informe */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-500" />
                        Informe Técnico & Ficha Operativa para Salón y Cajas
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Documento oficial membretado con especificaciones para Encargado de Salón, Repositores y Cajeras.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadReportPdf}
                        disabled={downloadingPdf}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition"
                      >
                        {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span>Descargar PDF Oficial</span>
                      </button>
                    </div>
                  </div>

                  {/* Simulación Visual de la Ficha Membretada */}
                  <div className="bg-white text-slate-900 rounded-xl p-6 shadow-xl border border-slate-300 space-y-5 text-xs font-sans">
                    {/* Encabezado Ficha */}
                    <div className="border-b-2 border-slate-200 dark:border-slate-800 pb-3 flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                          GRUPO SANTA TERESA E.A.S.
                        </h2>
                        <h3 className="text-xs font-bold text-emerald-700 uppercase">
                          EXTRA SUPERMERCADO MAYORISTA
                        </h3>
                        <p className="text-[11px] text-slate-600">
                          RUC: 80150377-9 • Timbrado Oficial: 18545636 • Alejo García esq. Carlos A. López
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase px-2.5 py-1 bg-amber-100 text-amber-900 rounded border border-amber-300 inline-block">
                          DIRECTIVA COMERCIAL N° PROMO-{promoId.slice(0, 8).toUpperCase()}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Emisión: {new Date().toLocaleDateString("es-PY")} (Hora Asunción)
                        </p>
                      </div>
                    </div>

                    {/* Ficha Técnica */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Campaña</span>
                        <span className="font-bold text-xs">{data.nombre}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Vigencia</span>
                        <span className="font-semibold text-xs">{data.valido_desde} al {data.valido_hasta}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Mecánica</span>
                        <span className="font-semibold text-xs capitalize">{data.tipo.replace(/_/g, " ")}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Proveedor</span>
                        <span className="font-semibold text-xs">{data.supplier_nombre || "Propio (Tienda)"}</span>
                      </div>
                    </div>

                    {/* Instrucciones de Salón y Cajas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-950">
                        <h4 className="font-bold text-xs flex items-center gap-1.5 mb-1 text-blue-900">
                          <Store className="w-3.5 h-3.5" />
                          PAUTAS PARA ENCARGADO DE SALÓN & REPOSITORES
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-900/90 leading-relaxed">
                          <li>Colocar cartelera amarilla promocional visible destacando el precio oferta.</li>
                          <li>Exhibir prioritariamente en cabecera de góndola o isla central de alto tránsito.</li>
                          <li>Cotejar número de lote y fecha de vencimiento física antes de la reposición.</li>
                          <li>Asegurar stock permanente durante los horarios pico de compra.</li>
                        </ul>
                      </div>

                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950">
                        <h4 className="font-bold text-xs flex items-center gap-1.5 mb-1 text-emerald-900">
                          <Receipt className="w-3.5 h-3.5" />
                          DIRECTIVAS PARA CAJERAS Y SUPERVISOR DE CAJAS
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-900/90 leading-relaxed">
                          <li>El descuento se aplica automáticamente por sistema POS al escanear el código.</li>
                          <li>Verificar límite de unidades permitidas por ticket si está parametrizado.</li>
                          <li>La promoción aplica con cualquier medio de pago habilitado (Efectivo, Tarjeta, QR, PIX).</li>
                          <li>Ante cualquier rechazo de código en caja, contactar de inmediato a Sistemas.</li>
                        </ul>
                      </div>
                    </div>

                    {/* Tabla de Productos Detallados */}
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 mb-2 uppercase">
                        Artículos Incluidos en la Promoción
                      </h4>
                      <div className="border border-slate-300 rounded-lg overflow-hidden">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                            <tr>
                              <th className="py-2 px-3">Código de Barra</th>
                              <th className="py-2 px-3">Descripción del Producto</th>
                              <th className="py-2 px-3 text-right">Precio Regular</th>
                              <th className="py-2 px-3 text-right">Precio Promocional</th>
                              <th className="py-2 px-3 text-right">Descuento</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-800">
                            {data.ranking_productos?.length > 0 ? (
                              data.ranking_productos.map((p: any) => (
                                <tr key={p.producto_id}>
                                  <td className="py-1.5 px-3 font-mono font-bold text-slate-900">{p.codigo_barra || "—"}</td>
                                  <td className="py-1.5 px-3 font-semibold text-slate-900">{p.nombre}</td>
                                  <td className="py-1.5 px-3 text-right font-mono line-through text-slate-500">{formatPYG(p.precio_regular)}</td>
                                  <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-700">{formatPYG(p.precio_promocional)}</td>
                                  <td className="py-1.5 px-3 text-right font-mono font-semibold text-rose-600">-{formatPYG(p.precio_regular - p.precio_promocional)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-3 text-center text-slate-500 dark:text-slate-400">
                                  No hay productos asociados en esta ficha.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Bloque de Firmas */}
                    <div className="pt-8 grid grid-cols-3 gap-6 text-center text-[10px] text-slate-600">
                      <div className="border-t border-slate-400 pt-1.5">
                        <span className="font-bold text-slate-800 block">Encargado de Salón / Cajas</span>
                        <span>Recepción de Directiva Operativa</span>
                      </div>
                      <div className="border-t border-slate-400 pt-1.5">
                        <span className="font-bold text-slate-800 block">Gerencia Comercial</span>
                        <span>Aprobación de Política de Precio</span>
                      </div>
                      <div className="border-t border-slate-400 pt-1.5">
                        <span className="font-bold text-slate-800 block">Proveedor / Representante</span>
                        <span>Acuerdo de Scan-Back / Aporte</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER INFERIOR */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Extra Supermercado Mayorista • Módulo de Gestión Comercial y Trade Marketing
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReportPdf}
              disabled={downloadingPdf || loading}
              className="hover:text-emerald-400 transition flex items-center gap-1 font-medium"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Descargar Informe Oficial PDF
            </button>
            <span>•</span>
            <button
              onClick={handleDownloadProductsPdf}
              disabled={downloadingProductsPdf || loading}
              className="hover:text-violet-400 transition flex items-center gap-1 font-medium"
              title="Lista de productos en A4 horizontal (landscape)"
            >
              {downloadingProductsPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Lista A4 Horizontal
            </button>
            <span>•</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-lg transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
