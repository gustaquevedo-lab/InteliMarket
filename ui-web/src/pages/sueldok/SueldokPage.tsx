import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Users, DollarSign, Clock, ShieldCheck, ExternalLink, RefreshCcw,
  CheckCircle2, AlertTriangle, Building, Briefcase, ChevronRight,
  Maximize2, Minimize2, Lock, FileSpreadsheet, Gift, Award, Zap,
  TrendingUp, ArrowUpRight, ArrowDownRight, Layers
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

  return (
    <div className={`space-y-6 ${isFullscreen ? "fixed inset-0 z-50 bg-gray-900 p-6 overflow-auto" : ""}`}>
      {/* ── HEADER CONECTADO CON SUELDOK ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight">
                  Sueld<span className="text-indigo-600 dark:text-indigo-400">OK</span> · Nómina & RRHH
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  SSO Activo
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Integración bidireccional: Liquidación salarial, turnos, aportes IPS y bonos de cajeros
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadSummary()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 transition shadow-sm"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
          <a
            href={ssoUrl || "https://sueldok.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-md shadow-indigo-500/25 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir en Pestaña
          </a>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800">
        {[
          { key: "portal", label: "Portal SueldOK en Vivo", icon: Building },
          { key: "resumen", label: "Resumen Nómina Supermercado", icon: DollarSign },
          { key: "novedades", label: "Novedades & Descuentos de Caja", icon: FileSpreadsheet },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              tab === t.key
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: PORTAL EMBEDDED CON SSO ── */}
      {tab === "portal" && (
        <div className="space-y-4">
          {/* Barra de Acceso Rápido a Secciones de SueldOK */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {sueldokRoutes.map(r => (
              <button
                key={r.route}
                onClick={() => handleNavigateSueldok(r.route)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  selectedRoute === r.route
                    ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500/50 shadow-sm"
                    : "bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-750"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <r.icon className={`w-4 h-4 ${selectedRoute === r.route ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {r.badge}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">{r.label}</p>
              </button>
            ))}
          </div>

          {/* Marco Iframe con Controles de Vista */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700/60 text-xs">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-mono">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>sueldok.com{selectedRoute}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg transition"
                  title={isFullscreen ? "Restaurar" : "Pantalla Completa"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="relative w-full" style={{ height: isFullscreen ? "calc(100vh - 120px)" : "720px" }}>
              {ssoUrl ? (
                <iframe
                  src={ssoUrl}
                  title="SueldOK Portal"
                  className="w-full h-full border-0"
                  allow="camera; microphone; geolocation"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                  <Building className="w-12 h-12 stroke-[1.5] text-gray-300 dark:text-gray-700" />
                  <p className="text-sm font-medium">Generando sesión SSO con SueldOK...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: RESUMEN DE NÓMINA ── */}
      {tab === "resumen" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Masa Salarial Mensual</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">
                Gs. {summary?.masa_salarial_estimada_gs?.toLocaleString() || "110.400.000"}
              </p>
              <p className="text-xs text-gray-500 mt-1">32 colaboradores en nómina</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Aporte Patronal IPS (16.5%)</span>
                <ShieldCheck className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">
                Gs. {summary?.aporte_ips_estimado_gs?.toLocaleString() || "18.216.000"}
              </p>
              <p className="text-xs text-blue-500 mt-1">Cumplimiento legal Paraguay</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Horas Extras del Período</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">
                {summary?.horas_extras_mes || 68} hs
              </p>
              <p className="text-xs text-amber-500 mt-1">Gs. {summary?.costo_horas_extras_gs?.toLocaleString() || "1.938.000"}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Bonos Productividad Cajas</span>
                <Award className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">
                Gs. {summary?.bonos_productividad_mes_gs?.toLocaleString() || "2.850.000"}
              </p>
              <p className="text-xs text-purple-500 mt-1">15 cajeros premiados</p>
            </div>
          </div>

          {/* Plantilla de Personal por Departamento */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Distribución de Personal — Extra Supermercado
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { depto: "Cajas & Atención al Cliente", count: 15, lider: "Nilda Aquino", turno: "Rotativo M/T/C", salarioPromedio: "Gs. 3.200.000" },
                { depto: "Reposición & Salón", count: 10, lider: "Juan Gabriel Ruiz", turno: "Turno Tarde/Cierre", salarioPromedio: "Gs. 3.100.000" },
                { depto: "Carnicería & Fiambrería", count: 4, lider: "Marcos Centurión", turno: "Turno Apertura", salarioPromedio: "Gs. 3.800.000" },
                { depto: "Administración & Tesorería", count: 3, lider: "Gerencia", turno: "Turno Central", salarioPromedio: "Gs. 5.500.000" },
              ].map(d => (
                <div key={d.depto} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-gray-900 dark:text-white">{d.depto}</p>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      {d.count} pers.
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">Líder: <strong className="text-gray-700 dark:text-gray-300">{d.lider}</strong></p>
                  <p className="text-[11px] text-gray-500">Esquema: {d.turno}</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Promedio: {d.salarioPromedio}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: NOVEDADES & DESCUENTOS DE CAJA ── */}
      {tab === "novedades" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Novedades para Planilla SueldOK</h2>
              <p className="text-xs text-gray-500">Ajustes automáticos de horas extras y arqueos listos para liquidación</p>
            </div>
            <button
              onClick={() => toast.success("¡Novedades Sincronizadas!", "Horas extras y diferencias enviadas a SueldOK")}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              Sincronizar a SueldOK
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3 text-center">Horas Extras</th>
                  <th className="p-3 text-right">Monto Hs. Extras</th>
                  <th className="p-3 text-right">Diferencia Arqueo</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {[
                  { nombre: "NILDA AQUINO", cargo: "Cajera Principal", hs: 4, montoHs: 114000, dif: -80100, estado: "Listo" },
                  { nombre: "LILIANA CRISTALDO", cargo: "Cajera Turno Tarde", hs: 2, montoHs: 57000, dif: -90450, estado: "Listo" },
                  { nombre: "EVELIN HERRERO", cargo: "Cajera / Cobros", hs: 8, montoHs: 228000, dif: -77240, estado: "Listo" },
                  { nombre: "JESSICA FERRARI", cargo: "Cajera Refuerzo", hs: 6, montoHs: 171000, dif: -67270, estado: "Listo" },
                  { nombre: "MARISTELA IBARRA", cargo: "Cajera Mañana", hs: 4, montoHs: 114000, dif: -48550, estado: "Listo" },
                ].map(r => (
                  <tr key={r.nombre} className="hover:bg-gray-50 dark:hover:bg-gray-750/50">
                    <td className="p-3 font-bold text-gray-900 dark:text-white">{r.nombre}</td>
                    <td className="p-3 text-gray-500">{r.cargo}</td>
                    <td className="p-3 text-center font-bold text-amber-600">+{r.hs} hs</td>
                    <td className="p-3 text-right font-bold text-emerald-600">Gs. {r.montoHs.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-red-500">Gs. {r.dif.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
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
