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
    total_compras: 0,
    ratio_real_pct: 0,
    presupuesto_maximo_compras: 0,
    saldo_otb_disponible: 0,
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
            Define el tope máximo de compras como porcentaje de las ventas para proteger el capital de trabajo de Extra Supermercado
          </p>
        </div>

        {/* Controles de Ratio, Filtro de Provisión y Descargas */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de Tipo de Provisión (Mercaderías vs Servicios) */}
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

      {/* ── 4 KPIS DE CONTROL PRESUPUESTARIO ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Ventas */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Ventas Facturadas</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatPYG(resumen.total_ventas)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{resumen.total_tickets_ventas?.toLocaleString("es-PY")} tickets</span>
            <span className="text-emerald-600 font-bold font-mono">100% Salón</span>
          </div>
        </div>

        {/* KPI 2: Total Compras */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Compras Recibidas</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {formatPYG(resumen.total_compras)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{resumen.total_facturas_compras?.toLocaleString("es-PY")} facturas</span>
            <span className="text-blue-600 font-bold font-mono">Recepción Stock</span>
          </div>
        </div>

        {/* KPI 3: Ratio Real Compras/Ventas */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className={`h-1 w-full absolute top-0 left-0 ${resumen.esta_sobrecomprado ? "bg-rose-500" : "bg-emerald-500"}`} />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ratio Compras / Ventas</span>
            <div className={`p-2 rounded-xl ${resumen.esta_sobrecomprado ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600" : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600"}`}>
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black font-mono ${resumen.esta_sobrecomprado ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {resumen.ratio_real_pct.toFixed(2)}%
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Tope Meta: {targetRatio}%</span>
            <span className={`font-bold font-mono ${resumen.esta_sobrecomprado ? "text-rose-600" : "text-emerald-600"}`}>
              {resumen.esta_sobrecomprado ? "Excedido" : "En Rango"}
            </span>
          </div>
        </div>

        {/* KPI 4: Saldo OTB Disponible */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className={`h-1 w-full absolute top-0 left-0 ${resumen.saldo_otb_disponible < 0 ? "bg-rose-500" : "bg-amber-500"}`} />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {resumen.saldo_otb_disponible < 0 ? "Exceso de Compra (Sobrecompra)" : "Presupuesto OTB Disponible"}
            </span>
            <div className={`p-2 rounded-xl ${resumen.saldo_otb_disponible < 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black font-mono ${resumen.saldo_otb_disponible < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
            {formatPYG(Math.abs(resumen.saldo_otb_disponible))}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Presupuesto: {formatPYG(resumen.presupuesto_maximo_compras)}</span>
            <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
              {resumen.porcentaje_presupuesto_consumido.toFixed(1)}% Usado
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
            Consumo del Techo de Compras ({targetRatio}% de Ventas)
          </span>
          <span className={`font-mono ${resumen.esta_sobrecomprado ? "text-rose-600 font-black" : "text-slate-600 dark:text-slate-300"}`}>
            {resumen.porcentaje_presupuesto_consumido.toFixed(1)}% del límite presupuestario
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3.5 rounded-full overflow-hidden p-0.5">
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

      {/* ── TABLA COMPARATIVA POR PROVEEDOR ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Desglose Comparativo de Compras y Ventas por Proveedor
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditoría directa de ingresos de mercadería vs. ventas facturadas por proveedor en el período
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
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Proveedor / Razón Social</th>
                <th className="py-3 px-3">RUC</th>
                <th className="py-3 px-3 text-right">Ventas en Salón (Gs.)</th>
                <th className="py-3 px-3 text-right">Compras Recibidas (Gs.)</th>
                <th className="py-3 px-3 text-right">Facturas</th>
                <th className="py-3 px-3 text-right">Ratio C/V (%)</th>
                <th className="py-3 px-3 text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProveedores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No se encontraron registros de compras o ventas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredProveedores.map((p: any, idx: number) => {
                  const isOver = p.ratio_pct > targetRatio
                  return (
                    <tr key={p.supplier_id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">{p.proveedor}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{p.ruc || "—"}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPYG(p.ventas)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatPYG(p.compras)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">{p.facturas}</td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold">
                        <span className={isOver ? "text-rose-600" : "text-emerald-600"}>
                          {p.ratio_pct.toFixed(1)}%
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
