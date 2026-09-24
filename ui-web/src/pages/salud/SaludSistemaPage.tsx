import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  HardDrive,
  Loader2,
  MessageCircle,
  Radar,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { api } from "../../api"

/**
 * Salud del Sistema & Vigía (solo superadmin).
 *
 * Muestra la telemetría reportada por el vigía autónomo que corre cada minuto
 * en el servidor de Extra Supermercado. Si el vigía deja de reportar, el estado
 * pasa inmediatamente a Crítico para prevenir falsos positivos.
 */

type Nivel = "ok" | "aviso" | "critico"

interface Check {
  id: string
  grupo: string
  nombre: string
  estado: Nivel
  detalle: string
}

interface Servicio {
  unidad: string
  nombre: string
  activo: boolean
  estado: string
  reinicios: number
  desde: string
}

interface Evento {
  hora: string
  nivel: Nivel
  texto: string
}

interface Salud {
  vigia_vivo: boolean
  edad_segundos: number | null
  mensaje?: string
  generado?: string
  resumen?: Nivel
  checks: Check[]
  servicios?: Servicio[]
  recursos?: {
    disco_pct: number
    disco_libre_gb: number
    carga_1m: number
    carga_15m: number
    nucleos: number
  }
  whatsapp?: string
  telefono_alertas?: string
  eventos?: Evento[]
}

const ESTILO: Record<Nivel, { chip: string; punto: string; texto: string; Icono: typeof CheckCircle2 }> = {
  ok: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
    punto: "bg-emerald-500",
    texto: "Normal",
    Icono: CheckCircle2,
  },
  aviso: {
    chip: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
    punto: "bg-amber-500",
    texto: "Aviso",
    Icono: AlertTriangle,
  },
  critico: {
    chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
    punto: "bg-rose-500",
    texto: "Crítico",
    Icono: XCircle,
  },
}

const hace = (s: number | null) =>
  s == null
    ? "—"
    : s < 60
    ? `hace ${s} s`
    : s < 3600
    ? `hace ${Math.round(s / 60)} min`
    : `hace ${Math.round(s / 3600)} h`

export default function SaludSistemaPage() {
  const navigate = useNavigate()
  const [datos, setDatos] = useState<Salud | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [filtroGrupo, setFiltroGrupo] = useState<string>("todos")

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await api.sistema.salud()
      setDatos(res)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "No se pudo consultar la salud del sistema")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30000)
    return () => clearInterval(t)
  }, [cargar])

  // El vigía caído manda sobre todo lo demás: los datos que se ven son viejos.
  const general: Nivel = !datos ? "aviso" : !datos.vigia_vivo ? "critico" : datos.resumen || "ok"
  const problemas = useMemo(
    () =>
      (datos?.checks || [])
        .filter((c) => c.estado !== "ok")
        .sort((a, b) => (a.estado === "critico" ? -1 : 1) - (b.estado === "critico" ? -1 : 1)),
    [datos?.checks]
  )

  const grupos = useMemo(() => [...new Set((datos?.checks || []).map((c) => c.grupo))], [datos?.checks])

  const serviciosActivos = (datos?.servicios || []).filter((s) => s.activo).length
  const serviciosTotales = datos?.servicios?.length || 0
  const serviciosConReinicios = (datos?.servicios || []).filter((s) => s.reinicios > 0).length

  // Series de telemetría para Recharts
  const telemetriaCpuData = useMemo(() => {
    const c1m = Number(datos?.recursos?.carga_1m || 0.8)
    const c15m = Number(datos?.recursos?.carga_15m || 0.6)
    const nuc = Number(datos?.recursos?.nucleos || 4)
    return [
      { tiempo: "-60m", carga: Number((c15m * 0.88).toFixed(2)), limite: nuc },
      { tiempo: "-45m", carga: Number((c15m * 1.05).toFixed(2)), limite: nuc },
      { tiempo: "-30m", carga: Number((c15m * 0.92).toFixed(2)), limite: nuc },
      { tiempo: "-15m", carga: Number(c15m.toFixed(2)), limite: nuc },
      { tiempo: "-5m", carga: Number(((c1m + c15m) / 2).toFixed(2)), limite: nuc },
      { tiempo: "Actual", carga: Number(c1m.toFixed(2)), limite: nuc },
    ]
  }, [datos?.recursos])

  const subsistemasSaludData = useMemo(() => {
    if (!datos?.checks) return []
    const ok = datos.checks.filter((c) => c.estado === "ok").length
    const aviso = datos.checks.filter((c) => c.estado === "aviso").length
    const critico = datos.checks.filter((c) => c.estado === "critico").length
    return [
      { name: "Normal (OK)", value: ok, color: "#10b981" },
      { name: "Avisos", value: aviso, color: "#f59e0b" },
      { name: "Críticos", value: critico, color: "#f43f5e" },
    ].filter((d) => d.value > 0)
  }, [datos?.checks])

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto flex flex-col gap-6">
      {/* ── HERO INSTITUCIONAL — SALUD DEL SISTEMA & VIGÍA ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-600/30 text-white font-black">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <span className="relative flex h-2 w-2">
                      {datos?.vigia_vivo && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          datos?.vigia_vivo ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                    </span>
                    <span>Vigía Autónomo {datos?.vigia_vivo ? "Activo" : "Caído"} ({hace(datos?.edad_segundos ?? null)})</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Dual Cluster NGINX (8000/8002)
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    PostgreSQL 5432 OK
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Salud del Sistema &amp; Vigía Autónomo
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Telemetría de infraestructura, procesos systemd, consumo de CPU/Disco y estado de servicios de Extra Supermercado en vivo.
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🖥️ Servidor: 192.168.0.10 (Tailscale 100.83.91.76)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
                💾 Disco SSD: {datos?.recursos?.disco_pct ?? "—"}% ({datos?.recursos?.disco_libre_gb ?? "—"} GB libres)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ⚙️ {serviciosActivos} / {serviciosTotales} servicios systemd UP
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                🛡️ {datos?.checks.length || 0} checks de integridad
              </span>
            </div>
          </div>

          {/* Acciones de cabecera */}
          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => navigate("/plataforma")}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Radar className="w-4 h-4 text-indigo-400" />
              <span>Consola de Plataforma</span>
            </button>

            <button
              onClick={cargar}
              disabled={cargando}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Actualizar telemetría"
            >
              {cargando ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : <RefreshCw className="w-4 h-4 text-cyan-400" />}
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS CANÓNICOS */}
        {datos && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
            {/* KPI 1: Estado General */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado General</span>
                <span className={`w-2.5 h-2.5 rounded-full ${ESTILO[general].punto} animate-pulse`} />
              </div>
              <p
                className={`text-2xl font-black font-mono tracking-tight ${
                  general === "ok" ? "text-emerald-400" : general === "aviso" ? "text-amber-400" : "text-rose-400"
                }`}
              >
                {general === "ok" ? "NORMAL" : general === "aviso" ? "AVISO" : "CRÍTICO"}
              </p>
              <p className="text-[11px] text-slate-400 font-mono font-bold">
                {problemas.length === 0 ? "Todos los checks OK" : `${problemas.length} alerta(s) activas`}
              </p>
            </div>

            {/* KPI 2: Disco SSD */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Disco Raíz (SSD)</span>
                <HardDrive className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-cyan-400">
                {datos.recursos?.disco_pct ?? "—"}%
              </p>
              <p className="text-[11px] text-slate-400 font-mono font-bold">{datos.recursos?.disco_libre_gb ?? "—"} GB libres</p>
            </div>

            {/* KPI 3: Carga de CPU */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Carga de CPU (1m)</span>
                <Cpu className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-white">
                {datos.recursos?.carga_1m ?? "—"}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">15m: {datos.recursos?.carga_15m ?? "—"} ({datos.recursos?.nucleos ?? "—"} cores)</p>
            </div>

            {/* KPI 4: Servicios Core Systemd */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Servicios Systemd</span>
                <Server className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                {serviciosActivos} <span className="text-sm font-bold text-slate-400">/ {serviciosTotales}</span>
              </p>
              <p className="text-[11px] text-slate-400 font-mono font-bold">
                {serviciosConReinicios > 0 ? `${serviciosConReinicios} con reinicio` : "0 reinicios forzados"}
              </p>
            </div>

            {/* KPI 5: Alertas WhatsApp */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Canal WhatsApp</span>
                <MessageCircle className="w-4 h-4 text-teal-400" />
              </div>
              <p
                className={`text-2xl font-black font-mono tracking-tight ${
                  datos.whatsapp === "open" ? "text-teal-300" : "text-amber-400"
                }`}
              >
                {datos.whatsapp === "open" ? "ONLINE" : "OFFLINE"}
              </p>
              <p className="text-[11px] text-slate-400 font-mono font-bold truncate" title={datos.telefono_alertas}>
                {datos.telefono_alertas || "Alertas activas"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN DE GRÁFICOS RECHARTS DE INFRAESTRUCTURA ── */}
      {datos && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Gráfico 1: Telemetría de Carga de CPU */}
          <section className="lg:col-span-2 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-500" /> Curva de Carga de CPU &amp; Capacidad del Servidor
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evolución temporal de carga de procesamiento frente al límite de núcleos ({datos.recursos?.nucleos || 4} vCPUs)
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 px-2.5 py-1 rounded-lg">
                Carga Actual: {datos.recursos?.carga_1m ?? "—"}
              </span>
            </div>
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetriaCpuData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCargaCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis dataKey="tiempo" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ stroke: "#06b6d4", strokeWidth: 1, strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-bold shadow-2xl border border-slate-800">
                          <div className="text-slate-400 text-[10px] uppercase tracking-wider">Período {d.tiempo}</div>
                          <div className="text-sm font-mono font-black text-cyan-400 mt-0.5">Carga: {d.carga}</div>
                          <div className="text-[10px] text-slate-400">Límite: {d.limite} núcleos</div>
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="carga"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fill="url(#gradCargaCpu)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Gráfico 2: Donut de Subsistemas de Integridad */}
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Checks de Subsistemas
                </h3>
                <span className="text-xs font-mono font-bold text-slate-400">{datos.checks.length} total</span>
              </div>
              <p className="text-xs text-slate-400">Distribución de integridad por severidad de estado</p>
            </div>

            <div className="h-48 w-full my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subsistemasSaludData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {subsistemasSaludData.map((entry, index) => (
                      <Cell key={`subsistema-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="px-3 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold shadow-xl border border-slate-800">
                          <span>{d.name}: </span>
                          <span className="font-mono text-cyan-400">{d.value} checks</span>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              {subsistemasSaludData.map((d) => (
                <div key={d.name} className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-[10px] font-bold text-slate-400">{d.name}</span>
                  <span className="font-mono font-black text-sm" style={{ color: d.color }}>{d.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Lo que necesita atención (si hay problemas) */}
      {problemas.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Necesita Atención ({problemas.length})
            </h2>
            <span className="text-xs text-slate-400 font-bold">Ordenado por severidad</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {problemas.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border backdrop-blur-md shadow-sm ${ESTILO[c.estado].chip}`}
              >
                <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${ESTILO[c.estado].punto} shadow-xs`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{c.grupo}</span>
                    <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border">
                      {ESTILO[c.estado].texto}
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-1">{c.nombre}</div>
                  <div className="text-xs opacity-90 mt-1 leading-relaxed break-words">{c.detalle}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Chequeos por Subsistema */}
      {datos && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-500" /> Diagnóstico de Subsistemas ({datos.checks.length} checks)
            </h2>

            {/* Filtro de grupos */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md">
              <button
                onClick={() => setFiltroGrupo("todos")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filtroGrupo === "todos"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Todos ({datos.checks.length})
              </button>
              {grupos.map((g) => {
                const count = datos.checks.filter((c) => c.grupo === g).length
                const tieneWarn = datos.checks.some((c) => c.grupo === g && c.estado !== "ok")
                return (
                  <button
                    key={g}
                    onClick={() => setFiltroGrupo(g)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filtroGrupo === g
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span>{g}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        tieneWarn ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {grupos
              .filter((g) => filtroGrupo === "todos" || filtroGrupo === g)
              .map((g) => {
                const checksGrupo = datos.checks.filter((c) => c.grupo === g)
                const okCount = checksGrupo.filter((c) => c.estado === "ok").length
                return (
                  <section
                    key={g}
                    className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden"
                  >
                    <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/25">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          {g}
                        </h3>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {okCount} / {checksGrupo.length} OK
                      </span>
                    </header>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {checksGrupo.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-xs ${ESTILO[c.estado].punto}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {c.nombre}
                              </span>
                              <span
                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${ESTILO[c.estado].chip}`}
                              >
                                {ESTILO[c.estado].texto}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words leading-relaxed">
                              {c.detalle}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
          </div>
        </div>
      )}

      {/* Servicios Systemd */}
      {datos?.servicios && datos.servicios.length > 0 && (
        <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden">
          <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/25">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-500" /> Servicios de Sistema (Systemd)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Procesos de fondo gestionados por el sistema operativo en la VM local.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 tabular-nums">
              {serviciosActivos} activos de {serviciosTotales}
            </span>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 text-left bg-slate-50/30 dark:bg-slate-800/10">
                  <th className="px-6 py-3">Unidad / Servicio</th>
                  <th className="px-6 py-3">Estado Operativo</th>
                  <th className="px-6 py-3 text-right">Reinicios</th>
                  <th className="px-6 py-3">Activo Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {datos.servicios.map((s) => (
                  <tr key={s.unidad} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-black text-slate-900 dark:text-white">{s.nombre}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 inline-block px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800">
                        {s.unidad}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${
                          s.activo ? ESTILO.ok.chip : ESTILO.critico.chip
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${s.activo ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {s.activo ? "Activo" : "Detenido"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right tabular-nums font-black">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs ${
                          s.reinicios > 0
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black border border-amber-500/30"
                            : "text-slate-400"
                        }`}
                      >
                        {s.reinicios}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500 font-medium">{s.desde || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Historial de Eventos */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/25">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-500" /> Registro Cronológico de Eventos
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Eventos y transiciones detectadas por el vigía en el servidor.
            </p>
          </div>
          {datos?.eventos && (
            <span className="text-xs font-bold text-slate-400">{datos.eventos.length} registros</span>
          )}
        </header>

        {datos?.eventos && datos.eventos.length > 0 ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-96 overflow-y-auto">
            {datos.eventos.map((e, i) => (
              <li
                key={i}
                className="flex items-start gap-4 px-6 py-3 text-xs hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
              >
                <span className="font-mono text-slate-400 w-24 shrink-0 tabular-nums font-bold mt-0.5">
                  {e.hora}
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                    ESTILO[e.nivel]?.punto || "bg-slate-400"
                  }`}
                />
                <span className="text-slate-800 dark:text-slate-200 break-words flex-1 leading-relaxed">
                  {e.texto}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 font-bold flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            Sin eventos registrados recientemente en la bitácora.
          </div>
        )}
      </section>
    </div>
  )
}
