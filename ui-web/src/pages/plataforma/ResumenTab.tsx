import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Activity, AlertOctagon, Bug, CheckCircle2, Flame, MessageCircle, Sparkles } from "lucide-react"
import { api } from "../../api"
import type { Issue, Overview } from "../../api/platform"
import { Card, Chip, Empty, LEVEL, SOURCE, Skel, Spark, Stat, cx, hace, num } from "./ui"

export default function ResumenTab({ ov, loading, onOpenIssue, goTab }: { ov: Overview | null; loading: boolean; onOpenIssue: (id: string) => void; goTab: (t: string) => void }) {
  const [salud, setSalud] = useState<any>(null)
  useEffect(() => {
    let vivo = true
    const cargar = () => api.sistema.salud().then((s: any) => { if (vivo) setSalud(s) }).catch(() => {})
    void cargar()
    const t = setInterval(cargar, 30000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  if (!ov) return <div className="grid gap-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-20" />)}</div><Skel className="h-56" /></div>

  const i = ov.issues
  const todoBien = i.unresolved === 0
  const series = ov.events_24h.map((p) => ({ h: new Date(p.t), label: `${String(new Date(p.t).getHours()).padStart(2, "0")}h`, c: p.count }))
  const maxSrc = Math.max(1, ...Object.values(ov.by_source))
  const maxProv = Math.max(1, ...Object.values(ov.by_provider))
  const problemas = (salud?.checks || []).filter((c: any) => c.estado !== "ok")

  return (
    <div className="space-y-6">
      {/* Semáforo General Ejecutivo */}
      <div className="relative overflow-hidden rounded-2xl p-5 border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all duration-200 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className={cx(
          "h-1 w-full absolute top-0 left-0",
          todoBien ? "bg-gradient-to-r from-emerald-500 to-teal-500" : i.fatal > 0 ? "bg-gradient-to-r from-rose-600 to-red-600" : "bg-gradient-to-r from-amber-500 to-orange-500"
        )} />
        <div className="flex items-center gap-4">
          <div className={cx(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md",
            todoBien
              ? "bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-emerald-500/25"
              : i.fatal > 0
                ? "bg-gradient-to-tr from-rose-600 to-red-600 text-white shadow-rose-500/25 animate-pulse"
                : "bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-500/25"
          )}>
            {todoBien ? <CheckCircle2 className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {todoBien ? "Plataforma Estable · Sin Incidencias" : `${i.unresolved} ${i.unresolved === 1 ? "Incidencia Abierta" : "Incidencias Abiertas"}`}
              </h2>
              <span className={cx(
                "px-2 py-0.5 text-[11px] font-black rounded-full font-mono",
                todoBien
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                  : i.fatal > 0
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
              )}>
                {todoBien ? "100% OPERATIVO" : i.fatal > 0 ? "CRÍTICO" : "ATENCIÓN"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {todoBien
                ? `Cero fallos abiertos en cajas o servicios. ${num(ov.events_24h_total)} eventos procesados en las últimas 24 horas.`
                : `${num(ov.events_24h_total)} eventos en 24h${i.fatal ? ` · ${i.fatal} fatal(es)` : ""}${i.new_24h ? ` · ${i.new_24h} nueva(s) hoy` : ""}. Requieren diagnóstico.`}
            </p>
          </div>
        </div>

        {!todoBien && (
          <button
            onClick={() => goTab("incidencias")}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-black transition-all shadow-md cursor-pointer whitespace-nowrap"
          >
            Ver incidencias &amp; diagnóstico →
          </button>
        )}
      </div>

      {/* 4 KPI Cards Estilizadas con Estética Canónica de Business Intelligence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Incidencias abiertas */}
        <Stat
          icon={<Bug className="w-4 h-4" />}
          label="Incidencias Abiertas"
          value={num(i.unresolved)}
          tone={i.unresolved ? "rose" : "emerald"}
          sub={
            <>
              <span>{i.unresolved > 0 ? "Requieren diagnóstico" : "0 fallas activas"}</span>
              <span className={cx("font-bold font-mono", i.unresolved ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                {i.unresolved > 0 ? "Atención" : "Estable"}
              </span>
            </>
          }
        />

        {/* KPI 2: Fatales */}
        <Stat
          icon={<Flame className="w-4 h-4" />}
          label="Fatales (Caídas)"
          value={num(i.fatal)}
          tone={i.fatal ? "rose" : "slate"}
          sub={
            <>
              <span>{i.fatal > 0 ? "Corte crítico reportado" : "Cero caídas en terminales"}</span>
              <span className={cx("font-bold font-mono", i.fatal ? "text-rose-600 dark:text-rose-400" : "text-gray-400")}>
                {i.fatal > 0 ? "Crítico" : "Óptimo"}
              </span>
            </>
          }
        />

        {/* KPI 3: Nuevas 24h */}
        <Stat
          icon={<Sparkles className="w-4 h-4" />}
          label="Nuevas en 24 h"
          value={num(i.new_24h)}
          tone={i.new_24h ? "amber" : "indigo"}
          sub={
            <>
              <span>Detectadas en la jornada</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">24 Horas</span>
            </>
          }
        />

        {/* KPI 4: Resueltas 7d */}
        <Stat
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Resueltas (7 Días)"
          value={num(i.resolved_7d)}
          tone="emerald"
          sub={
            <>
              <span>Cerradas con éxito</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">7 Días</span>
            </>
          }
        />
      </div>

      {/* Gráficos y Orígenes */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Curva de Eventos en Tiempo Real (24 h)" className="lg:col-span-2" right={<span className="text-[11px] font-mono font-bold text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-lg">{num(ov.events_24h_total)} eventos</span>}>
          <div className="h-56 -mx-1 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEventosPlat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "3 3" }}
                  content={({ active, payload }) => active && payload?.length ? (
                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-bold shadow-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase tracking-wider block">Hora: {(payload[0].payload as any).label}</span>
                      <span className="font-mono text-indigo-400 font-black text-sm">{payload[0].value} eventos</span>
                    </div>
                  ) : null}
                />
                <Area type="monotone" dataKey="c" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradEventosPlat)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Distribución de Origen">
          <div className="space-y-3.5 pt-1">
            {Object.keys(SOURCE).map((k) => {
              const n = ov.by_source[k] || 0
              const S = SOURCE[k]
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                      <S.Icon className="w-3.5 h-3.5 text-slate-400" />
                      {S.label}
                    </span>
                    <span className="font-black tabular-nums text-slate-500">{n}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${(n / maxSrc) * 100}%` }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(ov.by_provider).length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Integraciones con problemas</div>
                {Object.entries(ov.by_provider).map(([k, n]) => (
                  <div key={k}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{k}</span>
                      <span className="font-black text-orange-500 tabular-nums">{n}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${(n / maxProv) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Incidencias Activas y Salud Servidor */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Lo más activo en las últimas 24 h" className="lg:col-span-2" pad={false}>
          {ov.top_issues.length === 0 ? (
            <Empty icon={<CheckCircle2 className="w-7 h-7 text-emerald-500" />} title="Nada que reportar" hint="No hubo incidencias abiertas con actividad en las últimas 24 horas." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {ov.top_issues.map((it: Issue) => {
                const lv = LEVEL[it.level] || LEVEL.error
                const src = SOURCE[it.source]
                return (
                  <li key={it.id}>
                    <button onClick={() => onOpenIssue(it.id)} className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-left cursor-pointer">
                      <span className={cx("w-2.5 h-2.5 rounded-full shrink-0 shadow-xs", lv.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black text-slate-900 dark:text-white truncate">{it.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Chip className={src?.chip}>{src?.label}</Chip>
                          {it.cajas[0] && <span className="text-[11px] font-bold text-slate-400">{it.cajas.slice(0, 3).map(([c]) => c).join(" · ")}</span>}
                        </div>
                      </div>
                      <Spark data={it.spark} />
                      <div className="text-right w-16">
                        <div className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">{num(it.occurrences)}</div>
                        <div className="text-[10px] text-slate-400">{hace(it.last_seen)}</div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Salud del servidor"
          right={
            <button onClick={() => goTab("salud")} className="text-[11px] font-black text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1">
              Ver detalle completo →
            </button>
          }
        >
          {!salud ? <Skel className="h-28" /> : (
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className={cx(
                  "w-3 h-3 rounded-full shrink-0",
                  !salud.vigia_vivo ? "bg-rose-500 animate-ping" : salud.resumen === "critico" ? "bg-rose-500" : salud.resumen === "aviso" ? "bg-amber-500" : "bg-emerald-500"
                )} />
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {!salud.vigia_vivo ? "El vigía no reporta" : salud.resumen === "critico" ? "Hay algo crítico" : salud.resumen === "aviso" ? "Con avisos pendientes" : "Vigía & Servidor OK"}
                </span>
              </div>

              {problemas.length > 0 && (
                <ul className="space-y-2">
                  {problemas.slice(0, 3).map((c: any) => (
                    <li key={c.id} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                      <span className="text-rose-500 font-bold">•</span>
                      <span><b className={c.estado === "critico" ? "text-rose-600" : "text-amber-600"}>{c.nombre}:</b> {c.detalle}</span>
                    </li>
                  ))}
                </ul>
              )}

              {salud.recursos && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Disco /</div>
                    <div className="font-black text-slate-800 dark:text-slate-100 text-sm mt-0.5">{salud.recursos.disco_pct}% usado</div>
                    <div className="text-[10px] text-slate-400">{salud.recursos.disco_libre_gb} GB libres</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Carga CPU</div>
                    <div className="font-black text-slate-800 dark:text-slate-100 text-sm mt-0.5">{salud.recursos.carga_1m}</div>
                    <div className="text-[10px] text-slate-400">{salud.recursos.nucleos} núcleos detectados</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Canal WhatsApp</span>
                <b className={salud.whatsapp === "open" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {salud.whatsapp === "open" ? "Conectado" : salud.whatsapp || "Sin datos"}
                </b>
              </div>
            </div>
          )}
        </Card>
      </div>

      {loading && (
        <div className="text-xs text-slate-400 flex items-center justify-center gap-2 py-2">
          <Activity className="w-3.5 h-3.5 animate-pulse text-indigo-500" /> Sincronizando telemetría en segundo plano…
        </div>
      )}
    </div>
  )
}
