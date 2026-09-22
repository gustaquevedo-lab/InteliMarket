import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  AlertTriangle, CheckCircle2, CircleDashed, Clock, CreditCard, Globe, History, KeyRound, Loader2, Lock, Play, QrCode, Settings2,
  ShieldAlert, Smartphone, Wand2, X, XCircle, Bug, ChevronRight,
} from "lucide-react"
import { platform, type CheckResult, type Env, type IntegrationItem } from "../../api/platform"
import { Card, Chip, Empty, Skel, cx, fecha, hace, num } from "./ui"

const ICON: Record<string, typeof QrCode> = { bancard_qr: QrCode, plugpay: Globe, bancard: CreditCard, dinelco: Smartphone }

const STATE: Record<IntegrationItem["state"], { label: string; chip: string; dot: string }> = {
  ok: { label: "Funcionando", chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30", dot: "bg-emerald-500" },
  error: { label: "Con problemas", chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30", dot: "bg-rose-500" },
  sin_probar: { label: "Sin probar", chip: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", dot: "bg-slate-400" },
  sin_configurar: { label: "Sin configurar", chip: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30", dot: "bg-amber-500" },
  desactivada: { label: "Desactivada", chip: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700", dot: "bg-slate-300" },
}

export default function IntegracionesTab({ env }: { env: Env }) {
  const [, setSp] = useSearchParams()
  const [company, setCompany] = useState<string | undefined>()
  const [data, setData] = useState<{ company_id: string; companies: { id: string; nombre: string }[]; items: IntegrationItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<IntegrationItem | null>(null)
  const [results, setResults] = useState<Record<string, CheckResult & { at: number }>>({})
  const [running, setRunning] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setData(await platform.integrations(company)); setError(null) } catch (e: any) { setError(e?.message || "No se pudo cargar") }
  }, [company])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const t = setInterval(() => { void load() }, 30000); return () => clearInterval(t) }, [load])

  const run = async (it: IntegrationItem) => {
    setConfirmId(null); setRunning(it.id)
    try {
      const r = await platform.checkIntegration(it.id, data?.company_id)
      setResults((p) => ({ ...p, [it.id]: { ...r, at: Date.now() } }))
      await load()
    } catch (e: any) {
      setResults((p) => ({ ...p, [it.id]: { ok: false, detail: e?.message || "Falló la prueba", at: Date.now() } }))
    } finally { setRunning(null) }
  }

  const goIncidents = (provider: string) => {
    const n = new URLSearchParams(window.location.search); n.set("tab", "incidencias"); n.set("provider", provider); setSp(n)
  }
  const goCajas = () => { const n = new URLSearchParams(window.location.search); n.set("tab", "cajas"); setSp(n) }

  const groups = useMemo(() => {
    const g: Record<string, IntegrationItem[]> = {}
    for (const it of data?.items || []) (g[it.group] ||= []).push(it)
    return g
  }, [data])

  if (error) return <Card><div className="text-sm text-rose-600 font-bold">{error}</div></Card>
  if (!data) return <div className="grid md:grid-cols-2 gap-4">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-56" />)}</div>

  const mostrarChecklist = data.items.length > 0
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          Empresa:
          {data.companies.length > 1 ? (
            <select value={data.company_id} onChange={(e) => setCompany(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-black cursor-pointer">
              {data.companies.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-black">{data.companies[0]?.nombre || "—"}</span>}
        </div>
        <span className="text-[11px] text-slate-400">Acá está el único lugar donde se cambian las credenciales. Cada cambio queda en Auditoría y ningún secreto sale del servidor.</span>
      </div>

      {mostrarChecklist && <Checklist items={data.items} goCajas={goCajas} />}

      {Object.entries(groups).map(([grupo, items]) => (
        <section key={grupo}>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2.5">{grupo}</h2>
          <div className="grid lg:grid-cols-2 gap-4">
            {items.map((it) => (
              <ProviderCard key={it.id} it={it} result={results[it.id]} running={running === it.id} confirming={confirmId === it.id}
                onConfigure={() => setEditing(it)} onAskRun={() => (it.check_warning ? setConfirmId(it.id) : void run(it))}
                onCancelConfirm={() => setConfirmId(null)} onRun={() => void run(it)} onIncidents={() => goIncidents(it.id)} onCajas={goCajas} />
            ))}
          </div>
        </section>
      ))}

      {editing && <ConfigDrawer it={editing} companyId={data.company_id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
    </div>
  )
}

/* ── tarjeta de proveedor ─────────────────────────────────────────────── */

function RateBars({ it }: { it: IntegrationItem }) {
  const days = it.stats.series_7d
  const max = Math.max(1, ...days.map((d) => d.ok + d.fail))
  const tot = it.stats.ok_7d + it.stats.fail_7d
  const rate = tot ? Math.round((it.stats.ok_7d / tot) * 100) : null
  return (
    <div className="flex items-end gap-4">
      <div>
        <div className={cx("text-2xl font-black tabular-nums leading-none", rate === null ? "text-slate-300" : rate >= 90 ? "text-emerald-600" : rate >= 70 ? "text-amber-600" : "text-rose-600")}>{rate === null ? "—" : `${rate}%`}</div>
        <div className="text-[10px] font-bold text-slate-400 mt-1">éxito en 7 días</div>
      </div>
      <div className="flex items-end gap-1 h-10 flex-1" aria-label="Operaciones por día">
        {days.length === 0 ? <span className="text-[10px] text-slate-400 self-center">sin operaciones</span> : days.map((d) => (
          <div key={d.d} className="flex-1 flex flex-col justify-end h-full rounded-sm overflow-hidden" title={`${d.d.slice(5, 10)} · ${d.ok} ok / ${d.fail} fallidas`}>
            <div className="bg-rose-400" style={{ height: `${(d.fail / max) * 100}%` }} />
            <div className="bg-emerald-400" style={{ height: `${(d.ok / max) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ProviderCard(p: {
  it: IntegrationItem; result?: CheckResult & { at: number }; running: boolean; confirming: boolean
  onConfigure: () => void; onAskRun: () => void; onCancelConfirm: () => void; onRun: () => void; onIncidents: () => void; onCajas: () => void
}) {
  const { it } = p
  const Icon = ICON[it.id] || KeyRound
  const st = STATE[it.state]
  const prod = it.environment === "production"
  const [hist, setHist] = useState<Awaited<ReturnType<typeof platform.integrationHistory>> | null>(null)
  const [openHist, setOpenHist] = useState(false)
  const toggleHist = async () => {
    if (openHist) { setOpenHist(false); return }
    setOpenHist(true)
    try { setHist(await platform.integrationHistory(it.id)) } catch { setHist([]) }
  }

  return (
    <Card pad={false} className={cx(it.state === "error" && "ring-1 ring-rose-300 dark:ring-rose-500/40")}>
      <div className="p-4 flex flex-col gap-3.5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-black text-slate-900 dark:text-white">{it.label}</h3>
              <Chip className={st.chip}><span className={cx("w-1.5 h-1.5 rounded-full", st.dot)} />{st.label}</Chip>
              {it.environment && <Chip className={prod ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300"}>{prod ? "producción" : it.environment}</Chip>}
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-snug">{it.description}</p>
          </div>
        </div>

        {it.exists && <RateBars it={it} />}

        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="Hoy" value={<><b className="text-emerald-600">{num(it.stats.ok_today)}</b><span className="text-slate-300"> / </span><b className={it.stats.fail_today ? "text-rose-600" : "text-slate-400"}>{num(it.stats.fail_today)}</b></>} hint="ok / falló" />
          <Mini label="Último cobro OK" value={<span className="text-slate-800 dark:text-slate-100">{it.stats.last_success ? hace(it.stats.last_success) : "—"}</span>} />
          <button onClick={p.onIncidents} disabled={!it.incidents_open} className={cx("rounded-xl px-2 py-2 border text-center transition", it.incidents_open ? "bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 hover:bg-rose-100 cursor-pointer" : "bg-slate-50 dark:bg-slate-800/50 border-transparent cursor-default")}>
            <div className="text-[10px] font-bold text-slate-400">Incidencias</div>
            <div className={cx("text-sm font-black", it.incidents_open ? "text-rose-600" : "text-slate-400")}>{it.incidents_open}</div>
          </button>
        </div>

        {it.stats.stuck > 0 && <div className="flex items-center gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2"><Clock className="w-3.5 h-3.5 shrink-0" />{it.stats.stuck} operaciones quedaron sin respuesta por más de 10 minutos.</div>}
        {it.missing.length > 0 && it.exists && !it.terminals && <div className="flex items-center gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />Faltan datos: {it.fields.filter((f) => it.missing.includes(f.key)).map((f) => f.label).join(", ")}.</div>}

        {p.result && (
          <div className={cx("rounded-xl p-3 text-xs border", p.result.ok ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30")}>
            <div className="flex items-center gap-2 font-black">{p.result.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}<span className={p.result.ok ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"}>{p.result.ok ? "Prueba exitosa" : "La prueba falló"}</span>{p.result.latency_ms != null && <span className="ml-auto font-medium text-slate-500">{num(p.result.latency_ms)} ms</span>}</div>
            {p.result.detail && <div className="mt-1 text-slate-700 dark:text-slate-200 break-words">{p.result.detail}</div>}
            {p.result.meta?.terminales && (
              <ul className="mt-2 grid sm:grid-cols-2 gap-1.5">
                {p.result.meta.terminales.map((t) => (
                  <li key={t.ip} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/70 dark:bg-slate-900/50"><span className={cx("w-2 h-2 rounded-full", t.ok ? "bg-emerald-500" : "bg-rose-500")} /><span className="font-bold">{t.caja}</span><span className="font-mono text-slate-500">{t.ip}</span><span className="ml-auto text-slate-400">{t.ok ? `${t.ms} ms` : t.error}</span></li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!p.result && it.last_check && (
          <div className="text-[11px] text-slate-500 flex items-start gap-1.5">
            {it.last_check.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" /> : <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-px" />}
            <span>Última prueba {hace(it.last_check.ts)}{it.last_check.actor ? ` (${it.last_check.actor})` : ""}: {it.last_check.detail}</span>
          </div>
        )}

        {p.confirming && (
          <div className="rounded-xl p-3 border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-xs">
            <div className="flex gap-2 text-amber-900 dark:text-amber-200 font-bold"><ShieldAlert className="w-4 h-4 shrink-0" />{it.check_warning}</div>
            <div className="flex gap-2 mt-2.5"><button onClick={p.onRun} className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black cursor-pointer">Probar ahora</button><button onClick={p.onCancelConfirm} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black cursor-pointer">Cancelar</button></div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button onClick={p.onAskRun} disabled={p.running || !it.exists} className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            {p.running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}{it.check_label}
          </button>
          {it.terminals ? (
            <button onClick={p.onCajas} className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Editar IPs en Cajas <ChevronRight className="w-3.5 h-3.5" /></button>
          ) : (
            <button onClick={p.onConfigure} className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"><Settings2 className="w-3.5 h-3.5" />Configurar</button>
          )}
          <button onClick={toggleHist} className="ml-auto p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer" title="Historial de pruebas"><History className="w-4 h-4" /></button>
        </div>
        {openHist && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-[11px] space-y-1.5 max-h-44 overflow-y-auto">
            {!hist ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : hist.length === 0 ? <span className="text-slate-400">Todavía no hay pruebas registradas.</span> : hist.map((h, i) => (
              <div key={i} className="flex items-start gap-2"><span className={cx("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", h.ok ? "bg-emerald-500" : "bg-rose-500")} /><span className="text-slate-400 shrink-0">{fecha(h.ts)}</span><span className="text-slate-700 dark:text-slate-200 break-words">{h.detail}</span></div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function Mini({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return <div className="rounded-xl px-2 py-2 bg-slate-50 dark:bg-slate-800/50"><div className="text-[10px] font-bold text-slate-400">{label}</div><div className="text-sm font-black">{value}</div>{hint && <div className="text-[9px] text-slate-400">{hint}</div>}</div>
}

/* ── puesta en marcha de una empresa ───────────────────────────────────── */

function Checklist({ items, goCajas }: { items: IntegrationItem[]; goCajas: () => void }) {
  type Step = { key: string; label: string; done: boolean; action?: () => void; actionLabel?: string }
  const steps: Step[] = items.flatMap((it): Step[] => it.terminals
    ? [{ key: `${it.id}-ips`, label: `${it.label}: IPs de los terminales cargadas`, done: it.exists && it.state !== "sin_configurar", action: goCajas, actionLabel: "Ir a Cajas" }]
    : [
      { key: `${it.id}-cfg`, label: `${it.label}: credenciales cargadas`, done: it.exists && it.missing.length === 0, action: undefined, actionLabel: "" },
      { key: `${it.id}-chk`, label: `${it.label}: prueba de conexión exitosa`, done: it.state === "ok", action: undefined, actionLabel: "" },
    ])
  const done = steps.filter((s) => s.done).length
  const pct = Math.round((done / steps.length) * 100)
  const completo = done === steps.length
  return (
    <Card title="Puesta en marcha de esta empresa" right={<span className="text-xs font-black text-slate-500">{done} de {steps.length}</span>}>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3"><div className={cx("h-full rounded-full transition-all", completo ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${pct}%` }} /></div>
      {completo ? (
        <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Todas las integraciones de esta empresa están configuradas y probadas.</div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <CircleDashed className="w-4 h-4 text-slate-300 shrink-0" />}
              <span className={s.done ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100 font-semibold"}>{s.label}</span>
              {!s.done && s.action && <button onClick={s.action} className="ml-auto text-[10px] font-black text-indigo-500 hover:underline cursor-pointer">{s.actionLabel}</button>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-slate-400 mt-3">Para dar de alta otra empresa: cargá sus códigos en cada proveedor (usá “Cargar valores estándar” para no tipear las URLs) y probá la conexión. Cuando todo esté en verde, está lista.</p>
    </Card>
  )
}

/* ── formulario de configuración ───────────────────────────────────────── */

function ConfigDrawer({ it, companyId, onClose, onSaved }: { it: IntegrationItem; companyId: string; onClose: () => void; onSaved: () => void }) {
  const [environment, setEnvironment] = useState(it.environment || it.environments[it.environments.length - 1])
  const [enabled, setEnabled] = useState(it.enabled || !it.exists)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(it.fields.map((f) => [f.key, f.kind === "secret" ? "" : (it.values[f.key] || "")])))
  const [reveal, setReveal] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmProd, setConfirmProd] = useState(false)
  const prod = environment === "production"

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  const defaults = it.defaults[environment]
  const cargarEstandar = () => setValues((v) => ({ ...v, ...defaults }))

  const save = async () => {
    if (prod && !confirmProd) { setConfirmProd(true); return }
    setSaving(true); setErr(null)
    try {
      const sent: Record<string, string | null> = {}
      for (const f of it.fields) {
        const v = values[f.key]
        if (f.kind === "secret") { if (v) sent[f.key] = v } else sent[f.key] = v || null
      }
      await platform.saveIntegration(it.id, { environment, enabled, values: sent, company_id: companyId })
      onSaved()
    } catch (e: any) {
      setErr(e?.message || "No se pudo guardar"); setConfirmProd(false)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-[560px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center gap-3">
          <div className="min-w-0 flex-1"><h2 className="text-base font-black text-slate-900 dark:text-white">Configurar {it.label}</h2><p className="text-[11px] text-slate-500">{it.description}</p></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 flex flex-col gap-5">
          {prod && <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs font-bold text-rose-800 dark:text-rose-200"><ShieldAlert className="w-4 h-4 shrink-0 mt-px" />Estás editando PRODUCCIÓN. Los cambios se aplican a cobros reales en las cajas.</div>}

          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Ambiente</div>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 gap-0.5">
              {it.environments.map((e) => (
                <button key={e} onClick={() => { setEnvironment(e); setConfirmProd(false) }} className={cx("px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer", environment === e ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500")}>{e === "production" ? "Producción" : "Sandbox (pruebas)"}</button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled(!enabled)} className={cx("relative w-11 h-6 rounded-full transition shrink-0", enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")}><span className={cx("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", enabled ? "left-[22px]" : "left-0.5")} /></button>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{enabled ? "Activada: las cajas la usan" : "Desactivada"}</span>
          </label>

          {defaults && (
            <button onClick={cargarEstandar} className="self-start px-3 py-2 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-500/50 text-xs font-black text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer"><Wand2 className="w-3.5 h-3.5" />Cargar valores estándar de {prod ? "Producción" : "Sandbox"}</button>
          )}

          <div className="flex flex-col gap-4">
            {it.fields.map((f) => {
              const isSecret = f.kind === "secret"
              const yaTiene = isSecret && it.secrets_set[f.key]
              return (
                <div key={f.key}>
                  <label className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">{f.label}{f.required && <span className="text-rose-500">*</span>}{isSecret && <Lock className="w-3 h-3 text-slate-400" />}</label>
                  <div className="relative mt-1">
                    <input
                      type={isSecret && !reveal[f.key] ? "password" : "text"}
                      autoComplete="off" spellCheck={false}
                      value={values[f.key] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={isSecret ? (yaTiene ? "•••••••• guardada — dejá vacío para conservarla" : "Pegá el valor") : ""}
                      className={cx("w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500", f.kind !== "secret" && "font-mono text-[13px]", isSecret && "pr-16")}
                    />
                    {isSecret && values[f.key] && <button type="button" onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 hover:text-slate-700 cursor-pointer">{reveal[f.key] ? "ocultar" : "ver"}</button>}
                  </div>
                  {f.hint && <div className="text-[11px] text-slate-400 mt-1">{f.hint}</div>}
                </div>
              )
            })}
          </div>

          {err && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs font-bold text-rose-700 dark:text-rose-300 break-words">{err}</div>}

          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 -mx-5 px-5 pt-4">
            <button onClick={save} disabled={saving} className={cx("px-5 py-2.5 rounded-xl text-xs font-black text-white flex items-center gap-2 disabled:opacity-60 cursor-pointer", confirmProd ? "bg-rose-600 hover:bg-rose-500" : "bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90")}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{confirmProd ? "Confirmar cambio en PRODUCCIÓN" : "Guardar"}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">Cancelar</button>
            {confirmProd && <span className="text-[11px] text-rose-600 font-bold">Tocá otra vez para aplicar.</span>}
          </div>
        </div>
      </aside>
    </div>
  )
}
