import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Calendar, FileSpreadsheet, FileText, RefreshCcw, Loader2, ArrowUpDown,
  ArrowUp, ArrowDown, DollarSign, TrendingUp, ShoppingCart, Percent,
  Eye, CalendarDays, ArrowRight, Layers, Award
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface ConsolidadoDiarioTabProps {
  onVerDetalleDia: (fecha: string) => void
}

type SortField =
  | "dia"
  | "tickets"
  | "total_skus"
  | "unidades_vendidas"
  | "total_venta"
  | "total_costo"
  | "margen_bruto_gs"
  | "margen_bruto_pct"
  | "ticket_promedio"
  | "ppp_promedio"
  | "total_descuento"

export default function ConsolidadoDiarioTab({ onVerDetalleDia }: ConsolidadoDiarioTabProps) {
  const toast = useToast()

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  const firstDayMonthStr = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]
  }, [])

  const [preset, setPreset] = useState<"mes" | "mes_ant" | "7d" | "30d" | "custom">("mes")
  const [fechaDesde, setFechaDesde] = useState<string>(firstDayMonthStr)
  const [fechaHasta, setFechaHasta] = useState<string>(todayStr)

  const [loading, setLoading] = useState(false)
  const [downloadingXlsx, setDownloadingXlsx] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const [data, setData] = useState<any>(null)

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>("dia")
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  const handlePresetChange = (p: "mes" | "mes_ant" | "7d" | "30d" | "custom") => {
    setPreset(p)
    const now = new Date()
    if (p === "mes") {
      setFechaDesde(firstDayMonthStr)
      setFechaHasta(todayStr)
    } else if (p === "mes_ant") {
      const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      const prevMonthFirstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const f1 = prevMonthFirstDay.toISOString().split("T")[0]
      const f2 = prevMonthLastDay.toISOString().split("T")[0]
      setFechaDesde(f1)
      setFechaHasta(f2)
    } else if (p === "7d") {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      setFechaDesde(d.toISOString().split("T")[0])
      setFechaHasta(todayStr)
    } else if (p === "30d") {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      setFechaDesde(d.toISOString().split("T")[0])
      setFechaHasta(todayStr)
    }
  }

  const fetchConsolidado = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.reports.salesDailyConsolidation({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      setData(res)
    } catch (err: any) {
      toast.error("Error al cargar consolidado", err.message || "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, toast])

  useEffect(() => {
    fetchConsolidado()
  }, [fetchConsolidado])

  // Ordenar días
  const sortedDias = useMemo(() => {
    if (!data?.dias) return []
    const list = [...data.dias]

    list.sort((a: any, b: any) => {
      let valA = a[sortField] ?? 0
      let valB = b[sortField] ?? 0
      if (typeof valA === "string") valA = valA.toLowerCase()
      if (typeof valB === "string") valB = valB.toLowerCase()

      if (valA < valB) return sortAsc ? -1 : 1
      if (valA > valB) return sortAsc ? 1 : -1
      return 0
    })

    return list
  }, [data?.dias, sortField, sortAsc])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 ml-1 inline" />
    }
    return sortAsc ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-500 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-500 ml-1 inline" />
    )
  }

  // Exportar Excel
  const handleExportXlsx = async () => {
    setDownloadingXlsx(true)
    try {
      await api.reports.downloadSalesDailyConsolidationXlsx({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      toast.success("Excel descargado", `Consolidado diario ${fechaDesde} al ${fechaHasta}`)
    } catch (err: any) {
      toast.error("Error al exportar Excel", err.message || "Error desconocido")
    } finally {
      setDownloadingXlsx(false)
    }
  }

  // Exportar PDF Premium
  const handleExportPdf = async () => {
    setDownloadingPdf(true)
    try {
      await api.reports.downloadSalesDailyConsolidationPdf({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      toast.success("PDF generado exitosamente", `Consolidado diario ${fechaDesde} al ${fechaHasta}`)
    } catch (err: any) {
      toast.error("Error al generar PDF", err.message || "Error desconocido")
    } finally {
      setDownloadingPdf(false)
    }
  }

  const resumen = data?.resumen || {}

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── BARRA DE CONTROLES Y RANGO DE FECHAS ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        {/* Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline">Período:</span>
          <button
            onClick={() => handlePresetChange("mes")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              preset === "mes"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => handlePresetChange("mes_ant")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              preset === "mes_ant"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Mes Anterior
          </button>
          <button
            onClick={() => handlePresetChange("7d")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              preset === "7d"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Últimos 7 Días
          </button>
          <button
            onClick={() => handlePresetChange("30d")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              preset === "30d"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Últimos 30 Días
          </button>
        </div>

        {/* Inputs de fecha y botones */}
        <div className="flex items-center gap-3 flex-wrap justify-start xl:justify-end">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1.5 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-500 font-medium pl-1.5">Desde:</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value)
                setPreset("custom")
              }}
              className="bg-transparent font-bold font-mono text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            />
            <span className="text-slate-400">→</span>
            <span className="text-slate-500 font-medium">Hasta:</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value)
                setPreset("custom")
              }}
              className="bg-transparent font-bold font-mono text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchConsolidado}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={downloadingPdf || loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-black shadow-md shadow-red-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Descargar consolidado PDF Premium"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              PDF Premium
            </button>
            <button
              onClick={handleExportXlsx}
              disabled={downloadingXlsx || loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Descargar Consolidado Excel (.xlsx)"
            >
              {downloadingXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIS DEL PERÍODO CONSOLIDADO ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>Días Evaluados</span>
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">
            {resumen.total_dias || 0}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Días con ventas
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>Tickets Período</span>
            <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">
            {Number(resumen.total_tickets || 0).toLocaleString("es-PY")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            T. Prom: {formatPYG(resumen.ticket_promedio || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Total Facturado</span>
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatPYG(resumen.total_venta || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Prom/Día: {formatPYG(resumen.promedio_venta_diaria || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Costo Mercadería</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
            {formatPYG(resumen.total_costo || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            CMV acumulado
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Margen Bruto</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {formatPYG(resumen.margen_bruto_gs || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Venta - Costo
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-teal-600 dark:text-teal-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Margen Ponderado</span>
            <Percent className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black font-mono text-teal-600 dark:text-teal-400 mt-1">
            {Number(resumen.margen_bruto_pct || 0).toFixed(2)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            PPP: {formatPYG(resumen.ppp_global || 0)}
          </p>
        </div>
      </div>

      {/* ── TABLA CONSOLIDADA POR DÍA ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              Listado Consolidado Día por Día
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {sortedDias.length} días
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {fechaDesde} al {fechaHasta}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[620px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-white text-[11px] font-bold uppercase tracking-wider sticky top-0 z-20 shadow-md">
              <tr>
                <th
                  onClick={() => handleSort("dia")}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-900 transition"
                >
                  Fecha (Día) {renderSortIcon("dia")}
                </th>
                <th className="py-3 px-3">Día Semana</th>
                <th
                  onClick={() => handleSort("tickets")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition"
                >
                  Tickets {renderSortIcon("tickets")}
                </th>
                <th
                  onClick={() => handleSort("total_skus")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition"
                >
                  SKUs {renderSortIcon("total_skus")}
                </th>
                <th
                  onClick={() => handleSort("unidades_vendidas")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition"
                >
                  Unid. / KG {renderSortIcon("unidades_vendidas")}
                </th>
                <th
                  onClick={() => handleSort("total_venta")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-emerald-300"
                >
                  Facturación (Gs.) {renderSortIcon("total_venta")}
                </th>
                <th
                  onClick={() => handleSort("total_costo")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-slate-300"
                >
                  CMV Costo {renderSortIcon("total_costo")}
                </th>
                <th
                  onClick={() => handleSort("margen_bruto_gs")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-amber-300"
                >
                  Margen Bruto (Gs.) {renderSortIcon("margen_bruto_gs")}
                </th>
                <th
                  onClick={() => handleSort("margen_bruto_pct")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-teal-300"
                >
                  % Margen {renderSortIcon("margen_bruto_pct")}
                </th>
                <th
                  onClick={() => handleSort("ticket_promedio")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition"
                >
                  Ticket Prom. {renderSortIcon("ticket_promedio")}
                </th>
                <th
                  onClick={() => handleSort("ppp_promedio")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-slate-300"
                  title="Precio Promedio Ponderado por unidad"
                >
                  PPP Prom. {renderSortIcon("ppp_promedio")}
                </th>
                <th
                  onClick={() => handleSort("total_descuento")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-rose-300"
                >
                  Descuentos {renderSortIcon("total_descuento")}
                </th>
                <th className="py-3 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-emerald-500" />
                    Cargando consolidado de ventas...
                  </td>
                </tr>
              ) : sortedDias.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 font-sans">
                    No hay ventas registradas para el período seleccionado.
                  </td>
                </tr>
              ) : (
                sortedDias.map((d: any) => {
                  const diaPartes = (d.dia_nombre || d.dia).split(", ")
                  const nombreSemana = diaPartes[0] || ""
                  const fechaStr = diaPartes[1] || d.dia

                  return (
                    <tr
                      key={d.dia}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group"
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {d.dia}
                      </td>
                      <td className="py-3 px-3 font-sans font-semibold text-slate-600 dark:text-slate-300">
                        {nombreSemana}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-800 dark:text-slate-100">
                        {Number(d.tickets || 0).toLocaleString("es-PY")}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                        {Number(d.total_skus || 0).toLocaleString("es-PY")}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {Number(d.unidades_vendidas || 0).toLocaleString("es-PY", { maximumFractionDigits: 1 })}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white">
                        {formatPYG(d.total_venta)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {formatPYG(d.total_costo)}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-amber-600 dark:text-amber-400">
                        {formatPYG(d.margen_bruto_gs)}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-teal-600 dark:text-teal-400">
                        {Number(d.margen_bruto_pct || 0).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                        {formatPYG(d.ticket_promedio)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {formatPYG(d.ppp_promedio)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-500">
                        {formatPYG(d.total_descuento)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onVerDetalleDia(d.dia)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition font-sans text-[11px] font-bold cursor-pointer shadow-sm group-hover:scale-105"
                          title={`Ver detalle de productos del día ${d.dia}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Detalle</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {/* Totales al pie */}
            <tfoot className="bg-slate-100 dark:bg-slate-950 font-mono text-xs font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 sticky bottom-0 z-20">
              <tr>
                <td colSpan={2} className="py-3 px-3 text-left font-sans font-extrabold uppercase">
                  TOTALES ({resumen.total_dias || 0} DÍAS)
                </td>
                <td className="py-3 px-3 text-right text-slate-900 dark:text-white">
                  {Number(resumen.total_tickets || 0).toLocaleString("es-PY")}
                </td>
                <td></td>
                <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-200">
                  {Number(resumen.total_unidades || 0).toLocaleString("es-PY", { maximumFractionDigits: 1 })}
                </td>
                <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                  {formatPYG(resumen.total_venta || 0)}
                </td>
                <td className="py-3 px-3 text-right text-slate-500">
                  {formatPYG(resumen.total_costo || 0)}
                </td>
                <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">
                  {formatPYG(resumen.margen_bruto_gs || 0)}
                </td>
                <td className="py-3 px-3 text-right text-teal-600 dark:text-teal-400 font-extrabold">
                  {Number(resumen.margen_bruto_pct || 0).toFixed(1)}%
                </td>
                <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                  {formatPYG(resumen.ticket_promedio || 0)}
                </td>
                <td className="py-3 px-3 text-right text-slate-500">
                  {formatPYG(resumen.ppp_global || 0)}
                </td>
                <td className="py-3 px-3 text-right text-rose-500">
                  {formatPYG(resumen.total_descuento || 0)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
