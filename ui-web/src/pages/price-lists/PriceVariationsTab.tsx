import React, { useState, useEffect, useCallback } from "react"
import {
  TrendingUp, TrendingDown, Calendar, Filter, Search, FileSpreadsheet,
  FileText, RefreshCw, Layers, Tag, ChevronLeft, ChevronRight, Loader2,
  ArrowUpRight, ArrowDownRight, Clock, User, ShieldAlert, Sparkles,
} from "lucide-react"
import { api, type PriceVariationItem, type PriceVariationsResponse } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type DatePreset = "today" | "yesterday" | "7d" | "month" | "custom"

export default function PriceVariationsTab() {
  const toast = useToast()

  // Filtros
  const [datePreset, setDatePreset] = useState<DatePreset>("7d")
  const [fechaDesde, setFechaDesde] = useState<string>("")
  const [fechaHasta, setFechaHasta] = useState<string>("")
  const [tipo, setTipo] = useState<"todos" | "unitario" | "escala">("todos")
  const [search, setSearch] = useState<string>("")
  const [orderBy, setOrderBy] = useState<string>("fecha_desc")

  // Paginación y estado
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [loading, setLoading] = useState<boolean>(false)
  const [exportingCsv, setExportingCsv] = useState<boolean>(false)
  const [exportingPdf, setExportingPdf] = useState<boolean>(false)

  // Datos
  const [data, setData] = useState<PriceVariationsResponse | null>(null)

  // Configurar fechas según el preset seleccionado
  useEffect(() => {
    const now = new Date()
    const toYMD = (d: Date) => d.toISOString().slice(0, 10)

    if (datePreset === "today") {
      const todayStr = toYMD(now)
      setFechaDesde(todayStr)
      setFechaHasta(todayStr)
    } else if (datePreset === "yesterday") {
      const yest = new Date(now)
      yest.setDate(yest.getDate() - 1)
      const yestStr = toYMD(yest)
      setFechaDesde(yestStr)
      setFechaHasta(yestStr)
    } else if (datePreset === "7d") {
      const past = new Date(now)
      past.setDate(past.getDate() - 7)
      setFechaDesde(toYMD(past))
      setFechaHasta(toYMD(now))
    } else if (datePreset === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      setFechaDesde(toYMD(startOfMonth))
      setFechaHasta(toYMD(now))
    }
  }, [datePreset])

  // Carga de datos
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.priceLists.variations({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        tipo: tipo !== "todos" ? tipo : undefined,
        search: search.trim() || undefined,
        order_by: orderBy,
        page,
        page_size: pageSize,
      })
      setData(res)
    } catch (err: any) {
      toast.error("Error al cargar variaciones", err?.message || "Ocurrió un error inesperado")
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, tipo, search, orderBy, page, pageSize, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Descarga Excel / CSV
  const handleExportCsv = async () => {
    setExportingCsv(true)
    try {
      await api.priceLists.exportVariationsCsv({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        tipo: tipo !== "todos" ? tipo : undefined,
        search: search.trim() || undefined,
        order_by: orderBy,
      })
      toast.success("Excel Descargado", "Archivo CSV generado correctamente con codificación UTF-8.")
    } catch (err: any) {
      toast.error("Error al exportar", err?.message || "No se pudo generar el archivo.")
    } finally {
      setExportingCsv(false)
    }
  }

  // Descarga PDF
  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await api.priceLists.exportVariationsPdf({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        tipo: tipo !== "todos" ? tipo : undefined,
        search: search.trim() || undefined,
        order_by: orderBy,
      })
      toast.success("PDF Descargado", "Reporte corporativo generado con membrete de Extra Supermercado.")
    } catch (err: any) {
      toast.error("Error al generar PDF", err?.message || "No se pudo generar el documento.")
    } finally {
      setExportingPdf(false)
    }
  }

  const resumen = data?.resumen || {
    total_modificaciones: 0,
    total_subidas: 0,
    total_bajadas: 0,
    promedio_variacion_pct: 0,
  }

  const paginacion = data?.paginacion || {
    total: 0,
    page: 1,
    page_size: pageSize,
    total_pages: 1,
  }

  const items = data?.items || []

  return (
    <div className="space-y-6">
      {/* 🌟 BARRA SUPERIOR DE FILTROS & CONTROLES */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Presets de fecha */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              Período:
            </span>
            {(
              [
                { id: "today", label: "Hoy" },
                { id: "yesterday", label: "Ayer" },
                { id: "7d", label: "Últimos 7 días" },
                { id: "month", label: "Este Mes" },
                { id: "custom", label: "Personalizado" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setDatePreset(p.id)
                  setPage(1)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  datePreset === p.id
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Botones de Exportación y Recarga */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv || loading}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-750 border border-emerald-500/30 hover:border-emerald-500/60 transition flex items-center gap-2 shadow-sm"
              title="Descargar datos en formato Excel/CSV"
            >
              {exportingCsv ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              )}
              Exportar Excel
            </button>

            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-750 border border-rose-500/30 hover:border-rose-500/60 transition flex items-center gap-2 shadow-sm"
              title="Descargar Reporte Oficial en PDF"
            >
              {exportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-rose-400" />
              )}
              Reporte PDF
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Inputs de rango personalizado si aplica */}
        {datePreset === "custom" && (
          <div className="pt-3 border-t border-slate-800/80 flex items-center gap-3 flex-wrap animate-fade-in">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Desde:</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value)
                  setPage(1)
                }}
                className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Hasta:</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value)
                  setPage(1)
                }}
                className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Segunda fila: Filtros de Tipo, Orden y Buscador */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por producto, SKU o código de barra..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          {/* Segmented control: Tipo de Precio */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(
              [
                { id: "todos", label: "Todos los Precios" },
                { id: "unitario", label: "Solo Unitarios" },
                { id: "escala", label: "Solo Escalas" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTipo(t.id)
                  setPage(1)
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition text-center ${
                  tipo === t.id
                    ? "bg-slate-800 text-sky-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Selector de Orden */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Ordenar por:</span>
            <select
              value={orderBy}
              onChange={(e) => {
                setOrderBy(e.target.value)
                setPage(1)
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="fecha_desc">🕒 Fecha (Más reciente primero)</option>
              <option value="fecha_asc">🕒 Fecha (Más antiguo primero)</option>
              <option value="nombre_asc">🔤 Producto (A - Z)</option>
              <option value="nombre_desc">🔤 Producto (Z - A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 📊 TARJETAS DE KPIS EJECUTIVOS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Modificaciones</span>
            <Tag className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-black font-mono tracking-tight text-white">
            {resumen.total_modificaciones.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400">Total de eventos en el período</p>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Aumentos (🔺)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
            {resumen.total_subidas.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400">Precios ajustados hacia arriba</p>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Rebajas (🔻)</span>
            <ArrowDownRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
            {resumen.total_bajadas.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400">Precios con descuento o baja</p>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Variación Media</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <p className={`text-2xl font-black font-mono tracking-tight ${
            resumen.promedio_variacion_pct > 0
              ? "text-rose-400"
              : resumen.promedio_variacion_pct < 0
              ? "text-emerald-400"
              : "text-slate-300"
          }`}>
            {resumen.promedio_variacion_pct > 0 ? "+" : ""}
            {resumen.promedio_variacion_pct.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-400">Promedio porcentual general</p>
        </div>
      </div>

      {/* 📋 TABLA DETALLADA DE VARIACIONES */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Bitácora Cronológica de Precios Regulares
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              ({paginacion.total.toLocaleString()} registros encontrados)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>por página</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
            <p className="text-xs font-medium">Consultando auditoría de precios en tiempo real...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300">No se encontraron variaciones de precios</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No hay modificaciones registradas en el período seleccionado. Puedes ajustar el rango de fechas o los filtros superiores.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Producto & SKU</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4 text-right">Precio Anterior</th>
                  <th className="py-3 px-4 text-right">Precio Nuevo</th>
                  <th className="py-3 px-4 text-right">Variación</th>
                  <th className="py-3 px-4">Responsable / Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {items.map((it) => {
                  const isUp = it.diferencia_monto > 0
                  const isDown = it.diferencia_monto < 0
                  const dateObj = new Date(it.created_at)
                  const dateStr = dateObj.toLocaleDateString("es-PY", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                  const timeStr = dateObj.toLocaleTimeString("es-PY", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })

                  return (
                    <tr key={it.id} className="hover:bg-slate-800/50 transition">
                      {/* Fecha */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-200 font-bold">{dateStr}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-600" />
                          {timeStr}
                        </div>
                      </td>

                      {/* Producto */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-100 hover:text-sky-300 transition line-clamp-1">
                          {it.product_nombre || "Producto sin nombre"}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                          {it.product_sku && <span>SKU: {it.product_sku}</span>}
                          {it.product_barcode && <span>CB: {it.product_barcode}</span>}
                        </div>
                        {it.categoria_nombre && (
                          <span className="text-[10px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60 mt-1 inline-block">
                            {it.categoria_nombre}
                          </span>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {it.tipo === "escala" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <Layers className="w-3 h-3 text-purple-400" />
                            Escala (≥{it.escala_min_qty || 2} un.)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            <Tag className="w-3 h-3 text-sky-400" />
                            Unitario Regular
                          </span>
                        )}
                      </td>

                      {/* Precio Anterior */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400 whitespace-nowrap">
                        {formatPYG(it.precio_anterior)}
                      </td>

                      {/* Precio Nuevo */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                        {formatPYG(it.precio_nuevo)}
                      </td>

                      {/* Variación */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs font-black ${
                              isUp
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : isDown
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {isUp && <ArrowUpRight className="w-3 h-3" />}
                            {isDown && <ArrowDownRight className="w-3 h-3" />}
                            {isUp ? "+" : ""}
                            {it.diferencia_pct.toFixed(1)}%
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {isUp ? "+" : ""}
                            {formatPYG(it.diferencia_monto)}
                          </span>
                        </div>
                      </td>

                      {/* Responsable / Origen */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{it.usuario_nombre || it.origen || "Sistema"}</span>
                        </div>
                        {it.motivo && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px] mt-0.5" title={it.motivo}>
                            {it.motivo}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {paginacion.total_pages > 1 && (
          <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-slate-400 font-mono">
              Página {paginacion.page} de {paginacion.total_pages}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={paginacion.page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>

              <button
                onClick={() => setPage((p) => Math.min(paginacion.total_pages, p + 1))}
                disabled={paginacion.page >= paginacion.total_pages || loading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
