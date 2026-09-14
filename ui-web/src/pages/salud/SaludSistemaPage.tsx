import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, XCircle, MessageCircle, HardDrive, Clock } from "lucide-react"
import { api } from "../../api"

/**
 * Salud del Sistema (solo superadmin).
 *
 * Muestra lo que reporta el vigía, que corre cada minuto en el servidor por su
 * cuenta. Si el vigía deja de reportar, eso mismo se muestra en rojo: un panel
 * que sigue en verde con datos viejos es peor que no tener panel.
 */

type Nivel = "ok" | "aviso" | "critico"

interface Check { id: string; grupo: string; nombre: string; estado: Nivel; detalle: string }
interface Servicio { unidad: string; nombre: string; activo: boolean; estado: string; reinicios: number; desde: string }
interface Evento { hora: string; nivel: Nivel; texto: string }
interface Salud {
  vigia_vivo: boolean
  edad_segundos: number | null
  mensaje?: string
  generado?: string
  resumen?: Nivel
  checks: Check[]
  servicios?: Servicio[]
  recursos?: { disco_pct: number; disco_libre_gb: number; carga_1m: number; carga_15m: number; nucleos: number }
  whatsapp?: string
  telefono_alertas?: string
  eventos?: Evento[]
}

const ESTILO: Record<Nivel, { chip: string; punto: string; texto: string; Icono: typeof CheckCircle2 }> = {
  ok: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30", punto: "bg-emerald-500", texto: "Normal", Icono: CheckCircle2 },
  aviso: { chip: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30", punto: "bg-amber-500", texto: "Aviso", Icono: AlertTriangle },
  critico: { chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30", punto: "bg-rose-500", texto: "Crítico", Icono: XCircle },
}

const hace = (s: number | null) => (s == null ? "—" : s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.round(s / 3600)} h`)

export default function SaludSistemaPage() {
  const [datos, setDatos] = useState<Salud | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setDatos(await api.sistema.salud())
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
  const problemas = (datos?.checks || []).filter((c) => c.estado !== "ok").sort((a, b) => (a.estado === "critico" ? -1 : 1) - (b.estado === "critico" ? -1 : 1))
  const grupos = [...new Set((datos?.checks || []).map((c) => c.grupo))]

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-5 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Salud del Sistema</h1>
            <p className="text-xs text-slate-500">
              Servidor de Extra Supermercado · se actualiza solo cada 30 s
              {datos?.edad_segundos != null && <> · último reporte del vigía {hace(datos.edad_segundos)}</>}
            </p>
          </div>
        </div>
        <button onClick={cargar} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
          {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 text-sm font-bold">
          <XCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {datos && !datos.vigia_vivo && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-800 dark:text-rose-200">
            <b>El vigía de salud no está reportando</b> {datos.edad_segundos != null ? `(último reporte ${hace(datos.edad_segundos)})` : ""}.
            {" "}Lo que se ve abajo puede estar desactualizado, y si pasa algo no va a llegar ningún aviso.
            {datos.mensaje && <span className="block mt-1">{datos.mensaje}</span>}
          </div>
        </div>
      )}

      {/* Estado general */}
      {datos && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`p-4 rounded-2xl border ${ESTILO[general].chip}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Estado general</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-black">
              {(() => { const I = ESTILO[general].Icono; return <I className="w-6 h-6" /> })()}
              {general === "ok" ? "Todo en orden" : general === "aviso" ? `${problemas.length} aviso${problemas.length === 1 ? "" : "s"}` : "Requiere atención"}
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><HardDrive className="w-3 h-3" /> Recursos</div>
            <div className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">{datos.recursos?.disco_pct ?? "—"}% <span className="text-sm font-bold text-slate-500">disco</span></div>
            <div className="text-xs text-slate-500 tabular-nums">{datos.recursos?.disco_libre_gb ?? "—"} GB libres · carga {datos.recursos?.carga_15m ?? "—"} / {datos.recursos?.nucleos ?? "—"} núcleos</div>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Avisos</div>
            <div className={`mt-1 text-lg font-black ${datos.whatsapp === "open" ? "text-emerald-600" : "text-amber-600"}`}>
              WhatsApp {datos.whatsapp === "open" ? "conectado" : "desconectado"}
            </div>
            <div className="text-xs text-slate-500">
              {datos.whatsapp === "open" ? `Alertas a ${datos.telefono_alertas}` : "Las alertas solo llegan a la campana. Reconectar en WhatsApp & IntelliZapp."}
            </div>
          </div>
        </div>
      )}

      {/* Lo que necesita atención, arriba de todo */}
      {problemas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Necesita atención</h2>
          {problemas.map((c) => (
            <div key={c.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${ESTILO[c.estado].chip}`}>
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${ESTILO[c.estado].punto}`} />
              <div className="text-sm"><b>{c.nombre}</b><span className="block text-xs opacity-90">{c.detalle}</span></div>
            </div>
          ))}
        </section>
      )}

      {/* Todos los chequeos por grupo */}
      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g) => (
          <section key={g} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <h2 className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">{g}</h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {datos!.checks.filter((c) => c.grupo === g).map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ESTILO[c.estado].punto}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{c.nombre}</div>
                    <div className="text-xs text-slate-500 break-words">{c.detalle}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Servicios */}
      {datos?.servicios && datos.servicios.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <h2 className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">Servicios</h2>
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
                <th className="px-4 py-2">Servicio</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2 text-right">Reinicios</th><th className="px-4 py-2">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {datos.servicios.map((s) => (
                <tr key={s.unidad}>
                  <td className="px-4 py-2"><div className="font-bold text-slate-800 dark:text-slate-100">{s.nombre}</div><div className="text-[11px] font-mono text-slate-400">{s.unidad}</div></td>
                  <td className="px-4 py-2"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-bold ${s.activo ? ESTILO.ok.chip : ESTILO.critico.chip}`}>{s.activo ? "activo" : "detenido"}</span></td>
                  <td className={`px-4 py-2 text-right tabular-nums font-bold ${s.reinicios > 0 ? "text-amber-600" : "text-slate-500"}`}>{s.reinicios}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{s.desde || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Historial */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h2 className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1"><Clock className="w-3 h-3" /> Historial de eventos</h2>
        {datos?.eventos && datos.eventos.length > 0 ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {datos.eventos.map((e, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2 text-sm">
                <span className="text-xs font-mono text-slate-400 w-24 shrink-0 tabular-nums">{e.hora}</span>
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ESTILO[e.nivel]?.punto || "bg-slate-400"}`} />
                <span className="text-slate-700 dark:text-slate-200 break-words">{e.texto}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-slate-500">Sin eventos registrados todavía.</p>
        )}
      </section>
    </div>
  )
}
