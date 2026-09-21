import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Search, Calendar, ChevronLeft, ChevronRight, FileSpreadsheet, FileText,
  RefreshCcw, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Package, Layers,
  DollarSign, TrendingUp, ShoppingCart, Percent, Tag, Award
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface PlanillaDetalleDiaTabProps {
  initialFecha?: string
  onFechaChange?: (fecha: string) => void
}

type SortField =
  | "total_venta"
  | "cantidad"
  | "margen_gs"
  | "margen_ppp_pct"
  | "margen_pvp_pct"
  | "producto"
  | "sku"
  | "pvp"
  | "ppp"
  | "ultimo_costo"
  | "costo_promedio"
  | "participacion_pct"

export default function PlanillaDetalleDiaTab({
  initialFecha,
  onFechaChange,
}: PlanillaDetalleDiaTabProps) {
  const toast = useToast()

  // Fecha en zona horaria local de Paraguay (America/Asuncion)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  const [fecha, setFecha] = useState<string>(initialFecha || todayStr)

  useEffect(() => {
    if (initialFecha && initialFecha !== fecha) {
      setFecha(initialFecha)
    }
  }, [initialFecha])

  const [loading, setLoading] = useState(false)
  const [downloadingXlsx, setDownloadingXlsx] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const [reportData, setReportData] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas")
  const [searchText, setSearchText] = useState<string>("")

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>("total_venta")
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  // Cargar categorías
  useEffect(() => {
    api.categories
      .list()
      .then((res: any) => {
        if (Array.isArray(res)) setCategories(res)
      })
      .catch(() => {})
  }, [])

  // Cargar datos del día
  const fetchDiaData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.reports.salesDetailedDay({
        fecha,
        categoria_id: selectedCategoria !== "todas" ? selectedCategoria : undefined,
      })
      setReportData(res)
    } catch (err: any) {
      toast.error("Error al cargar ventas del día", err.message || "Error de conexión")
    } finally {
      setLoading(false)
    }
  }, [fecha, selectedCategoria, toast])

  useEffect(() => {
    fetchDiaData()
    if (onFechaChange) {
      onFechaChange(fecha)
    }
  }, [fetchDiaData, fecha, onFechaChange])

  // Navegación rápida de días
  const cambiarDia = (dias: number) => {
    try {
      const [y, m, d] = fecha.split("-").map(Number)
      const current = new Date(y, m - 1, d)
      current.setDate(current.getDate() + dias)
      const newY = current.getFullYear()
      const newM = String(current.getMonth() + 1).padStart(2, "0")
      const newD = String(current.getDate()).padStart(2, "0")
      setFecha(`${newY}-${newM}-${newD}`)
    } catch {
      setFecha(todayStr)
    }
  }

  const setHoy = () => setFecha(todayStr)
  const setAyer = () => {
    const now = new Date()
    now.setDate(now.getDate() - 1)
    setFecha(now.toISOString().split("T")[0])
  }

  // Filtrado local por búsqueda de texto
  const filteredItems = useMemo(() => {
    if (!reportData?.items) return []
    let list = [...reportData.items]

    if (searchText.trim()) {
      const q = searchText.toLowerCase().trim()
      list = list.filter(
        (it: any) =>
          (it.producto && it.producto.toLowerCase().includes(q)) ||
          (it.sku && it.sku.toLowerCase().includes(q)) ||
          (it.codigo_barra && it.codigo_barra.toLowerCase().includes(q)) ||
          (it.categoria && it.categoria.toLowerCase().includes(q))
      )
    }

    // Ordenamiento
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
  }, [reportData?.items, searchText, sortField, sortAsc])

  // Totales de los items visibles
  const totalesVisibles = useMemo(() => {
    let cant = 0
    let venta = 0
    let costo = 0
    filteredItems.forEach((it: any) => {
      cant += Number(it.cantidad || 0)
      venta += Number(it.total_venta || 0)
      costo += Number(it.total_costo || 0)
    })
    const margenGs = venta - costo
    const margenPct = venta > 0 ? (margenGs / venta) * 100 : 0
    return { cant, venta, costo, margenGs, margenPct }
  }, [filteredItems])

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
      await api.reports.downloadSalesDetailedDayXlsx({
        fecha,
        categoria_id: selectedCategoria !== "todas" ? selectedCategoria : undefined,
        search: searchText.trim() || undefined,
      })
      toast.success("Excel descargado", `Ventas detalladas del día ${fecha}`)
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
      await api.reports.downloadSalesDetailedDayPdf({
        fecha,
        categoria_id: selectedCategoria !== "todas" ? selectedCategoria : undefined,
        search: searchText.trim() || undefined,
      })
      toast.success("PDF generado exitosamente", `Ventas detalladas del día ${fecha}`)
    } catch (err: any) {
      toast.error("Error al generar PDF", err.message || "Error desconocido")
    } finally {
      setDownloadingPdf(false)
    }
  }

  const resumen = reportData?.resumen || {}

  // Badge de margen
  const getMargenBadge = (pct: number) => {
    if (pct >= 25) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {pct.toFixed(1)}%
        </span>
      )
    }
    if (pct >= 15) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
          {pct.toFixed(1)}%
        </span>
      )
    }
    if (pct >= 8) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          {pct.toFixed(1)}%
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
        {pct.toFixed(1)}%
      </span>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── BARRA DE COMANDO Y FILTROS DEL DÍA ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        {/* Selector de fecha con controles < > y presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => cambiarDia(-1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-transparent text-sm font-black font-mono text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => cambiarDia(1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={setHoy}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              fecha === todayStr
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Hoy
          </button>
          <button
            onClick={setAyer}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
          >
            Ayer
          </button>
          <button
            onClick={fetchDiaData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filtros secundarios: Categoría y Buscador */}
        <div className="flex items-center gap-3 flex-wrap flex-1 justify-start xl:justify-end">
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 py-2.5 px-3 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="todas">📁 Todas las Categorías</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[220px] flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar producto, SKU, código..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full text-xs font-medium pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Botones de Exportación */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={downloadingPdf || loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-black shadow-md shadow-red-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Descargar auditoría PDF Premium"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              PDF Premium
            </button>
            <button
              onClick={handleExportXlsx}
              disabled={downloadingXlsx || loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Descargar Planilla Excel (.xlsx)"
            >
              {downloadingXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>

      {/* ── TARJETAS KPIS RESUMEN DEL DÍA ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>Tickets</span>
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
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>SKUs / Unid.</span>
            <Package className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">
            {Number(resumen.total_skus || 0).toLocaleString("es-PY")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Volumen: {Number(resumen.total_unidades || 0).toLocaleString("es-PY", { maximumFractionDigits: 1 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Facturación</span>
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatPYG(resumen.total_venta || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            PPP Prom: {formatPYG(resumen.ppp_global || 0)}
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
            CMV Ponderado
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
            <span>Margen Comercial</span>
            <Percent className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black font-mono text-teal-600 dark:text-teal-400 mt-1">
            {Number(resumen.margen_bruto_pct || 0).toFixed(2)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Rentabilidad del día
          </p>
        </div>
      </div>

      {/* ── TABLA LINDA PLANILLA DE VENTAS DETALLADAS ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              Planilla Detallada de Productos Vendidos
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filteredItems.length} artículos
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {fecha} · Hora oficial America/Asuncion
          </span>
        </div>

        <div className="overflow-x-auto max-h-[620px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-white text-[11px] font-bold uppercase tracking-wider sticky top-0 z-20 shadow-md">
              <tr>
                <th className="py-3 px-2 text-center w-10">#</th>
                <th
                  onClick={() => handleSort("sku")}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-900 transition"
                >
                  SKU / Cód. {renderSortIcon("sku")}
                </th>
                <th
                  onClick={() => handleSort("producto")}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-900 transition min-w-[220px]"
                >
                  Producto / Categoría {renderSortIcon("producto")}
                </th>
                <th className="py-3 px-2 text-center">U.M.</th>
                <th
                  onClick={() => handleSort("cantidad")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition"
                >
                  Cant. {renderSortIcon("cantidad")}
                </th>
                <th
                  onClick={() => handleSort("pvp")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition"
                  title="Precio de Venta al Público en catálogo"
                >
                  PVP {renderSortIcon("pvp")}
                </th>
                <th
                  onClick={() => handleSort("ppp")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-emerald-400"
                  title="Precio Promedio Ponderado efectivamente cobrado"
                >
                  PPP Real {renderSortIcon("ppp")}
                </th>
                <th
                  onClick={() => handleSort("ultimo_costo")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-slate-300"
                  title="Último costo de compra / reposición"
                >
                  Últ. Costo {renderSortIcon("ultimo_costo")}
                </th>
                <th
                  onClick={() => handleSort("costo_promedio")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-slate-300"
                  title="Costo promedio ponderado de inventario"
                >
                  Costo Prom. {renderSortIcon("costo_promedio")}
                </th>
                <th
                  onClick={() => handleSort("total_venta")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-emerald-300"
                >
                  Total Ventas {renderSortIcon("total_venta")}
                </th>
                <th className="py-3 px-3 text-right text-slate-300">Total Costo</th>
                <th
                  onClick={() => handleSort("margen_gs")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-amber-300"
                >
                  Margen (Gs.) {renderSortIcon("margen_gs")}
                </th>
                <th
                  onClick={() => handleSort("margen_pvp_pct")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition"
                  title="Margen teórico según catálogo PVP vs costo"
                >
                  Mg. s/ PVP {renderSortIcon("margen_pvp_pct")}
                </th>
                <th
                  onClick={() => handleSort("margen_ppp_pct")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-teal-300"
                  title="Margen real obtenido en base al PPP cobrado en caja"
                >
                  Mg. Real (PPP) {renderSortIcon("margen_ppp_pct")}
                </th>
                <th
                  onClick={() => handleSort("participacion_pct")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-900 transition text-slate-400"
                >
                  Part. {renderSortIcon("participacion_pct")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-emerald-500" />
                    Cargando ventas detalladas del día {fecha}...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400 font-sans">
                    No se registraron ventas con los filtros aplicados para este día.
                  </td>
                </tr>
              ) : (
                filteredItems.map((it: any, idx: number) => {
                  const cant = Number(it.cantidad || 0)
                  const cantStr =
                    cant % 1 !== 0
                      ? cant.toLocaleString("es-PY", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
                      : cant.toLocaleString("es-PY")

                  return (
                    <tr
                      key={it.product_id || idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group"
                    >
                      <td className="py-2.5 px-2 text-center text-slate-400 font-sans text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        <span className="text-slate-900 dark:text-white font-bold">{it.sku}</span>
                        {it.codigo_barra && it.codigo_barra !== "—" && it.codigo_barra !== it.sku && (
                          <span className="block text-[10px] text-slate-400">{it.codigo_barra}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                          {it.producto}
                        </div>
                        <span className="inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mt-0.5">
                          {it.categoria || "General"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-500">
                        {it.unidad_medida || "UN"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-800 dark:text-slate-100">
                        {cantStr}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                        {formatPYG(it.pvp)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPYG(it.ppp)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {formatPYG(it.ultimo_costo)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {formatPYG(it.costo_promedio)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                        {formatPYG(it.total_venta)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {formatPYG(it.total_costo)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400">
                        {formatPYG(it.margen_gs)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {it.margen_pvp_pct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {getMargenBadge(it.margen_ppp_pct)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-sans text-[10px]">
                        {it.participacion_pct.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {/* Pie de tabla con totales */}
            <tfoot className="bg-slate-100 dark:bg-slate-950 font-mono text-xs font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 sticky bottom-0 z-20">
              <tr>
                <td colSpan={4} className="py-3 px-3 text-left font-sans font-extrabold uppercase">
                  Totales {filteredItems.length} ítems
                </td>
                <td className="py-3 px-3 text-right text-slate-900 dark:text-white">
                  {totalesVisibles.cant.toLocaleString("es-PY", { maximumFractionDigits: 2 })}
                </td>
                <td colSpan={4} className="py-3 px-3 text-right text-slate-400 text-[10px] font-sans">
                  PPP Global: {formatPYG(resumen.ppp_global || 0)}
                </td>
                <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                  {formatPYG(totalesVisibles.venta)}
                </td>
                <td className="py-3 px-3 text-right text-slate-500">
                  {formatPYG(totalesVisibles.costo)}
                </td>
                <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">
                  {formatPYG(totalesVisibles.margenGs)}
                </td>
                <td colSpan={2} className="py-3 px-3 text-right">
                  {getMargenBadge(totalesVisibles.margenPct)}
                </td>
                <td className="py-3 px-3 text-right text-slate-400">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
