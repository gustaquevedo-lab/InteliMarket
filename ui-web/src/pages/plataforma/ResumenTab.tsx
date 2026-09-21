import { useEffect, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
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
    <div className="flex flex-col gap-4">
      {/* semáforo general */}
      <div className={cx("rounded-2xl p-5 flex items-center gap-4 border", todoBien
        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
        : i.fatal > 0 ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30" : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30")}>
        <div className={cx("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", todoBien ? "bg-emerald-500 text-white" : i.fatal > 0 ? "bg-rose-600 text-white" : "bg-amber-500 text-white")}>
          {todoBien ? <CheckCircle2 className="w-7 h-7" /> : <AlertOctagon className="w-7 h-7" />}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {todoBien ? "Todo en orden" : `${i.unresolved} ${i.unresolved === 1 ? "incidencia abierta" : "incidencias abiertas"}`}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {todoBien
              ? `Sin incidencias abiertas. ${num(ov.events_24h_total)} eventos en las últimas 24 horas.`
              : `${num(ov.events_24h_total)} eventos en las últimas 24 h${i.fatal ? ` · ${i.fatal} fatal${i.fatal > 1 ? "es" : ""}` : ""}${i.new_24h ? ` · ${i.new_24h} nueva${i.new_24h > 1 ? "s" : ""} hoy` : ""}.`}
          </div>
        </div>
        {!todoBien && <button onClick={() => goTab("incidencias")} className="ml-auto px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black cursor-pointer whitespace-nowrap">Ver incidencias</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Bug className="w-5 h-5" />} label="Incidencias abiertas" value={num(i.unresolved)} tone={i.unresolved ? "rose" : "emerald"} />
        <Stat icon={<Flame className="w-5 h-5" />} label="Fatales (pantalla caída)" value={num(i.fatal)} tone={i.fatal ? "rose" : "slate"} />
        <Stat icon={<Sparkles className="w-5 h-5" />} label="Nuevas en 24 h" value={num(i.new_24h)} tone={i.new_24h ? "amber" : "slate"} />
        <Stat icon={<CheckCircle2 className="w-5 h-5" />} label="Resueltas en 7 días" value={num(i.resolved_7d)} tone="emerald" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Eventos por hora · últimas 24 h" className="lg:col-span-2" right={<span className="text-[10px] font-bold text-slate-400">{num(ov.events_24h_total)} en total</span>}>
          <div className="h-44 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={2} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,.15)" }} content={({ active, payload }) => active && payload?.length ? (
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold shadow-lg">{(payload[0].payload as any).label} · {payload[0].value} eventos</div>
                ) : null} />
                <Bar dataKey="c" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="De dónde vienen">
          <div className="space-y-3">
            {Object.keys(SOURCE).map((k) => {
              const n = ov.by_source[k] || 0
              const S = SOURCE[k]
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-xs mb-1"><span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200"><S.Icon className="w-3.5 h-3.5 text-slate-400" />{S.label}</span><span className="font-black tabular-nums text-slate-500">{n}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(n / maxSrc) * 100}%` }} /></div>
                </div>
              )
            })}
            {Object.keys(ov.by_provider).length > 0 && <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Integraciones con problemas</div>
              {Object.entries(ov.by_provider).map(([k, n]) => (
                <div key={k}><div className="flex justify-between text-xs mb-1"><span className="font-bold text-slate-700 dark:text-slate-200">{k}</span><span className="font-black text-orange-500 tabular-nums">{n}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-orange-500" style={{ width: `${(n / maxProv) * 100}%` }} /></div></div>
              ))}
            </div>}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Lo más activo en las últimas 24 h" className="lg:col-span-2" pad={false}>
          {ov.top_issues.length === 0 ? (
            <Empty icon={<CheckCircle2 className="w-7 h-7 text-emerald-500" />} title="Nada que reportar" hint="No hubo incidencias abiertas con actividad en las últimas 24 horas." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {ov.top_issues.map((it: Issue) => {
                const lv = LEVEL[it.level] || LEVEL.error
                const src = SOURCE[it.source]
                return (
                  <li key={it.id}>
                    <button onClick={() => onOpenIssue(it.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left cursor-pointer">
                      <span className={cx("w-2 h-2 rounded-full shrink-0", lv.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black text-slate-900 dark:text-white truncate">{it.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5"><Chip className={src?.chip}>{src?.label}</Chip>{it.cajas[0] && <span className="text-[10px] font-bold text-slate-400">{it.cajas.slice(0, 3).map(([c]) => c).join(" · ")}</span>}</div>
                      </div>
                      <Spark data={it.spark} />
                      <div className="text-right w-14"><div className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">{num(it.occurrences)}</div><div className="text-[10px] text-slate-400">{hace(it.last_seen)}</div></div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="Salud del servidor" right={<button onClick={() => goTab("salud")} className="text-[10px] font-black text-indigo-500 hover:underline cursor-pointer">Ver detalle</button>}>
          {!salud ? <Skel className="h-24" /> : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={cx("w-2.5 h-2.5 rounded-full", !salud.vigia_vivo ? "bg-rose-500 animate-pulse" : salud.resumen === "critico" ? "bg-rose-500" : salud.resumen === "aviso" ? "bg-amber-500" : "bg-emerald-500")} />
                <span className="text-sm font-black text-slate-900 dark:text-white">{!salud.vigia_vivo ? "El vigía no reporta" : salud.resumen === "critico" ? "Hay algo crítico" : salud.resumen === "aviso" ? "Con avisos" : "Todo normal"}</span>
              </div>
              {problemas.length > 0 && <ul className="space-y-1.5">{problemas.slice(0, 4).map((c: any) => <li key={c.id} className="text-xs text-slate-600 dark:text-slate-300"><b className={c.estado === "critico" ? "text-rose-600" : "text-amber-600"}>{c.nombre}:</b> {c.detalle}</li>)}</ul>}
              {salud.recursos && (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><div className="text-slate-400 font-bold">Disco</div><div className="font-black text-slate-800 dark:text-slate-100">{salud.recursos.disco_pct}% usado</div></div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><div className="text-slate-400 font-bold">Carga</div><div className="font-black text-slate-800 dark:text-slate-100">{salud.recursos.carga_1m} / {salud.recursos.nucleos} núcleos</div></div>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp: <b className={salud.whatsapp === "open" ? "text-emerald-600" : "text-rose-600"}>{salud.whatsapp === "open" ? "conectado" : salud.whatsapp || "sin datos"}</b>
              </div>
            </div>
          )}
        </Card>
      </div>
      {loading && <div className="text-[10px] text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3 animate-pulse" /> actualizando…</div>}
    </div>
  )
}
