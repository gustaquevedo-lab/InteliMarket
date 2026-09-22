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
} from "lucide-react"
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

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto flex flex-col gap-6">
      {/* Hero Banner Ejecutivo */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border border-slate-800/80 p-6 sm:p-8 shadow-2xl">
        {/* Glow ambient orbs */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-10 w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-xs">
              <span className="relative flex h-2 w-2">
                {datos?.vigia_vivo && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    datos?.vigia_vivo ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
              </span>
              <span>Telemetría de Servidor · Extra Supermercado</span>
              {datos?.edad_segundos != null && (
                <span className="text-cyan-200/70 border-l border-cyan-500/30 pl-2">
                  Vigía {datos.vigia_vivo ? "Activo" : "Caído"} ({hace(datos.edad_segundos)})
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              Salud del Sistema & Vigía
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/85 max-w-2xl leading-relaxed">
              Monitoreo continuo de servicios systemd, bases de datos PostgreSQL, espacio en disco, carga de CPU y
              conectividad del canal de alertas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate("/plataforma")}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition-all shadow-xs backdrop-blur-md cursor-pointer"
            >
              <Radar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Consola de Plataforma</span>
            </button>
            <button
              onClick={cargar}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-bold transition-all shadow-xs backdrop-blur-md cursor-pointer disabled:opacity-50"
            >
              {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{cargando ? "Consultando..." : "Actualizar"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alerta de Error de Conexión */}
      {error && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm font-bold shadow-sm backdrop-blur-md">
          <XCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <div className="flex-1">{error}</div>
          <button
            onClick={cargar}
            className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Alerta Crítica: Vigía no reporta */}
      {datos && !datos.vigia_vivo && (
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 sm:p-6 backdrop-blur-md shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-600/30 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1 text-sm text-rose-900 dark:text-rose-200">
              <div className="font-black text-base text-rose-600 dark:text-rose-400">
                Alerta Crítica: El vigía de salud no está reportando
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                Último latido registrado {datos.edad_segundos != null ? hace(datos.edad_segundos) : "desconocido"}. La
                información mostrada a continuación puede estar desactualizada y las alertas automáticas no se están
                despachando.
              </p>
              {datos.mensaje && (
                <div className="mt-2 text-xs font-mono p-2 rounded-lg bg-rose-950/20 text-rose-300 border border-rose-500/20">
                  {datos.mensaje}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5 KPI Cards Ejecutivas */}
      {datos && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Estado General */}
          <div
            className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:shadow-md flex flex-col justify-between ${ESTILO[general].chip}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75">Estado General</span>
              <span className={`w-2.5 h-2.5 rounded-full ${ESTILO[general].punto} animate-pulse`} />
            </div>
            <div className="my-2">
              <div className="flex items-center gap-2.5 text-xl font-black tracking-tight">
                {(() => {
                  const I = ESTILO[general].Icono
                  return <I className="w-6 h-6 shrink-0" />
                })()}
                <span>{general === "ok" ? "Todo en orden" : general === "aviso" ? "Con avisos" : "Requiere atención"}</span>
              </div>
            </div>
            <div className="text-[11px] opacity-80 font-bold">
              {problemas.length === 0
                ? "Todos los checks en verde"
                : `${problemas.length} subsistema(s) con alertas`}
            </div>
          </div>

          {/* Card 2: Disco */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-500" /> Disco (/)
              </span>
              <span className="text-slate-400 font-mono">{datos.recursos?.disco_libre_gb ?? "—"} GB libres</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                {datos.recursos?.disco_pct ?? "—"}%
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (datos.recursos?.disco_pct || 0) > 85
                      ? "bg-rose-500"
                      : (datos.recursos?.disco_pct || 0) > 70
                      ? "bg-amber-500"
                      : "bg-cyan-500"
                  }`}
                  style={{ width: `${datos.recursos?.disco_pct || 0}%` }}
                />
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-bold">Almacenamiento raíz del servidor</div>
          </div>

          {/* Card 3: CPU & Carga */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-violet-500" /> Carga de CPU
              </span>
              <span className="text-slate-400 font-mono">{datos.recursos?.nucleos ?? "—"} núcleos</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                {datos.recursos?.carga_1m ?? "—"}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-bold">
              Promedio 15m: <span className="tabular-nums font-mono text-slate-600 dark:text-slate-300">{datos.recursos?.carga_15m ?? "—"}</span>
            </div>
          </div>

          {/* Card 4: WhatsApp */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> Avisos WhatsApp
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  datos.whatsapp === "open" ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </div>
            <div className="my-2">
              <div
                className={`text-xl font-black tracking-tight ${
                  datos.whatsapp === "open" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {datos.whatsapp === "open" ? "Conectado" : "Desconectado"}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 truncate font-bold" title={datos.telefono_alertas}>
              {datos.whatsapp === "open"
                ? `Destino: ${datos.telefono_alertas || "Configurado"}`
                : "Alertas vía web"}
            </div>
          </div>

          {/* Card 5: Servicios Systemd */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-500" /> Servicios Core
              </span>
              <span className="text-slate-400 font-mono">{serviciosTotales} totales</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                {serviciosActivos} <span className="text-sm font-bold text-slate-400">/ {serviciosTotales}</span>
              </div>
            </div>
            <div className="text-[11px] font-bold">
              {serviciosConReinicios > 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {serviciosConReinicios} servicio(s) con reinicio
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">0 reinicios forzados</span>
              )}
            </div>
          </div>
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
