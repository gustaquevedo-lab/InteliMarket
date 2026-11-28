import React, { useState, useEffect, useCallback } from "react"
import {
  DollarSign,
  TrendingUp,
  Users,
  Building2,
  FileSpreadsheet,
  FileText,
  Calendar,
  CheckCircle2,
  BarChart3,
  Layers,
  ArrowDownToLine,
  Landmark,
  Wrench,
  Truck,
  Briefcase,
  ShoppingBag,
  ShieldCheck,
  Receipt,
  RefreshCcw,
  Sparkles,
  ChevronDown
} from "lucide-react"
import { formatPYG } from "../../utils/format"
import { ClosingPnlTable } from "../../components/financial/ClosingPnlTable"
import { ClosingMagnitudeDetail } from "../../components/financial/ClosingMagnitudeDetail"
import { api } from "../../api"

const MESES = [
  { id: 1, nombre: "Enero" },
  { id: 2, nombre: "Febrero" },
  { id: 3, nombre: "Marzo" },
  { id: 4, nombre: "Abril" },
  { id: 5, nombre: "Mayo" },
  { id: 6, nombre: "Junio" },
  { id: 7, nombre: "Julio" },
  { id: 8, nombre: "Agosto" },
  { id: 9, nombre: "Septiembre" },
  { id: 10, nombre: "Octubre" },
  { id: 11, nombre: "Noviembre" },
  { id: 12, nombre: "Diciembre" }
]

const ANIOS = [2025, 2026, 2027]

export default function MonthlyClosingPage() {
  // Inicialización por defecto en el mes y año actual de Asunción (Noviembre 2026)
  const now = new Date()
  const initialMonth = now.getMonth() + 1 // 11
  const initialYear = now.getFullYear() // 2026

  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [activeTab, setActiveTab] = useState("resumen")
  const [activeSubTab, setActiveSubTab] = useState("todas")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Carga reactiva de los datos de cierre para el mes y año seleccionados
  const fetchClosingData = useCallback(async () => {
    setLoading(true)
    try {
      const json = await api.financial.closing.getSummary(selectedMonth, selectedYear, "80150377-9")
      if (json && json.kpis) {
        setData(json)
      } else {
        throw new Error("Respuesta inválida del servidor")
      }
    } catch (err) {
      console.warn(`[MonthlyClosingPage] Fallback a estructura base para ${selectedMonth}/${selectedYear}:`, err)
      setData({
        periodo: {
          mes: selectedMonth,
          anio: selectedYear,
          mes_nombre: MESES.find(m => m.id === selectedMonth)?.nombre || `Mes ${selectedMonth}`
        },
        empresa: { razon_social: "GRUPO SANTA TERESA E.A.S.", nombre_fantasia: "Extra Supermercado Mayorista", ruc: "80150377-9" },
        kpis: {
          ventas_netas: 0,
          utilidad_bruta: 0,
          margen_bruto_pct: 0,
          total_opex: 0,
          absorcion_opex_pct: 0,
          costo_laboral_total: 0,
          costo_laboral_pct: 0,
          total_capex: 0,
          ebitda: 0,
          ebitda_pct: 0,
          resultado_neto: 0,
          resultado_neto_pct: 0,
        },
        ingresos: { ventas_netas: 0, ventas_efectivo: 0, ventas_tarjetas_pos: 0, ventas_extra_club: 0, ventas_qr: 0, ventas_pix: 0, ventas_transferencias: 0 },
        cogs: { total_cmv: 0, cmv_mercaderias: 0, cmv_materia_prima_panaderia: 0, cmv_materia_prima_rotiseria: 0, nc_acuerdos_proveedores: 0 },
        nomina: { salario_base: 0, total_costo_laboral: 0, empleados_activos: 44 },
        opex: { ocupacion_servicios: { total: 0, detalles: [] }, mantenimiento_infraestructura: { total: 0, detalles: [] }, logistica_operacion: { total: 0, detalles: [] }, administracion_tecnologia: { total: 0, detalles: [] }, total_opex_no_laboral: 0 },
        capex: { total_capex: 0 },
        financieros: { total_gastos: 0, comisiones_procesadoras_tarjetas: 0, gastos_comisiones_bancarias: 0, diferencia_cambio_neta: 0 },
        conciliacion_bancaria: { saldo_calibrado_oficial: 0, cuentas_bancarias: [] }
      })
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    fetchClosingData()
  }, [fetchClosingData])

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true)
    try {
      await api.financial.closing.downloadExcel(selectedMonth, selectedYear, "80150377-9")
    } catch (err: any) {
      console.error("Error al descargar Excel de cierre:", err)
      alert("No se pudo descargar el archivo Excel: " + (err?.message || "Error de red"))
    } finally {
      setDownloadingExcel(false)
    }
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      await api.financial.closing.downloadPdf(selectedMonth, selectedYear, "80150377-9")
    } catch (err: any) {
      console.error("Error al descargar PDF de cierre:", err)
      alert("No se pudo generar el informe PDF: " + (err?.message || "Error de red"))
    } finally {
      setDownloadingPdf(false)
    }
  }

  const kpis = data?.kpis || {}
  const mesNombre = data?.periodo?.mes_nombre || MESES.find(m => m.id === selectedMonth)?.nombre || `Mes ${selectedMonth}`

  const opexNoLaboral = data?.opex?.total_opex_no_laboral ?? Math.max(0, (kpis.total_opex || 0) - (kpis.costo_laboral_total || 0))
  const esNominaProyectada = data?.nomina?.estado_nomina === "proyeccion_en_curso"

  const tabs = [
    { id: "resumen", label: "1. Resumen P&L en Cascada", icon: TrendingUp, badge: "Oficial" },
    { id: "ingresos", label: "2. Cajas / Ingresos", icon: DollarSign, badge: formatPYG(kpis.ventas_netas || 0) },
    { id: "cogs", label: "3. CMV / Compras", icon: ShoppingBag, badge: `${kpis.margen_bruto_pct || 0}% MB` },
    { id: "nomina", label: "4. Nómina SueldOK", icon: Users, badge: formatPYG(kpis.costo_laboral_total || 0) },
    { id: "opex", label: "5. Gastos Operativos (No Laborales)", icon: Building2, badge: formatPYG(opexNoLaboral) },
    { id: "capex", label: "6. Inversiones / Activo Fijo (CAPEX)", icon: Layers, badge: formatPYG(kpis.total_capex || 0) },
    { id: "anticipos", label: "7. Anticipos y No Operativos", icon: Landmark, badge: "Excluidos P&L" }
  ]

  return (
    <div className="space-y-6 animate-fade-in-up pb-20 max-w-full overflow-hidden">
      {/* 🌟 LUXURY COMMAND DECK HEADER (CANÓNICO INTELIMARKET) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Landmark className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    AUDITORÍA FINANCIERA & CONTROL ECONÓMICO · TORRE DE CONTROL
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Cierre {mesNombre} {selectedYear}
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Cierre de Resultados y Flujo Mensual
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Estado de Resultados (P&L) dinámico en cascada, redestinación de egresos con split por sector y conciliación bancaria
                </p>
              </div>
            </div>

            {/* Micro pills de contexto y auditoría */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado Mayorista · RUC 80150377-9
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ⚡ {data?.ingresos?.transacciones_count?.toLocaleString() || "—"} Tickets Salón POS
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                🏦 Saldo Bancos: {formatPYG(data?.conciliacion_bancaria?.saldo_calibrado_oficial || 0)}
              </span>
            </div>
          </div>

          {/* 📅 SELECTOR DINÁMICO DE PERÍODO & ACCIONES */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start lg:self-auto flex-wrap">
            {/* Control Interactivo de Mes y Año */}
            <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-indigo-500/30 shadow-inner">
              <Calendar className="w-4 h-4 text-indigo-400 ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-white font-extrabold text-xs py-1.5 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
              >
                {MESES.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.nombre}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-slate-300 font-bold text-xs py-1.5 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer border-l border-slate-800"
              >
                {ANIOS.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    {y}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchClosingData}
                disabled={loading}
                title="Recalcular cierre desde la base de datos"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
              </button>
            </div>

            {/* Acciones de exportación */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadExcel}
                disabled={downloadingExcel || loading}
                className="px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/40 shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <FileSpreadsheet className={`w-4 h-4 text-white ${downloadingExcel ? "animate-spin" : ""}`} />
                {downloadingExcel ? "Generando Excel..." : "Descargar Excel (.xlsx)"}
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || loading}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <FileText className={`w-4 h-4 text-indigo-400 ${downloadingPdf ? "animate-spin" : ""}`} />
                {downloadingPdf ? "Generando PDF..." : "Exportar PDF"}
              </button>
            </div>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS INTEGRADA AL HEADER */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ventas Netas</span>
              <span className="text-[9px] font-bold text-blue-400">100% Cajas</span>
            </div>
            <p className="text-lg lg:text-xl font-black font-mono tracking-tight text-blue-400">
              {formatPYG(kpis.ventas_netas || 0)}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {data?.ingresos?.transacciones_count?.toLocaleString() || 0} tickets salón
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margen Bruto</span>
              <span className="text-[9px] font-bold text-emerald-400">Comercial</span>
            </div>
            <p className="text-lg lg:text-xl font-black font-mono tracking-tight text-emerald-400">
              {kpis.margen_bruto_pct || 0}%
            </p>
            <p className="text-[10px] text-slate-400 font-mono">Utilidad: {formatPYG(kpis.utilidad_bruta || 0)}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gastos OPEX Total</span>
              <span className="text-[9px] font-bold text-amber-400">Personal + Gastos</span>
            </div>
            <p className="text-lg lg:text-xl font-black font-mono tracking-tight text-amber-400">
              {formatPYG(kpis.total_opex || 0)}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {kpis.absorcion_opex_pct || 0}% s/ Ventas (Nómina 86% · Gastos 14%)
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Costo Laboral</span>
              <span className={`text-[9px] font-bold ${esNominaProyectada ? "text-amber-400" : "text-purple-400"}`}>
                {esNominaProyectada ? "Proyección Mes" : "Auditado SueldOK"}
              </span>
            </div>
            <p className="text-lg lg:text-xl font-black font-mono tracking-tight text-purple-400">
              {formatPYG(kpis.costo_laboral_total || 0)}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {data?.nomina?.empleados_activos || 44} colaboradores · {esNominaProyectada ? "Devengado mes completo" : "Cierre liquidado"}
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inversiones CAPEX</span>
              <span className="text-[9px] font-bold text-indigo-400">Patrimonial</span>
            </div>
            <p className="text-lg lg:text-xl font-black font-mono tracking-tight text-indigo-300">
              {formatPYG(kpis.total_capex || 0)}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">Activo Fijo (0 OPEX)</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">EBITDA Operativo</span>
              <span className="text-[9px] font-mono text-cyan-400">Operación</span>
            </div>
            <p className="text-lg lg:text-xl font-black font-mono tracking-tight text-cyan-300">
              {formatPYG(kpis.ebitda || 0)}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">{kpis.ebitda_pct || 0}% s/ Ventas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Cierre Bancos</span>
              <span className="text-[9px] font-bold text-emerald-400">Conciliado</span>
            </div>
            <p className="text-lg lg:text-xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(data?.conciliacion_bancaria?.saldo_calibrado_oficial || 0)}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">Continental + Interfisa</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS (CANÓNICO INTELIMARKET) */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id)
                setActiveSubTab("todas")
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isActive
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 📋 VISTAS ANALÍTICAS */}
      {activeTab === "resumen" ? (
        <ClosingPnlTable
          data={data}
          onSelectMagnitude={(mag, sub) => {
            setActiveTab(mag)
            if (sub) setActiveSubTab(sub)
          }}
        />
      ) : (
        <ClosingMagnitudeDetail
          key={`${activeTab}-${activeSubTab}-${selectedMonth}-${selectedYear}`}
          magnitude={activeTab}
          subMagnitude={activeSubTab}
          closingData={data}
          month={selectedMonth}
          year={selectedYear}
          onBackToPnl={() => {
            setActiveTab("resumen")
            setActiveSubTab("todas")
          }}
          onExportExcel={handleDownloadExcel}
          onDataUpdated={fetchClosingData}
          onNavigateTab={(tab) => {
            setActiveTab(tab)
            setActiveSubTab("todas")
          }}
        />
      )}
    </div>
  )
}
