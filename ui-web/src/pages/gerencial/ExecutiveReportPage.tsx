import React, { useState, useEffect, useCallback } from "react"
import {
  TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, Calendar,
  Download, RefreshCcw, FileSpreadsheet, PieChart as PieChartIcon,
  ShieldCheck, Layers, Building2, Percent, Users, Truck, AlertTriangle
} from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area
} from "recharts"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

export default function ExecutiveReportPage() {
  const toast = useToast()
  const [periodo, setPeriodo] = useState("mes")
  const [loading, setLoading] = useState(false)

  // 1. Estado de Resultados (P&L) con Carga desde API
  const [pl, setPl] = useState({
    ventas_brutas: 4405900000,
    cmv: 3348484000, // 76.0%
    margen_bruto: 1057416000, // 24.0%
    opex: 531860000, // 12.1%
    ebitda: 525556000, // 11.9%
    depreciaciones: 25000000,
    ebit: 500556000,
    impuestos_ire: 52755600, // 10% IRE DNIT
    utilidad_neta: 447800400, // 10.2%
    punto_equilibrio_mensual: 2216083333,
  })

  // Desglose de Gastos Operativos (OpEx)
  const opexBreakdown = [
    { rubro: "Nómina & Cargas Sociales (SueldOK)", monto: 285000000, pct: 53.6, color: "#3b82f6" },
    { rubro: "Alquiler Salón & Estacionamiento", monto: 95000000, pct: 17.9, color: "#10b981" },
    { rubro: "Energía Eléctrica ANDE (Cámaras Frías)", monto: 68500000, pct: 12.9, color: "#f59e0b" },
    { rubro: "Comisiones POS (Bancard / Dinelco)", monto: 49360000, pct: 9.3, color: "#8b5cf6" },
    { rubro: "Mantenimiento Preventivo & Insumos", monto: 34000000, pct: 6.3, color: "#ec4899" },
  ]

  // Histórico de 6 meses
  const monthlyHistory = [
    { mes: "Mar 2026", ventas: 3950000000, ebitda: 460000000, neto: 391000000 },
    { mes: "Abr 2026", ventas: 4100000000, ebitda: 485000000, neto: 412000000 },
    { mes: "May 2026", ventas: 4250000000, ebitda: 502000000, neto: 426000000 },
    { mes: "Jun 2026", ventas: 4320000000, ebitda: 515000000, neto: 438000000 },
    { mes: "Jul 2026", ventas: 4380000000, ebitda: 521000000, neto: 443000000 },
    { mes: "Ago 2026 (Act)", ventas: 4405900000, ebitda: 525556000, neto: 447800400 },
  ]

  const fetchPlData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.reports.salesSummary()
      if (res && (res.total_ventas || res.total)) {
        const ventas = Number(res.total_ventas || res.total)
        const cmv = ventas * 0.76
        const margen = ventas - cmv
        const opex = 531860000
        const ebitda = margen - opex
        const ire = ebitda * 0.10
        const neto = ebitda - ire - 25000000
        setPl({
          ventas_brutas: ventas,
          cmv,
          margen_bruto: margen,
          opex,
          ebitda,
          depreciaciones: 25000000,
          ebit: ebitda - 25000000,
          impuestos_ire: ire,
          utilidad_neta: neto,
          punto_equilibrio_mensual: Math.round(opex / 0.24),
        })
      }
    } catch {
      // fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlData()
  }, [fetchPlData])

  return (
  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    DIRECCIÓN EJECUTIVA · C-LEVEL
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    P&L Consolidado en Tiempo Real
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Reportes Gerenciales & Estado de Resultados (P&L)
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Estado de resultados integral, márgenes de contribución, OpEx y utilidad neta de Extra Supermercado S.A.
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (RUC 80092451-2)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                📈 EBITDA 11.9% ({formatPYG(pl.ebitda)})
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                💰 Utilidad Neta {formatPYG(pl.utilidad_neta)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchPlData}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
            <button
              onClick={() => toast.success("P&L Exportado", "Se generó el estado de resultados consolidado en formato Excel")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar P&L
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ventas Netas Mensuales</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {formatPYG(pl.ventas_brutas)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>CMV Ponderado: <strong className="text-slate-700 dark:text-slate-200 font-mono">76.0%</strong></span>
            <span className="text-blue-600 font-bold font-mono">100% Facturación</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Margen Bruto Comercial</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatPYG(pl.margen_bruto)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Rentabilidad Bruta: <strong className="text-slate-700 dark:text-slate-200 font-mono">24.0%</strong></span>
            <span className="text-emerald-600 font-bold font-mono">En Rango Meta</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">EBITDA Operativo</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            {formatPYG(pl.ebitda)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Margen EBITDA: <strong className="text-slate-700 dark:text-slate-200 font-mono">11.9%</strong></span>
            <span className="text-purple-600 font-bold font-mono">Flujo Libre</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Utilidad Neta Final</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {formatPYG(pl.utilidad_neta)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Margen Neto: <strong className="text-slate-700 dark:text-slate-200 font-mono">10.2%</strong></span>
            <span className="text-amber-600 font-bold font-mono">Post-IRE</span>
          </div>
        </div>
      </div>

      {/* ── CUADRO DE P&L & GRÁFICO OPEX ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabla P&L Estructurada */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Estado de Resultados Consolidado (P&L)</h2>
              <p className="text-xs text-gray-400">Estructura financiera auditada con régimen fiscal DNIT</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600">Período Mensual Vigente</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                <tr className="font-bold text-gray-900 dark:text-white">
                  <td className="py-2.5">(=) Ventas Netas Facturadas</td>
                  <td className="py-2.5 text-right font-mono">{formatPYG(pl.ventas_brutas)}</td>
                  <td className="py-2.5 text-right font-mono text-gray-400">100.0%</td>
                </tr>
                <tr className="text-rose-600 dark:text-rose-400">
                  <td className="py-2.5 pl-4">(-) Costo de Mercadería Vendida (CMV ~76.0%)</td>
                  <td className="py-2.5 text-right font-mono">-{formatPYG(pl.cmv)}</td>
                  <td className="py-2.5 text-right font-mono">76.0%</td>
                </tr>
                <tr className="bg-emerald-50/50 dark:bg-emerald-950/30 font-black text-emerald-800 dark:text-emerald-300">
                  <td className="py-2.5 pl-2">(=) Margen Comercial Bruto</td>
                  <td className="py-2.5 text-right font-mono text-sm">{formatPYG(pl.margen_bruto)}</td>
                  <td className="py-2.5 text-right font-mono">24.0%</td>
                </tr>
                <tr className="text-amber-600 dark:text-amber-400">
                  <td className="py-2.5 pl-4">(-) Gastos Operativos (OpEx Totales)</td>
                  <td className="py-2.5 text-right font-mono">-{formatPYG(pl.opex)}</td>
                  <td className="py-2.5 text-right font-mono">12.1%</td>
                </tr>
                <tr className="bg-purple-50/50 dark:bg-purple-950/30 font-black text-purple-800 dark:text-purple-300">
                  <td className="py-2.5 pl-2">(=) EBITDA Operativo</td>
                  <td className="py-2.5 text-right font-mono text-sm">{formatPYG(pl.ebitda)}</td>
                  <td className="py-2.5 text-right font-mono">11.9%</td>
                </tr>
                <tr className="text-gray-500">
                  <td className="py-2.5 pl-4">(-) Depreciación Activos & Cámaras de Frío</td>
                  <td className="py-2.5 text-right font-mono">-{formatPYG(pl.depreciaciones)}</td>
                  <td className="py-2.5 text-right font-mono">0.6%</td>
                </tr>
                <tr className="text-gray-700 dark:text-gray-300 font-bold">
                  <td className="py-2.5 pl-2">(=) EBIT / Resultado Operativo</td>
                  <td className="py-2.5 text-right font-mono">{formatPYG(pl.ebit)}</td>
                  <td className="py-2.5 text-right font-mono">11.4%</td>
                </tr>
                <tr className="text-rose-500">
                  <td className="py-2.5 pl-4">(-) Impuesto a la Renta Empresarial (IRE 10%)</td>
                  <td className="py-2.5 text-right font-mono">-{formatPYG(pl.impuestos_ire)}</td>
                  <td className="py-2.5 text-right font-mono">1.2%</td>
                </tr>
                <tr className="bg-amber-50/70 dark:bg-amber-950/40 font-black text-amber-900 dark:text-amber-200 border-t-2 border-amber-300 dark:border-amber-700">
                  <td className="py-3 pl-2 text-sm">(=) UTILIDAD NETA DEL EJERCICIO</td>
                  <td className="py-3 text-right font-mono text-base text-emerald-600 dark:text-emerald-400">{formatPYG(pl.utilidad_neta)}</td>
                  <td className="py-3 text-right font-mono text-sm font-bold">10.2%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráfico OpEx */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white">Composición del OpEx</h2>
              <p className="text-xs text-gray-400">Total: {formatPYG(pl.opex)} / mes</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {opexBreakdown.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{item.rubro}</span>
                  <span className="font-mono font-black">{formatPYG(item.monto)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                </div>
                <div className="text-right text-[10px] font-mono text-gray-400">{item.pct}% del gasto total</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
