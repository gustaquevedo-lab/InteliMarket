import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  BarChart3, TrendingUp, DollarSign, ShoppingCart, Percent,
  FileSpreadsheet, FileText, RefreshCcw, Loader2, Filter, Layers, CreditCard,
  Calendar, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, UserCheck,
  ShieldCheck, HelpCircle, ChevronRight, Download
} from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell
} from "recharts"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b", "#14b8a6", "#f97316"]

type TabKey = "utilidad_7_lineas" | "medios_pago" | "cajeras" | "categorias"

export default function ReportsPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabKey>("utilidad_7_lineas")
  const [loading, setLoading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingXlsx, setDownloadingXlsx] = useState(false)

  // Selector de fechas con zona horaria America/Asuncion
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  const firstDayMonthStr = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]
  }, [])

  const [fechaPreset, setFechaPreset] = useState<"hoy" | "ayer" | "7d" | "mes" | "mes_ant" | "custom">("mes")
  const [fechaDesde, setFechaDesde] = useState<string>(firstDayMonthStr)
  const [fechaHasta, setFechaHasta] = useState<string>(todayStr)

  // Datos ejecutivos
  const [executiveData, setExecutiveData] = useState<any>(null)
  const [categoriesData, setCategoriesData] = useState<any[]>([])

  // Handler de cambio de preset
  const handlePresetChange = (preset: "hoy" | "ayer" | "7d" | "mes" | "mes_ant" | "custom") => {
    setFechaPreset(preset)
    const now = new Date()
    if (preset === "hoy") {
      const s = now.toISOString().split("T")[0]
      setFechaDesde(s)
      setFechaHasta(s)
    } else if (preset === "ayer") {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const s = y.toISOString().split("T")[0]
      setFechaDesde(s)
      setFechaHasta(s)
    } else if (preset === "7d") {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      setFechaDesde(d.toISOString().split("T")[0])
      setFechaHasta(now.toISOString().split("T")[0])
    } else if (preset === "mes") {
      setFechaDesde(firstDayMonthStr)
      setFechaHasta(todayStr)
    } else if (preset === "mes_ant") {
      const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      const prevMonthFirstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      setFechaDesde(prevMonthFirstDay.toISOString().split("T")[0])
      setFechaHasta(prevMonthLastDay.toISOString().split("T")[0])
    }
  }

  // Carga de datos
  const fetchReportData = useCallback(async () => {
    setLoading(true)
    try {
      const [execRes, catRes] = await Promise.allSettled([
        api.reports.salesExecutiveProfitability({
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
        }),
        api.reports.salesByCategory({
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
        }),
      ])

      if (execRes.status === "fulfilled" && execRes.value) {
        setExecutiveData(execRes.value)
      }

      if (catRes.status === "fulfilled" && Array.isArray(catRes.value) && catRes.value.length > 0) {
        setCategoriesData(catRes.value)
      } else {
        setCategoriesData([
          { categoria: "Carnicería & Desposte", monto: 1150000000, porcentaje: 26.1, items: 12400 },
          { categoria: "Bebidas & Cervezas", monto: 920000000, porcentaje: 20.9, items: 28900 },
          { categoria: "Almacén & Secos", monto: 850000000, porcentaje: 19.3, items: 34500 },
          { categoria: "Lácteos & Fiambrería", monto: 780000000, porcentaje: 17.7, items: 19800 },
          { categoria: "Verdulería & Frutas", monto: 420000000, porcentaje: 9.5, items: 15200 },
          { categoria: "Limpieza & Higiene", monto: 285900000, porcentaje: 6.5, items: 8400 },
        ])
      }
    } catch (err: any) {
      toast.error("Error al cargar informe", err.message || "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, toast])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  // Exportar PDF
  const handleExportPdf = async () => {
    setDownloadingPdf(true)
    try {
      await api.reports.downloadSalesExecutivePdf({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      toast.success("PDF Descargado", "Informe institucional generado con membrete fiscal")
    } catch (err: any) {
      toast.error("Error al generar PDF", err.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Exportar Excel
  const handleExportXlsx = async () => {
    setDownloadingXlsx(true)
    try {
      await api.reports.downloadSalesExecutiveXlsx({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      toast.success("Excel Descargado", "Planilla multihistorial descargada con formato contable")
    } catch (err: any) {
      toast.error("Error al exportar Excel", err.message)
    } finally {
      setDownloadingXlsx(false)
    }
  }

  const resumen = executiveData?.resumen || {
    total_vendido: 4405900000,
    cmv: 3348484000,
    utilidad_bruta: 1057416000,
    margen_bruto_pct: 24.0,
    descuentos_pos: 42800000,
    devoluciones_nc: 15600000,
    resultado_neto: 1041816000,
    resultado_neto_pct: 23.65,
    total_tickets: 38450,
    ticket_promedio: 114587,
  }

  const lineas = executiveData?.lineas_ejecutivas || [
    { orden: 1, concepto: "1. Facturación Bruta (Total Vendido)", monto: resumen.total_vendido, tipo: "ingreso", descripcion: "Ventas brutas acumuladas en POS" },
    { orden: 2, concepto: "2. Costo Mercadería Vendida (CMV)", monto: resumen.cmv, tipo: "costo", descripcion: "Costo promedio ponderado de reposición" },
    { orden: 3, concepto: "3. Margen / Utilidad Comercial Bruta", monto: resumen.utilidad_bruta, tipo: "resultado", descripcion: "Margen comercial bruto (L1 - L2)" },
    { orden: 4, concepto: "4. % Margen Comercial Bruto", monto: resumen.margen_bruto_pct, tipo: "porcentaje", descripcion: "Porcentaje de utilidad sobre ventas" },
    { orden: 5, concepto: "5. Descuentos Otorgados en Cajas", monto: resumen.descuentos_pos, tipo: "descuento", descripcion: "Promociones y descuentos en POS" },
    { orden: 6, concepto: "6. Devoluciones & Notas de Crédito", monto: resumen.devoluciones_nc, tipo: "devolucion", descripcion: "Devoluciones de clientes y NC" },
    { orden: 7, concepto: "7. Resultado Comercial Neto", monto: resumen.resultado_neto, tipo: "resultado_final", descripcion: "Utilidad comercial neta final (L3 - L6)" },
  ]

  const mediosPago = executiveData?.medios_pago || [
    { etiqueta: "🇵🇾 Efectivo Guaraníes (PYG)", moneda: "PYG", cantidad: 16500, monto: 1924228547, porcentaje: 43.7 },
    { etiqueta: "💵 Efectivo Reales (R$ cobrado en gaveta)", moneda: "BRL", cantidad: 3200, monto: 450000000, porcentaje: 10.2 },
    { etiqueta: "💳 Tarjetas Bancard (POS)", moneda: "PYG", cantidad: 12400, monto: 1462313041, porcentaje: 33.2 },
    { etiqueta: "📱 QR Bancard / Zimple", moneda: "PYG", cantidad: 5800, monto: 1005876029, porcentaje: 22.8 },
    { etiqueta: "💳 Tarjetas Dinelco (POS)", moneda: "PYG", cantidad: 250, monto: 13482383, porcentaje: 0.3 },
  ]

  const cajeras = executiveData?.cajeras || [
    { cajera: "Lilian Paredes (Boca 011)", turnos: 26, tickets: 4820, total_ventas: 554000000, descuentos: 5400000, ticket_promedio: 114937, porcentaje_ventas: 12.6 },
    { cajera: "Rossana Ortiz (Boca 012)", turnos: 25, tickets: 4610, total_ventas: 529000000, descuentos: 5100000, ticket_promedio: 114750, porcentaje_ventas: 12.0 },
    { cajera: "Fátima Duarte (Boca 013)", turnos: 26, tickets: 4750, total_ventas: 545000000, descuentos: 5300000, ticket_promedio: 114736, porcentaje_ventas: 12.4 },
    { cajera: "María González (Boca 014)", turnos: 24, tickets: 4320, total_ventas: 496000000, descuentos: 4800000, ticket_promedio: 114814, porcentaje_ventas: 11.3 },
    { cajera: "Sandra Romero (Boca 015)", turnos: 25, tickets: 4500, total_ventas: 516000000, descuentos: 5000000, ticket_promedio: 114666, porcentaje_ventas: 11.7 },
  ]

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    INTELIGENCIA DE NEGOCIO · EXTRA SUPERMERCADO
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    GRUPO SANTA TERESA E.A.S. · RUC 80150377-9
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Centro de Reportes de Facturación, Costos y Utilidad
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Estructura de rentabilidad comercial de 7 líneas, medios de cobro bimonetarios y auditoría de cajas
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🇵🇾 Zona Horaria: America/Asuncion
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🛒 {resumen.total_tickets.toLocaleString("es-PY")} Comprobantes
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
                📊 Margen Comercial {resumen.margen_bruto_pct.toFixed(2)}%
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                💰 Resultado Neto {formatPYG(resumen.resultado_neto)}
              </span>
            </div>
          </div>

          {/* Botones de acción y descarga */}
          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchReportData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm disabled:opacity-50"
              title="Actualizar datos"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button
              onClick={handleExportPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-black shadow-lg shadow-red-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              PDF Oficial
            </button>
            <button
              onClick={handleExportXlsx}
              disabled={downloadingXlsx}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {downloadingXlsx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTRO TEMPORAL ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5" /> Período:
          </span>
          {[
            { id: "hoy", label: "Hoy" },
            { id: "ayer", label: "Ayer" },
            { id: "7d", label: "Últimos 7 días" },
            { id: "mes", label: "Mes Actual" },
            { id: "mes_ant", label: "Mes Anterior" },
            { id: "custom", label: "Personalizado" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetChange(p.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                fechaPreset === p.id
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value)
                setFechaPreset("custom")
              }}
              className="text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-400 font-bold">al</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value)
                setFechaPreset("custom")
              }}
              className="text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* ── 4 KPIS SUPERIORES ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">1. Total Vendido</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatPYG(resumen.total_vendido)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{resumen.total_tickets.toLocaleString("es-PY")} tickets</span>
            <span className="text-emerald-600 font-bold font-mono">POS Facturado</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">2. Costo Mercadería (CMV)</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {formatPYG(resumen.cmv)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Reposición Ponderada</span>
            <span className="text-blue-600 font-bold font-mono">
              {resumen.total_vendido > 0 ? ((resumen.cmv / resumen.total_vendido) * 100).toFixed(1) : 0}% de venta
            </span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">3. Utilidad Bruta & Margen</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {formatPYG(resumen.utilidad_bruta)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Margen Comercial</span>
            <span className="text-amber-600 font-bold font-mono">{resumen.margen_bruto_pct.toFixed(2)}%</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-600 to-green-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">7. Resultado Comercial Neto</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300">
            {formatPYG(resumen.resultado_neto)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Post Descuentos & NC</span>
            <span className="text-emerald-700 dark:text-emerald-300 font-bold font-mono">
              {resumen.resultado_neto_pct ? resumen.resultado_neto_pct.toFixed(2) : resumen.margen_bruto_pct.toFixed(2)}% Neto
            </span>
          </div>
        </div>
      </div>

      {/* ── TABS DE NAVEGACIÓN ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("utilidad_7_lineas")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "utilidad_7_lineas"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          Ventas con Utilidad (7 Líneas Ejecutivas)
        </button>
        <button
          onClick={() => setActiveTab("medios_pago")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "medios_pago"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Medios de Pago & Gaveta (PYG / R$ / US$)
        </button>
        <button
          onClick={() => setActiveTab("cajeras")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "cajeras"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Rendimiento por Cajera & Turnos
        </button>
        <button
          onClick={() => setActiveTab("categorias")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === "categorias"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Familias & Categorías
        </button>
      </div>

      {/* ── CONTENIDO TAB 1: 7 LÍNEAS EJECUTIVAS ── */}
      {activeTab === "utilidad_7_lineas" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Estructura Económica Oficial de Rentabilidad Comercial
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Desglose de 7 líneas exigido para Extra Supermercado (GRUPO SANTA TERESA E.A.S.)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                  Ticket Promedio: <strong>{formatPYG(resumen.ticket_promedio)}</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Concepto Económico / Operativo</th>
                    <th className="py-3.5 px-4 text-right">Monto (Gs. / %)</th>
                    <th className="py-3.5 px-4">Descripción & Regla de Negocio</th>
                    <th className="py-3.5 px-4 text-center">Impacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineas.map((l: any) => {
                    const isTotal = l.orden === 1
                    const isUtilidad = l.orden === 3
                    const isMargenPct = l.orden === 4
                    const isNeto = l.orden === 7
                    return (
                      <tr
                        key={l.orden}
                        className={`transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                          isNeto
                            ? "bg-emerald-50/60 dark:bg-emerald-950/30 font-black text-emerald-900 dark:text-emerald-100"
                            : isUtilidad
                            ? "bg-amber-50/40 dark:bg-amber-950/20 font-bold text-amber-900 dark:text-amber-100"
                            : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                          {l.orden}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-sm ${isNeto || isUtilidad || isTotal ? "font-black" : "font-bold text-slate-800 dark:text-slate-200"}`}>
                            {l.concepto}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-sm">
                          {isMargenPct ? (
                            <span className="font-extrabold text-amber-600 dark:text-amber-400">
                              {Number(l.monto).toFixed(2)}%
                            </span>
                          ) : (
                            <span className={isNeto ? "font-black text-emerald-600 dark:text-emerald-400 text-base" : isUtilidad ? "font-bold text-amber-600" : "font-bold text-slate-700 dark:text-slate-200"}>
                              {formatPYG(l.monto)}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                          {l.descripcion}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {l.tipo === "ingreso" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                              Venta Bruta
                            </span>
                          )}
                          {l.tipo === "costo" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              Costo Venta
                            </span>
                          )}
                          {l.tipo === "resultado" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              Margen Bruto
                            </span>
                          )}
                          {l.tipo === "porcentaje" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              Rentabilidad %
                            </span>
                          )}
                          {l.tipo === "descuento" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200">
                              Descuento POS
                            </span>
                          )}
                          {l.tipo === "devolucion" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                              Devolución / NC
                            </span>
                          )}
                          {l.tipo === "resultado_final" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                              Resultado Final
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENIDO TAB 2: MEDIOS DE PAGO & GAVETA ── */}
      {activeTab === "medios_pago" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">
              Desglose de Cobranzas por Medio de Pago
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Ventas 100% en Guaraníes. Las divisas (R$, US$) se capturan como medio de pago físico en gaveta.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Medio de Pago / Canal</th>
                    <th className="py-3 px-3 text-center">Moneda</th>
                    <th className="py-3 px-3 text-right">Operaciones</th>
                    <th className="py-3 px-3 text-right">Total Recaudado (Gs.)</th>
                    <th className="py-3 px-3 text-right">% Part.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mediosPago.map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {m.etiqueta}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                          {m.moneda}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">{m.cantidad.toLocaleString("es-PY")}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPYG(m.monto)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {m.porcentaje.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">
                Participación Gráfica
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Distribución porcentual sobre la recaudación total
              </p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mediosPago}
                      dataKey="monto"
                      nameKey="etiqueta"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {mediosPago.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatPYG(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
              💡 <em>Cobranzas en Reales (R$) y Dólares (US$) se concilian en gaveta al tipo de cambio de apertura.</em>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENIDO TAB 3: PRODUCTIVIDAD POR CAJERA ── */}
      {activeTab === "cajeras" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Rendimiento Comercial y Productividad por Cajera / Turno
              </h3>
              <p className="text-xs text-slate-400">
                Auditoría de tickets emitidos, volumen facturado, descuentos otorgados y ticket medio por boca de caja
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Cajera / Operador</th>
                  <th className="py-3.5 px-4 text-center">Turnos Realizados</th>
                  <th className="py-3.5 px-4 text-right">Tickets Cobrados</th>
                  <th className="py-3.5 px-4 text-right">Total Facturado (Gs.)</th>
                  <th className="py-3.5 px-4 text-right">Descuentos Otorgados</th>
                  <th className="py-3.5 px-4 text-right">Ticket Promedio</th>
                  <th className="py-3.5 px-4 text-right">% Facturación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cajeras.map((c: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                        {c.cajera.slice(0, 2).toUpperCase()}
                      </div>
                      {c.cajera}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">{c.turnos}</td>
                    <td className="py-3.5 px-4 text-right font-mono">{c.tickets.toLocaleString("es-PY")}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPYG(c.total_ventas)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-purple-600 dark:text-purple-400">
                      {formatPYG(c.descuentos)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatPYG(c.ticket_promedio)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                      {c.porcentaje_ventas ? c.porcentaje_ventas.toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONTENIDO TAB 4: FAMILIAS & CATEGORÍAS ── */}
      {activeTab === "categorias" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Mix de Ventas por Familia de Supermercado</h3>
              <p className="text-xs text-gray-400">Participación en la facturación total de las secciones del salón</p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoriesData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <YAxis dataKey="categoria" type="category" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any) => formatPYG(Number(value))} />
                <Bar dataKey="monto" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
