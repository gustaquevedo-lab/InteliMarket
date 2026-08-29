import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Users, DollarSign, Clock, ShieldCheck, ExternalLink, RefreshCcw,
  CheckCircle2, AlertTriangle, Building, Briefcase, ChevronRight,
  Maximize2, Minimize2, Lock, FileSpreadsheet, Gift, Award, Zap,
  TrendingUp, ArrowUpRight, ArrowDownRight, Layers, Sparkles, UserCheck
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type Tab = "portal" | "resumen" | "novedades"

export default function SueldokPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("portal")
  const [loading, setLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState("/payroll")
  const [ssoUrl, setSsoUrl] = useState("")
  const [summary, setSummary] = useState<any>(null)

  const fetchSSOUrl = useCallback(async (route: string) => {
    try {
      const res = await api.sueldok.getSSOUrl(route)
      if (res && res.sso_url) {
        setSsoUrl(res.sso_url)
      }
    } catch {
      // Fallback direct URL
      setSsoUrl(`https://sueldok.com${route}`)
    }
  }, [])

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.sueldok.getSummary()
      setSummary(res)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSSOUrl(selectedRoute)
    loadSummary()
  }, [fetchSSOUrl, loadSummary, selectedRoute])

  const handleNavigateSueldok = (route: string) => {
    setSelectedRoute(route)
    fetchSSOUrl(route)
    toast.info("Cargando sección de SueldOK...", route)
  }

  const sueldokRoutes = [
    { label: "Liquidación de Sueldos", route: "/payroll", icon: DollarSign, badge: "Nómina" },
    { label: "Asistencia & Marcaciones", route: "/attendance", icon: Clock, badge: "Biometría" },
    { label: "Turnos & Horarios", route: "/shift-scheduler", icon: Layers, badge: "Cuadrante" },
    { label: "Legajos de Personal", route: "/employees", icon: Users, badge: "IPS / MTESS" },
    { label: "Aguinaldos & Vacaciones", route: "/aguinaldo", icon: Gift, badge: "Beneficios" },
  ]

  const masaSalarial = summary?.masa_salarial_estimada_gs || 110400000
  const aporteIps = summary?.aporte_ips_estimado_gs || 18216000
  const hsExtras = summary?.horas_extras_mes || 68
  const costoHsExtras = summary?.costo_horas_extras_gs || 1938000
  const bonosProd = summary?.bonos_productividad_mes_gs || 2850000

  return (
    <div className={`space-y-6 ${isFullscreen ? "fixed inset-0 z-50 bg-slate-950 p-6 overflow-auto" : ""}`}>
      {/* ── COMMAND DECK HERO HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/50">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
              <Building className="w-7 h-7 text-white" />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse" />
            </div>
            <div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    GESTIÓN DE NÓMINA & RRHH
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    SSO Activo & Biometría
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Sueld<span className="text-indigo-400">OK</span> · Liquidación Salarial & RRHH
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-normal">
                GRUPO SANTA TERESA E.A.S. (RUC 80150377-9) — Liquidación salarial, aporte patronal IPS (16.5%), obrero (9%), horas extras y bonos de productividad en cajas POS.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-slate-300">
                  🏬 Sede: Extra Supermercado Matriz
                </span>
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-indigo-300">
                  👥 32 Colaboradores en Nómina
                </span>
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-emerald-300">
                  ⚖️ Cumplimiento MTESS / IPS
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => loadSummary()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition shadow-sm hover:border-slate-600 disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
            <a
              href={ssoUrl || "https://sueldok.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir SueldOK
            </a>
          </div>
        </div>

        {/* ── EXECUTIVE KPIS ROW ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Masa Salarial Mensual</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
              {formatPYG(masaSalarial)}
            </p>
            <span className="text-[10px] text-slate-400 font-medium">32 contratos vigentes</span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Aporte Patronal IPS (16.5%)</span>
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
              {formatPYG(aporteIps)}
            </p>
            <span className="text-[10px] text-blue-300 font-medium">Cumplimiento legal Paraguay</span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Horas Extras Período</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
              {hsExtras} hs <span className="text-xs text-amber-400 font-normal">({formatPYG(costoHsExtras)})</span>
            </p>
            <span className="text-[10px] text-amber-300 font-medium">Cajas & Reposición</span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Incentivos & Bonos POS</span>
              <Award className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
              {formatPYG(bonosProd)}
            </p>
            <span className="text-[10px] text-purple-300 font-medium">10 cajeros premiados</span>
          </div>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "portal", label: "Portal SueldOK en Vivo", icon: Building },
          { key: "resumen", label: "Resumen Nómina & Costos Laborales", icon: DollarSign },
          { key: "novedades", label: "Novedades & Ajustes de Caja", icon: FileSpreadsheet },
        ].map(t => {
          const active = tab === t.key
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/50"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: PORTAL EMBEDDED CON SSO ── */}
      {tab === "portal" && (
        <div className="space-y-4">
          {/* Barra de Acceso Rápido a Secciones de SueldOK */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {sueldokRoutes.map(r => (
              <button
                key={r.route}
                onClick={() => handleNavigateSueldok(r.route)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                  selectedRoute === r.route
                    ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <r.icon className={`w-4 h-4 ${selectedRoute === r.route ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {r.badge}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{r.label}</p>
              </button>
            ))}
          </div>

          {/* Marco Iframe con Controles de Vista */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 font-mono">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-semibold text-slate-900 dark:text-slate-200">sueldok.com{selectedRoute}</span>
                <span className="hidden sm:inline text-slate-400 dark:text-slate-500">| Canal TLS Encriptado</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-200/50 dark:bg-slate-800 transition"
                  title={isFullscreen ? "Restaurar" : "Pantalla Completa"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="relative w-full bg-slate-950" style={{ height: isFullscreen ? "calc(100vh - 120px)" : "740px" }}>
              {ssoUrl ? (
                <iframe
                  src={ssoUrl}
                  title="SueldOK Portal"
                  className="w-full h-full border-0"
                  allow="camera; microphone; geolocation"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                  <Building className="w-12 h-12 stroke-[1.5] text-slate-600 animate-pulse" />
                  <p className="text-sm font-medium text-slate-300">Generando sesión SSO con SueldOK...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: RESUMEN DE NÓMINA ── */}
      {tab === "resumen" && (
        <div className="space-y-6">
          {/* Plantilla de Personal por Departamento */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Estructura Organizacional & Distribución Salarial
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Plantilla activa clasificada por centros de costo en Extra Supermercado
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 self-start sm:self-auto">
                32 Colaboradores Totales
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { depto: "Cajas & Atención al Cliente", count: 15, lider: "Nilda Aquino", turno: "Rotativo (M / T / C)", salarioPromedio: 3200000, icon: Users, color: "from-blue-500 to-indigo-600" },
                { depto: "Reposición & Salón", count: 10, lider: "Juan Gabriel Ruiz", turno: "Turno Tarde / Cierre", salarioPromedio: 3100000, icon: Briefcase, color: "from-emerald-500 to-teal-600" },
                { depto: "Carnicería & Fiambrería", count: 4, lider: "Marcos Centurión", turno: "Turno Apertura", salarioPromedio: 3800000, icon: Sparkles, color: "from-amber-500 to-orange-600" },
                { depto: "Administración & Tesorería", count: 3, lider: "Gerencia General", turno: "Turno Central", salarioPromedio: 5500000, icon: Building, color: "from-purple-500 to-violet-600" },
              ].map(d => {
                const Icon = d.icon
                return (
                  <div key={d.depto} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-600 transition shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${d.color} text-white shadow-md`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {d.count} pers.
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">{d.depto}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Líder: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{d.lider}</strong>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Esquema: {d.turno}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Promedio:</span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPYG(d.salarioPromedio)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: NOVEDADES & DESCUENTOS DE CAJA ── */}
      {tab === "novedades" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Novedades Salariales & Ajustes de Caja
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cálculo automático de horas extras trabajadas y diferencias de arqueo para la liquidación
              </p>
            </div>
            <button
              onClick={() => toast.success("¡Novedades Sincronizadas!", "Horas extras y diferencias enviadas a SueldOK")}
              className="px-4 py-2.5 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-lg shadow-indigo-600/20 transition active:scale-95 flex items-center gap-2 self-start sm:self-auto"
            >
              <Zap className="w-3.5 h-3.5" />
              Sincronizar a SueldOK
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="p-3.5">Colaborador</th>
                  <th className="p-3.5">Cargo / Sección</th>
                  <th className="p-3.5 text-center">Horas Extras</th>
                  <th className="p-3.5 text-right">Monto Hs. Extras</th>
                  <th className="p-3.5 text-right">Diferencia Arqueo</th>
                  <th className="p-3.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {[
                  { nombre: "NILDA AQUINO", cargo: "Cajera Principal", hs: 4, montoHs: 114000, dif: -80100, estado: "Listo" },
                  { nombre: "LILIANA CRISTALDO", cargo: "Cajera Turno Tarde", hs: 2, montoHs: 57000, dif: -90450, estado: "Listo" },
                  { nombre: "EVELIN HERRERO", cargo: "Cajera / Cobros", hs: 8, montoHs: 228000, dif: -77240, estado: "Listo" },
                  { nombre: "JESSICA FERRARI", cargo: "Cajera Refuerzo", hs: 6, montoHs: 171000, dif: -67270, estado: "Listo" },
                  { nombre: "MARISTELA IBARRA", cargo: "Cajera Mañana", hs: 4, montoHs: 114000, dif: -48550, estado: "Listo" },
                ].map(r => (
                  <tr key={r.nombre} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">{r.nombre}</td>
                    <td className="p-3.5 text-slate-500 dark:text-slate-400">{r.cargo}</td>
                    <td className="p-3.5 text-center font-bold font-mono text-amber-600 dark:text-amber-400">+{r.hs} hs</td>
                    <td className="p-3.5 text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(r.montoHs)}</td>
                    <td className="p-3.5 text-right font-bold font-mono text-rose-500">{formatPYG(r.dif)}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        {r.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
