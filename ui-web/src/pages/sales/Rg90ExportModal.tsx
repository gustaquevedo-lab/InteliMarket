import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  X, Download, FileSpreadsheet, Archive, RefreshCw, Loader2,
  Calendar, ShieldCheck, CheckCircle2, AlertTriangle, Filter,
  Building, Search, FileText, ChevronLeft, ChevronRight, Hash, ArrowUpRight
} from "lucide-react"
import { api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

interface Rg90ExportModalProps {
  isOpen: boolean
  onClose: () => void
  initialFechaDesde?: string
  initialFechaHasta?: string
  timbrado?: string
}

const PUNTOS_EMISION = [
  { id: "todos", nombre: "Todas las Cajas (Bocas 011 a 020)" },
  { id: "001-011", nombre: "Caja 01 · Salón Central (Boca 011)" },
  { id: "001-012", nombre: "Caja 02 · Salón Central (Boca 012)" },
  { id: "001-013", nombre: "Caja 03 · Salón Central (Boca 013)" },
  { id: "001-014", nombre: "Caja 04 · Salón Central (Boca 014)" },
  { id: "001-015", nombre: "Caja 05 · Salón Central (Boca 015)" },
  { id: "001-016", nombre: "Caja 06 · Salón Central (Boca 016)" },
  { id: "001-017", nombre: "Caja 07 · Línea de Caja (Boca 017)" },
  { id: "001-018", nombre: "Caja 08 · Mayorista (Boca 018)" },
  { id: "001-019", nombre: "Caja 09 · Esquina / Administración (Boca 019)" },
  { id: "001-020", nombre: "Caja 10 · Esquina / Refuerzo (Boca 020)" },
]

export default function Rg90ExportModal({
  isOpen,
  onClose,
  initialFechaDesde,
  initialFechaHasta,
  timbrado = "18545636",
}: Rg90ExportModalProps) {
  const toast = useToast()

  // Fechas iniciales por defecto: mes actual
  const now = new Date()
  const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const lastDayCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

  const [fechaDesde, setFechaDesde] = useState(initialFechaDesde || firstDayCurrentMonth)
  const [fechaHasta, setFechaHasta] = useState(initialFechaHasta || lastDayCurrentMonth)
  const [puntoEmision, setPuntoEmision] = useState("todos")
  const [searchFilter, setSearchFilter] = useState("")

  const [loading, setLoading] = useState(false)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [exportingZip, setExportingZip] = useState(false)

  const [reportData, setReportData] = useState<{
    company: { razon_social: string; ruc: string; timbrado: string }
    periodo: { fecha_desde: string | null; fecha_hasta: string | null; punto_emision: string }
    totales: {
      cantidad_facturas: number
      cantidad_nc: number
      total_gravada_10: number
      total_iva_10: number
      total_gravada_5: number
      total_iva_5: number
      total_exenta: number
      total_general: number
    }
    registros: any[]
  } | null>(null)

  // Paginación de la previsualización
  const [page, setPage] = useState(1)
  const pageSize = 15

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.reports.fiscalRg90Ventas({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        punto_emision: puntoEmision !== "todos" ? puntoEmision : undefined,
      })
      setReportData(data)
      setPage(1)
    } catch (err: any) {
      toast.error("Error al cargar datos fiscales RG 90", err.message)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, puntoEmision, toast])

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

  // Accesos rápidos de fechas
  const handleSetCurrentMonth = () => {
    const d = new Date()
    setFechaDesde(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0])
    setFechaHasta(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0])
  }

  const handleSetPrevMonth = () => {
    const d = new Date()
    setFechaDesde(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split("T")[0])
    setFechaHasta(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split("T")[0])
  }

  const handleSetYear2026 = () => {
    setFechaDesde("2026-01-01")
    setFechaHasta("2026-12-31")
  }

  // Descarga Excel
  const handleDownloadXlsx = async () => {
    setExportingXlsx(true)
    try {
      const filename = `libro_ventas_rg90_${fechaDesde || "inicio"}_${fechaHasta || "hoy"}.xlsx`
      await api.reports.downloadRg90VentasXlsx(
        {
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          punto_emision: puntoEmision !== "todos" ? puntoEmision : undefined,
        },
        filename
      )
      toast.success("Planilla Excel RG 90 Generada", `Se descargó exitosamente: ${filename}`)
    } catch (err: any) {
      toast.error("Error al exportar Excel RG 90", err.message)
    } finally {
      setExportingXlsx(false)
    }
  }

  // Descarga ZIP Marangatú
  const handleDownloadZip = async () => {
    setExportingZip(true)
    try {
      const rucSinDv = "80150377"
      const mmaaaa = fechaDesde ? `${fechaDesde.slice(5, 7)}${fechaDesde.slice(0, 4)}` : "082026"
      const filename = `${rucSinDv}_REG_${mmaaaa}_00001.zip`
      await api.reports.downloadRg90VentasZip(
        {
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          punto_emision: puntoEmision !== "todos" ? puntoEmision : undefined,
        },
        filename
      )
      toast.success("Paquete ZIP Marangatú Generado", `Listo para importar a DNIT Marangatú: ${filename}`)
    } catch (err: any) {
      toast.error("Error al exportar ZIP RG 90", err.message)
    } finally {
      setExportingZip(false)
    }
  }

  // Registros filtrados para la tabla
  const filteredRegistros = useMemo(() => {
    if (!reportData) return []
    const q = searchFilter.trim().toLowerCase()
    if (!q) return reportData.registros
    return reportData.registros.filter((r) => {
      return (
        String(r.numero_comprobante || "").toLowerCase().includes(q) ||
        String(r.numero_identificacion || "").toLowerCase().includes(q) ||
        String(r.nombre_comprador || "").toLowerCase().includes(q) ||
        String(r.fecha_emision || "").toLowerCase().includes(q)
      )
    })
  }, [reportData, searchFilter])

  const totalPages = Math.ceil(filteredRegistros.length / pageSize) || 1
  const paginatedRegistros = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRegistros.slice(start, start + pageSize)
  }, [filteredRegistros, page, pageSize])

  if (!isOpen) return null

  const totales = reportData?.totales || {
    cantidad_facturas: 0,
    cantidad_nc: 0,
    total_gravada_10: 0,
    total_iva_10: 0,
    total_gravada_5: 0,
    total_iva_5: 0,
    total_exenta: 0,
    total_general: 0,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* ── HEADER LUXURY MARANGATÚ ── */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white p-6 border-b border-emerald-500/20">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10 gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 border border-emerald-400/30 shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase bg-emerald-500/15 px-2.5 py-0.5 rounded-md border border-emerald-500/30 font-mono">
                    DNIT · RESOLUCIÓN GENERAL Nº 90/2021
                  </span>
                  <span className="text-[11px] font-bold text-slate-300 font-mono">
                    Timbrado Oficial Nº {timbrado}
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight text-white mt-1">
                  Generador de Libro de Ventas RG 90 / Marangatú
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  GRUPO SANTA TERESA E.A.S. (RUC 80150377-9) · Extra Supermercado Mayorista · Hora Oficial America/Asuncion
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition shadow-sm cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── BARRA DE ACCIÓN RÁPIDA & FILTROS ── */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Accesos rápidos de período */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Período:
              </span>
              <button
                type="button"
                onClick={handleSetCurrentMonth}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:border-emerald-500 transition shadow-2xs cursor-pointer"
              >
                Mes Actual
              </button>
              <button
                type="button"
                onClick={handleSetPrevMonth}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:border-emerald-500 transition shadow-2xs cursor-pointer"
              >
                Mes Anterior
              </button>
              <button
                type="button"
                onClick={handleSetYear2026}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:border-emerald-500 transition shadow-2xs cursor-pointer"
              >
                Año 2026
              </button>
            </div>

            {/* Botones de Descarga */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadXlsx}
                disabled={exportingXlsx || loading || (reportData?.registros?.length || 0) === 0}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-2 transition shadow-md shadow-emerald-700/20 disabled:opacity-50 cursor-pointer"
              >
                {exportingXlsx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                <span>Descargar Excel RG 90</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={exportingZip || loading || (reportData?.registros?.length || 0) === 0}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 transition shadow-md shadow-blue-700/20 disabled:opacity-50 cursor-pointer"
              >
                {exportingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                <span>Descargar ZIP Marangatú</span>
              </button>
            </div>
          </div>

          {/* Filtros fecha y punto de emisión */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Punto de Emisión</label>
              <select
                value={puntoEmision}
                onChange={(e) => setPuntoEmision(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PUNTOS_EMISION.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-500" : ""}`} />
                <span>Actualizar Vista</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── METRICAS / KPIS FISCALES ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Facturado</span>
            <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatPYG(totales.total_general)}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <span>{totales.cantidad_facturas} facturas</span>
              {totales.cantidad_nc > 0 && <span className="text-amber-500 font-bold">· {totales.cantidad_nc} NC</span>}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IVA Débito 10%</span>
            <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
              {formatPYG(totales.total_iva_10)}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Base: {formatPYG(totales.total_gravada_10)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IVA Débito 5%</span>
            <p className="text-xl font-black font-mono text-teal-600 dark:text-teal-400">
              {formatPYG(totales.total_iva_5)}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Base: {formatPYG(totales.total_gravada_5)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ventas Exentas</span>
            <p className="text-xl font-black font-mono text-slate-700 dark:text-slate-300">
              {formatPYG(totales.total_exenta)}
            </p>
            <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 100% Moneda PYG
            </p>
          </div>
        </div>

        {/* ── TABLA DE PREVISUALIZACIÓN CON BUSCADOR ── */}
        <div className="flex-1 overflow-hidden flex flex-col p-5 space-y-3 min-h-[300px]">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value)
                  setPage(1)
                }}
                placeholder="Filtrar por comprobante, RUC/CI o cliente..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Mostrando {filteredRegistros.length} comprobantes en período
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="text-xs font-bold">Generando auditoría fiscal RG 90...</span>
              </div>
            ) : filteredRegistros.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                <AlertTriangle className="w-8 h-8 text-amber-500/70" />
                <span className="text-xs font-bold">No se encontraron ventas para los filtros seleccionados</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-400 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Comprobante</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Doc. Cliente</th>
                    <th className="p-3">Razón Social</th>
                    <th className="p-3 text-right">Grav. 10%</th>
                    <th className="p-3 text-right">IVA 10%</th>
                    <th className="p-3 text-right">Grav. 5%</th>
                    <th className="p-3 text-right">IVA 5%</th>
                    <th className="p-3 text-right">Exenta</th>
                    <th className="p-3 text-right">Total (Gs.)</th>
                    <th className="p-3 text-center">Cond.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {paginatedRegistros.map((r, i) => (
                    <tr key={`${r.numero_comprobante}-${i}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{r.fecha_emision}</td>
                      <td className="p-3 whitespace-nowrap font-bold text-slate-900 dark:text-white">{r.numero_comprobante}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.tipo_comprobante === 110
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}>
                          {r.tipo_comprobante === 110 ? "110 (NC)" : "109 (FAC)"}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {r.numero_identificacion}{r.dv ? `-${r.dv}` : ""}
                        <span className="text-[9px] text-slate-400 block">Tipo: {r.tipo_identificacion}</span>
                      </td>
                      <td className="p-3 font-sans text-xs text-slate-800 dark:text-slate-200 max-w-[180px] truncate" title={r.nombre_comprador}>
                        {r.nombre_comprador}
                      </td>
                      <td className="p-3 text-right text-slate-700 dark:text-slate-300">{formatPYG(r.gravada_10)}</td>
                      <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">{formatPYG(r.iva_10)}</td>
                      <td className="p-3 text-right text-slate-700 dark:text-slate-300">{formatPYG(r.gravada_5)}</td>
                      <td className="p-3 text-right font-bold text-teal-600 dark:text-teal-400">{formatPYG(r.iva_5)}</td>
                      <td className="p-3 text-right text-slate-500">{formatPYG(r.exenta)}</td>
                      <td className="p-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">{formatPYG(r.total)}</td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {r.condicion === 2 ? "CRÉD" : "CONT"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-500 font-mono">
                Página {page} de {totalPages} ({filteredRegistros.length} registros)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER INFORMATIVO ── */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Formato validado para el Sistema Marangatú (DNIT / SET). Codificación UTF-8 sin cabecera.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
