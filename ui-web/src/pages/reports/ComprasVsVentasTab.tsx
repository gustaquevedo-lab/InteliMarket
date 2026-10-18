import React, { useState, useEffect } from "react"
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Building2,
  Sliders,
  DollarSign,
  ShoppingCart,
  Percent,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Package,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Tag,
  Boxes,
} from "lucide-react"
import { api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../hooks/useToast"

interface ComprasVsVentasTabProps {
  fechaDesde: string
  fechaHasta: string
}

export default function ComprasVsVentasTab({ fechaDesde, fechaHasta }: ComprasVsVentasTabProps) {
  const toast = useToast()
  const [targetRatio, setTargetRatio] = useState<number>(70)
  const [tipoProvision, setTipoProvision] = useState<string>("mercaderias")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingXlsx, setDownloadingXlsx] = useState(false)

  // Proveedor expandido y sus productos
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null)
  const [expandedSupplierName, setExpandedSupplierName] = useState<string>("")
  const [supplierProducts, setSupplierProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await api.reports.purchasesVsSales({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        target_ratio_pct: targetRatio,
        tipo_provision: tipoProvision,
      })
      setData(res)
    } catch (err: any) {
      console.error("Error fetching purchases vs sales report:", err)
      toast.error("Error al cargar reporte", err?.message || "No se pudo obtener el comparativo")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fechaDesde, fechaHasta, targetRatio, tipoProvision])

  const toggleSupplierExpand = async (supplierId: string, supplierName: string) => {
    if (expandedSupplierId === supplierId) {
      setExpandedSupplierId(null)
      setSupplierProducts([])
      return
    }

    setExpandedSupplierId(supplierId)
    setExpandedSupplierName(supplierName)
    setLoadingProducts(true)
    try {
      const prods = await api.reports.salesBySupplierProducts({
        supplier_id: supplierId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        limit: 100,
      })
      setSupplierProducts(prods || [])
    } catch (err: any) {
      console.error("Error loading supplier products:", err)
      toast.error("Error al cargar productos", err?.message || "No se pudo obtener el catálogo")
      setSupplierProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleExportPdf = async () => {
    try {
      setDownloadingPdf(true)
      await api.reports.downloadPurchasesVsSalesPdf({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        target_ratio_pct: targetRatio,
        tipo_provision: tipoProvision,
      })
      toast.success("PDF Descargado", "Informe oficial de Compras vs. Ventas OTB generado.")
    } catch (err: any) {
      toast.error("Error al exportar PDF", err?.message || "No se pudo generar el documento")
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleExportXlsx = async () => {
    try {
      setDownloadingXlsx(true)
      await api.reports.downloadPurchasesVsSalesXlsx({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        target_ratio_pct: targetRatio,
        tipo_provision: tipoProvision,
      })
      toast.success("Excel Descargado", "Planilla de Compras vs. Ventas generada.")
    } catch (err: any) {
      toast.error("Error al exportar Excel", err?.message || "No se pudo generar la planilla")
    } finally {
      setDownloadingXlsx(false)
    }
  }

  const resumen = data?.resumen || {
    total_ventas: 0,
    total_ventas_ly: 0,
    var_interanual_pct: null,
    total_ventas_proyeccion: 0,
    total_compras: 0,
    ratio_real_pct: 0,
    ratio_proyectado_pct: 0,
    presupuesto_maximo_compras: 0,
    presupuesto_proyectado_compras: 0,
    saldo_otb_disponible: 0,
    saldo_otb_proyectado: 0,
    porcentaje_presupuesto_consumido: 0,
    esta_sobrecomprado: false,
  }

  const proveedores = data?.proveedores || []
  const filteredProveedores = proveedores.filter((p: any) =>
    (p.proveedor && p.proveedor.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.ruc && p.ruc.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* ── BARRA DE CONTROL DEL PRESUPUESTO & EXPORTACIÓN ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Presupuesto de Compras / Open to Buy (OTB)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Proyección calibrada según ritmo actual y antecedentes del mismo período del año pasado
          </p>
        </div>

        {/* Controles de Ratio, Filtro de Provisión y Descargas */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de Tipo de Provisión */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Proveedores:</span>
            <select
              value={tipoProvision}
              onChange={(e) => setTipoProvision(e.target.value)}
              className="text-xs font-bold bg-transparent border-0 text-emerald-700 dark:text-emerald-400 focus:outline-none cursor-pointer"
            >
              <option value="mercaderias">📦 Mercaderías para la Venta (Bienes + Mixtos)</option>
              <option value="todos">🌐 Todos los Proveedores (Incluye Servicios)</option>
              <option value="bienes">🛍️ Solo Bienes / Reventa</option>
              <option value="mixto">🔄 Solo Proveedores Mixtos</option>
              <option value="servicios">💼 Solo Servicios / Gastos</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Tope Compra:</span>
            <div className="flex items-center gap-1">
              {[60, 65, 70, 75, 80].map((r) => (
                <button
                  key={r}
                  onClick={() => setTargetRatio(r)}
                  className={`px-2 py-0.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    targetRatio === r
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleExportPdf}
            disabled={downloadingPdf || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-md shadow-red-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            PDF Oficial
          </button>
          <button
            onClick={handleExportXlsx}
            disabled={downloadingXlsx || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {downloadingXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Excel
          </button>
        </div>
      </div>

      {/* ── 5 KPIS DE CONTROL PRESUPUESTARIO Y PROYECCIÓN ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Ventas Actuales */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ventas Facturadas</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatPYG(resumen.total_ventas)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{resumen.total_tickets_ventas?.toLocaleString("es-PY")} tickets</span>
            <span className="text-emerald-600 font-bold font-mono">100% Salón</span>
          </div>
        </div>

        {/* KPI 2: Año Anterior (SPLY) */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Año Pasado (Mismo Período)</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-purple-700 dark:text-purple-300">
            {formatPYG(resumen.total_ventas_ly || 0)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Comparativa Interanual</span>
            {resumen.var_interanual_pct !== null && (
              <span className={`font-mono font-bold flex items-center gap-0.5 ${
                resumen.var_interanual_pct >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}>
                {resumen.var_interanual_pct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {resumen.var_interanual_pct >= 0 ? `+${resumen.var_interanual_pct}%` : `${resumen.var_interanual_pct}%`}
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Proyección Cierre de Mes */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Proyección Cierre Mes</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
            {formatPYG(resumen.total_ventas_proyeccion || 0)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Techo Proy: {formatPYG(resumen.presupuesto_proyectado_compras)}</span>
            <span className="text-amber-600 font-bold font-mono">Estacional</span>
          </div>
        </div>

        {/* KPI 4: Compras Recibidas */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Compras Recibidas</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
            {formatPYG(resumen.total_compras)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{resumen.total_facturas_compras?.toLocaleString("es-PY")} facturas</span>
            <span className="text-blue-600 font-bold font-mono">Recepción Stock</span>
          </div>
        </div>

        {/* KPI 5: Ratio C/V y Diagnóstico */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className={`h-1 w-full absolute top-0 left-0 ${resumen.esta_sobrecomprado ? "bg-rose-500" : "bg-emerald-500"}`} />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ratio C/V Real / Proy</span>
            <div className={`p-2 rounded-xl ${resumen.esta_sobrecomprado ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600" : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600"}`}>
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-xl font-black font-mono ${resumen.esta_sobrecomprado ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {resumen.ratio_real_pct.toFixed(1)}%
            </p>
            <span className="text-xs text-slate-400 font-mono">
              (Proy: {resumen.ratio_proyectado_pct?.toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Meta: {targetRatio}%</span>
            <span className={`font-bold font-mono ${resumen.esta_sobrecomprado ? "text-rose-600" : "text-emerald-600"}`}>
              {resumen.esta_sobrecomprado ? "Sobrecompra" : "En Rango"}
            </span>
          </div>
        </div>
      </div>

      {/* ── BARRA VISUAL DE CONSUMO PRESUPUESTARIO ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            {resumen.esta_sobrecomprado ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            Consumo del Techo de Compras ({targetRatio}% de Ventas Actuales)
          </span>
          <span className={`font-mono ${resumen.esta_sobrecomprado ? "text-rose-600 font-black" : "text-slate-600 dark:text-slate-300"}`}>
            {resumen.porcentaje_presupuesto_consumido.toFixed(1)}% del límite presupuestario
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              resumen.esta_sobrecomprado
                ? "bg-gradient-to-r from-amber-500 to-rose-600"
                : "bg-gradient-to-r from-teal-500 to-emerald-600"
            }`}
            style={{ width: `${Math.min(resumen.porcentaje_presupuesto_consumido, 100)}%` }}
          />
        </div>
      </div>

      {/* ── TABLA COMPARATIVA POR PROVEEDOR CON DESGLOSE DE PRODUCTOS ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Desglose Comparativo y Proyección por Proveedor
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Hacé clic en cualquier proveedor para ver el desglose detallado de productos, costos, PVP minorista, mayorista y márgenes
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar proveedor o RUC..."
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3 px-3 w-8 text-center">#</th>
                <th className="py-3 px-3">Proveedor / Razón Social</th>
                <th className="py-3 px-3">RUC</th>
                <th className="py-3 px-3 text-right">Venta Actual</th>
                <th className="py-3 px-3 text-right">Mismo Período 2025</th>
                <th className="py-3 px-3 text-right">Proyección Cierre</th>
                <th className="py-3 px-3 text-right">Compras</th>
                <th className="py-3 px-3 text-right">Facturas</th>
                <th className="py-3 px-3 text-right">Ratio C/V</th>
                <th className="py-3 px-3 text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProveedores.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No se encontraron registros de compras o ventas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredProveedores.map((p: any, idx: number) => {
                  const isOver = p.ratio_pct > targetRatio
                  const isExpanded = expandedSupplierId === p.supplier_id

                  return (
                    <React.Fragment key={p.supplier_id || idx}>
                      <tr
                        onClick={() => p.supplier_id && p.supplier_id !== "sin_id" && toggleSupplierExpand(p.supplier_id, p.proveedor)}
                        className={`transition cursor-pointer ${
                          isExpanded
                            ? "bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-l-blue-600"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-mono text-slate-400">
                          <div className="flex items-center justify-center gap-1">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span>{idx + 1}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-1.5">
                            <span>{p.proveedor}</span>
                            {isExpanded && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-extrabold uppercase">
                                Desglosado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{p.ruc || "—"}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPYG(p.ventas)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-purple-700 dark:text-purple-300">
                          <div>
                            <span>{formatPYG(p.ventas_ly || 0)}</span>
                            {p.var_interanual_pct !== null && (
                              <span className={`block text-[9.5px] font-bold ${
                                p.var_interanual_pct >= 0 ? "text-emerald-600" : "text-rose-600"
                              }`}>
                                {p.var_interanual_pct >= 0 ? `+${p.var_interanual_pct}%` : `${p.var_interanual_pct}%`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatPYG(p.ventas_proyeccion || 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {formatPYG(p.compras)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">{p.facturas}</td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold">
                          <span className={isOver ? "text-rose-600" : "text-emerald-600"}>
                            {p.ratio_pct.toFixed(1)}%
                          </span>
                          <span className="block text-[9.5px] font-normal text-slate-400">
                            Proy: {p.ratio_proy_pct ? `${p.ratio_proy_pct.toFixed(1)}%` : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOver
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}>
                            {isOver ? "Sobrecompra" : "Saludable"}
                          </span>
                        </td>
                      </tr>

                      {/* ── ACORDEÓN EXPANDIBLE DE PRODUCTOS DEL PROVEEDOR ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0 bg-slate-50/80 dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800">
                            <div className="p-4 sm:p-5 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-blue-600" />
                                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                    Catálogo de Artículos Vendidos: {expandedSupplierName}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-500">
                                    ({supplierProducts.length} artículos en el período)
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 italic">
                                  Precios y márgenes sobre costo de reposición (sin impuestos agregados)
                                </span>
                              </div>

                              {loadingProducts ? (
                                <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                  Cargando desglose de precios y márgenes comerciales...
                                </div>
                              ) : supplierProducts.length === 0 ? (
                                <div className="py-6 text-center text-slate-400 text-xs">
                                  No hay artículos registrados con ventas en este período para el proveedor.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase">
                                      <tr>
                                        <th className="py-2.5 px-3">SKU</th>
                                        <th className="py-2.5 px-3">Código Barra</th>
                                        <th className="py-2.5 px-3">Descripción Producto</th>
                                        <th className="py-2.5 px-3 text-right">Unidades</th>
                                        <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                                        <th className="py-2.5 px-3 text-right">PVP Minorista</th>
                                        <th className="py-2.5 px-3 text-center">Mg. Minorista %</th>
                                        <th className="py-2.5 px-3 text-right">PV Mayorista</th>
                                        <th className="py-2.5 px-3 text-center">Mg. Mayorista %</th>
                                        <th className="py-2.5 px-3 text-right">Venta Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {supplierProducts.map((prod: any, pIdx: number) => {
                                        const mgMin = prod.margen_minorista_pct
                                        const mgMay = prod.margen_mayorista_pct

                                        return (
                                          <tr key={prod.product_id || pIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="py-2 px-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                                              {prod.sku}
                                            </td>
                                            <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                                              {prod.codigo_barra || "—"}
                                            </td>
                                            <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">
                                              {prod.producto}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                              {prod.unidades_vendidas?.toLocaleString("es-PY")}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                              {formatPYG(prod.costo_unitario || 0)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                              {formatPYG(prod.precio_minorista || 0)}
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono">
                                              {mgMin !== undefined && mgMin !== null ? (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                  mgMin >= 20
                                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                                    : mgMin >= 10
                                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                                }`}>
                                                  {mgMin.toFixed(1)}%
                                                </span>
                                              ) : (
                                                <span className="text-slate-400">—</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono">
                                              {prod.precio_mayorista ? (
                                                <div>
                                                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                                    {formatPYG(prod.precio_mayorista)}
                                                  </span>
                                                  {prod.mayorista_min_qty && (
                                                    <span className="block text-[9px] text-slate-400">
                                                      ≥{prod.mayorista_min_qty} un.
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-slate-400 text-[10px] italic">Sin escala</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono">
                                              {mgMay !== undefined && mgMay !== null ? (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                  mgMay >= 15
                                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                                    : mgMay >= 8
                                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                                }`}>
                                                  {mgMay.toFixed(1)}%
                                                </span>
                                              ) : (
                                                <span className="text-slate-400">—</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                              {formatPYG(prod.total_ventas)}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

