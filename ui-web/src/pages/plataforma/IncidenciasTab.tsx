import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import {
  AlertTriangle, ArrowUpRight, Bug, CheckCircle2, ClipboardCopy, EyeOff, Loader2, MousePointerClick, RefreshCw, RotateCcw, Search,
  Trash2, Waypoints, X, Globe, Terminal, Wifi,
} from "lucide-react"
import { platform, type Env, type Issue, type IssueEvent, type IssueStatus } from "../../api/platform"
import { Card, Chip, Empty, LEVEL, SOURCE, Segmented, Skel, Spark, cx, fecha, hace, num } from "./ui"

type StatusFilter = "unresolved" | "resolved" | "ignored" | "all"

const PROVIDERS = ["dinelco", "bancard", "bancard_qr", "plugpay"]

export default function IncidenciasTab({ env, initialIssueId, initialProvider, onOpenChange }: { env: Env; initialIssueId?: string | null; initialProvider?: string | null; onOpenChange?: (id: string | null) => void }) {
  const [status, setStatus] = useState<StatusFilter>("unresolved")
  const [source, setSource] = useState("")
  const [provider, setProvider] = useState(initialProvider || "")
  const [level, setLevel] = useState("")
  const [q, setQ] = useState("")
  const [qDeb, setQDeb] = useState("")
  const [sort, setSort] = useState("last_seen")
  const [items, setItems] = useState<Issue[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(initialIssueId || null)
  const [busy, setBusy] = useState(false)
  const firstLoad = useRef(true)

  useEffect(() => { const t = setTimeout(() => setQDeb(q), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { onOpenChange?.(openId) }, [openId]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    try {
      const r = await platform.issues({ status, source: source || undefined, provider: provider || undefined, level: level || undefined, env, q: qDeb || undefined, sort, limit: 100 })
      setItems(r.items)
      setTotal(r.total)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar")
    } finally {
      setLoading(false)
      firstLoad.current = false
    }
  }, [status, source, provider, level, env, qDeb, sort])

  useEffect(() => { setLoading(true); void load() }, [load])
  useEffect(() => { const t = setInterval(() => { void load() }, 20000); return () => clearInterval(t) }, [load])

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = items.length > 0 && items.every((i) => sel.has(i.id))

  const act = async (ids: string[], st: IssueStatus, hours?: number) => {
    setBusy(true)
    try {
      await platform.bulkStatus(ids, st, hours ? { ignore_hours: hours } : undefined)
      setSel(new Set())
      await load()
    } finally { setBusy(false) }
  }

  const testIssue = async () => {
    setBusy(true)
    try { const r = await platform.testIssue(); await load(); setOpenId(r.issue_id) } finally { setBusy(false) }
  }

  const counts = useMemo(() => ({ open: items.filter((i) => i.status === "unresolved").length }), [items])

  return (
    <div className="flex flex-col gap-4">
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented<StatusFilter>
          value={status}
          onChange={(v) => { setStatus(v); setSel(new Set()) }}
          options={[
            { value: "unresolved", label: "Abiertas" },
            { value: "resolved", label: "Resueltas" },
            { value: "ignored", label: "Ignoradas" },
            { value: "all", label: "Todas" },
          ]}
        />
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título o archivo…"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500"
          />
        </div>
        <Sel value={source} onChange={setSource} label="Origen" options={Object.entries(SOURCE).map(([k, v]) => [k, v.label])} />
        <Sel value={provider} onChange={setProvider} label="Integración" options={PROVIDERS.map((p) => [p, p])} />
        <Sel value={level} onChange={setLevel} label="Nivel" options={Object.entries(LEVEL).map(([k, v]) => [k, v.label])} />
        <Sel value={sort} onChange={setSort} label="Orden" allowEmpty={false} options={[["last_seen", "Más reciente"], ["occurrences", "Más frecuente"], ["first_seen", "Más nueva"]]} />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setLoading(true); void load() }} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer" title="Actualizar">
            <RefreshCw className={cx("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
          <button onClick={testIssue} disabled={busy} className="px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer" title="Crea una incidencia de prueba (no manda WhatsApp)">
            Generar prueba
          </button>
        </div>
      </div>

      {/* acciones en lote */}
      {sel.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-lg">
          <span>{sel.size} seleccionadas</span>
          <span className="opacity-40">|</span>
          <button disabled={busy} onClick={() => act([...sel], "resolved")} className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer">Resolver</button>
          <button disabled={busy} onClick={() => act([...sel], "ignored", 24)} className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer">Ignorar 24 h</button>
          <button disabled={busy} onClick={() => act([...sel], "unresolved")} className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer">Reabrir</button>
          <button onClick={() => setSel(new Set())} className="ml-auto opacity-80 hover:opacity-100 cursor-pointer">Cancelar</button>
        </div>
      )}

      <Card pad={false}>
        {error && <div className="p-4 text-xs text-rose-600 font-bold">{error}</div>}
        {loading && firstLoad.current ? (
          <div className="p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-14" />)}</div>
        ) : items.length === 0 ? (
          <Empty
            icon={<CheckCircle2 className="w-7 h-7 text-emerald-500" />}
            title={status === "unresolved" ? "Sin incidencias abiertas" : "No hay resultados"}
            hint={status === "unresolved" ? "Todo en orden. Cuando algo falle en una caja, en el servidor o en un terminal de cobro, aparece acá solo." : "Probá cambiando los filtros."}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <li className="hidden md:grid grid-cols-[28px_1fr_110px_70px_90px_96px] gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 items-center">
              <input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(items.map((i) => i.id)))} className="cursor-pointer" />
              <span>Incidencia · {num(total)}</span><span>24 horas</span><span className="text-right">Eventos</span><span>Visto</span><span />
            </li>
            {items.map((it) => <Row key={it.id} it={it} checked={sel.has(it.id)} onCheck={() => toggle(it.id)} onOpen={() => setOpenId(it.id)} onAct={act} busy={busy} />)}
          </ul>
        )}
      </Card>

      {openId && <Drawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

function Sel({ value, onChange, label, options, allowEmpty = true }: { value: string; onChange: (v: string) => void; label: string; options: string[][]; allowEmpty?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="px-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
      {allowEmpty && <option value="">{label}: todos</option>}
      {options.map(([v, l]) => <option key={v} value={v}>{allowEmpty ? `${label}: ${l}` : l}</option>)}
    </select>
  )
}

function Row({ it, checked, onCheck, onOpen, onAct, busy }: { it: Issue; checked: boolean; onCheck: () => void; onOpen: () => void; onAct: (ids: string[], s: IssueStatus, h?: number) => void; busy: boolean }) {
  const lv = LEVEL[it.level] || LEVEL.error
  const src = SOURCE[it.source]
  const open = it.status === "unresolved"
  return (
    <li className={cx("group grid grid-cols-[28px_1fr] md:grid-cols-[28px_1fr_110px_70px_90px_96px] gap-3 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition", !open && "opacity-70")}>
      <input type="checkbox" checked={checked} onChange={onCheck} className="cursor-pointer" />
      <button onClick={onOpen} className="text-left min-w-0 cursor-pointer">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cx("w-2 h-2 rounded-full shrink-0", lv.dot, it.level === "fatal" && open && "animate-pulse")} />
          <span className="font-black text-[13px] text-slate-900 dark:text-white truncate">{it.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 pl-4">
          <Chip className={src?.chip}>{src && <src.Icon className="w-3 h-3" />}{src?.label || it.source}</Chip>
          {it.provider && <Chip className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">{it.provider}</Chip>}
          {it.regressions > 0 && <Chip className="bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30" title="Ya estaba resuelta y volvió a pasar">↩ volvió ×{it.regressions}</Chip>}
          {it.status !== "unresolved" && <Chip className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">{it.status === "resolved" ? "resuelta" : "ignorada"}</Chip>}
          {it.cajas_count > 0 && <span className="text-[10px] text-slate-400 font-bold">{it.cajas.slice(0, 3).map(([c]) => c).join(" · ")}{it.cajas_count > 3 && ` +${it.cajas_count - 3}`}</span>}
          {it.culprit && <span className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]">{it.culprit}</span>}
        </div>
      </button>
      <div className="hidden md:block"><Spark data={it.spark} color={it.level === "warning" ? "#f59e0b" : "#f43f5e"} /></div>
      <div className="hidden md:block text-right font-black text-sm tabular-nums text-slate-800 dark:text-slate-100">{num(it.occurrences)}</div>
      <div className="hidden md:block text-[11px] text-slate-500 font-semibold leading-tight">{hace(it.last_seen)}</div>
      <div className="hidden md:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
        {open ? (
          <>
            <button disabled={busy} onClick={() => onAct([it.id], "resolved")} title="Marcar como resuelta" className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/15 text-emerald-600 cursor-pointer"><CheckCircle2 className="w-4 h-4" /></button>
            <button disabled={busy} onClick={() => onAct([it.id], "ignored", 24)} title="Ignorar 24 horas" className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"><EyeOff className="w-4 h-4" /></button>
          </>
        ) : (
          <button disabled={busy} onClick={() => onAct([it.id], "unresolved")} title="Reabrir" className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"><RotateCcw className="w-4 h-4" /></button>
        )}
        <button onClick={onOpen} title="Ver detalle" className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/15 text-indigo-500 cursor-pointer"><ArrowUpRight className="w-4 h-4" /></button>
      </div>
    </li>
  )
}

/* ─────────────────────────── detalle ─────────────────────────── */

const CRUMB: Record<string, { c: string; Icon: typeof Bug }> = {
  nav: { c: "bg-sky-500", Icon: Globe },
  click: { c: "bg-violet-500", Icon: MousePointerClick },
  api: { c: "bg-emerald-500", Icon: Waypoints },
  console: { c: "bg-amber-500", Icon: Terminal },
}

function issueAsText(issue: Issue, ev?: IssueEvent) {
  const L = [`# ${issue.title}`, `Estado: ${issue.status} · Origen: ${issue.source}${issue.provider ? ` (${issue.provider})` : ""} · Nivel: ${issue.level}`,
    `Ocurrencias: ${issue.occurrences} · Primera: ${fecha(issue.first_seen)} · Última: ${fecha(issue.last_seen)}`,
    `Versión: ${issue.last_release || "—"}`]
  if (issue.cajas.length) L.push(`Cajas: ${issue.cajas.map(([c, n]) => `${c} (${n})`).join(", ")}`)
  if (ev) {
    L.push("", "## Último evento", `Mensaje: ${ev.message || "—"}`)
    if (ev.route) L.push(`Ruta: ${ev.http_method || ""} ${ev.route}${ev.http_status ? ` -> ${ev.http_status}` : ""}`)
    if (ev.user_name) L.push(`Usuario: ${ev.user_name} (${ev.rol || "?"}) · Caja: ${ev.hostname || ev.punto_emision || "—"}`)
    if (ev.extra) L.push(`Datos: ${JSON.stringify(ev.extra)}`)
    if (ev.stack) L.push("", "```", ev.stack, "```")
    if (ev.breadcrumbs?.length) L.push("", "## Últimas acciones", ...ev.breadcrumbs.map((b) => `${b.t} [${b.type}] ${b.msg}`))
  }
  return L.join("\n")
}

function Drawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ issue: Issue; series_7d: number[]; events: IssueEvent[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ei, setEi] = useState(0)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const load = useCallback(async () => {
    try { setData(await platform.issue(id)); setErr(null) } catch (e: any) { setErr(e?.message || "No se pudo cargar la incidencia") }
  }, [id])
  useEffect(() => { setData(null); setEi(0); void load() }, [load])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  const setSt = async (st: IssueStatus, hours?: number) => {
    setBusy(true)
    try { await platform.setStatus(id, st, hours ? { ignore_hours: hours } : undefined); await load(); onChanged() } finally { setBusy(false) }
  }
  const del = async () => { setBusy(true); try { await platform.deleteIssue(id); onChanged(); onClose() } finally { setBusy(false) } }

  const issue = data?.issue
  const ev = data?.events[ei]
  const lv = issue ? LEVEL[issue.level] || LEVEL.error : LEVEL.error
  const src = issue ? SOURCE[issue.source] : undefined
  const series = (data?.series_7d || []).map((c, i, a) => ({ i, c, h: new Date(Date.now() - (a.length - 1 - i) * 3600_000) }))

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-[860px] h-full bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto animate-in slide-in-from-right">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <div className={cx("mt-1 w-2.5 h-2.5 rounded-full shrink-0", lv.dot)} />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-snug break-words">{issue?.title || "Cargando…"}</h2>
              {issue && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <Chip className={lv.chip}>{lv.label}</Chip>
                  {src && <Chip className={src.chip}><src.Icon className="w-3 h-3" />{src.label}</Chip>}
                  {issue.provider && <Chip className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">{issue.provider}</Chip>}
                  <Chip className={issue.status === "unresolved" ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30"}>
                    {issue.status === "unresolved" ? "abierta" : issue.status === "resolved" ? "resuelta" : "ignorada"}
                  </Chip>
                  {issue.environment !== "production" && <Chip className="bg-amber-50 text-amber-800 border-amber-200">{issue.environment}</Chip>}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          {issue && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {issue.status === "unresolved" ? (
                <>
                  <button disabled={busy} onClick={() => setSt("resolved")} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"><CheckCircle2 className="w-3.5 h-3.5" />Resolver</button>
                  <button disabled={busy} onClick={() => setSt("ignored", 24)} className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"><EyeOff className="w-3.5 h-3.5" />Ignorar 24 h</button>
                  <button disabled={busy} onClick={() => setSt("ignored", 24 * 7)} className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black cursor-pointer">7 días</button>
                </>
              ) : (
                <button disabled={busy} onClick={() => setSt("unresolved")} className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black flex items-center gap-1.5 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />Reabrir</button>
              )}
              <button onClick={() => { void navigator.clipboard.writeText(issueAsText(issue, ev)); setCopied(true); setTimeout(() => setCopied(false), 1800) }} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Copia el resumen con el error y las últimas acciones, listo para pegar en un chat">
                <ClipboardCopy className="w-3.5 h-3.5" />{copied ? "¡Copiado!" : "Copiar resumen"}
              </button>
              <div className="ml-auto">
                {confirmDel ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600">¿Eliminar?
                    <button onClick={del} className="px-2 py-1 rounded-md bg-rose-600 text-white cursor-pointer">Sí</button>
                    <button onClick={() => setConfirmDel(false)} className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer">No</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDel(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          )}
        </div>

        {err && <div className="m-5 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold">{err}</div>}
        {!data && !err && <div className="p-5 space-y-3"><Skel className="h-24" /><Skel className="h-40" /><Skel className="h-32" /></div>}

        {data && issue && (
          <div className="p-5 flex flex-col gap-4">
            {/* números */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Mini k="Ocurrencias" v={num(issue.occurrences)} />
              <Mini k="Primera vez" v={hace(issue.first_seen)} sub={fecha(issue.first_seen)} />
              <Mini k="Última vez" v={hace(issue.last_seen)} sub={fecha(issue.last_seen)} />
              <Mini k="Versión" v={issue.last_release || "—"} sub={issue.first_release && issue.first_release !== issue.last_release ? `desde ${issue.first_release}` : undefined} />
            </div>

            {issue.regressions > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Esta incidencia ya estaba resuelta y volvió a pasar {issue.regressions} {issue.regressions === 1 ? "vez" : "veces"}.
                {issue.resolved_by && <span className="font-medium opacity-80"> Resuelta antes por {issue.resolved_by}{issue.resolved_release ? ` en ${issue.resolved_release}` : ""}.</span>}
              </div>
            )}

            <Card title="Últimos 7 días" right={<span className="text-[10px] text-slate-400 font-bold">eventos por hora</span>}>
              <div className="h-24 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={0}>
                    <XAxis dataKey="i" hide />
                    <Tooltip cursor={{ fill: "rgba(148,163,184,.15)" }} content={({ active, payload }) => active && payload?.length ? (
                      <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold shadow-lg">{fecha((payload[0].payload as any).h.toISOString())} · {payload[0].value}</div>
                    ) : null} />
                    <Bar dataKey="c" fill="#f43f5e" radius={[1, 1, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              <Dim title="Cajas afectadas" rows={issue.cajas} />
              <Dim title="Usuarios" rows={issue.users} />
              <Dim title="Versiones" rows={issue.releases} />
              <Dim title="Pantallas / rutas" rows={issue.routes} mono />
            </div>

            {/* eventos */}
            <Card title={`Eventos recientes (${data.events.length})`} pad={false}>
              <div className="flex gap-1.5 overflow-x-auto px-4 pt-1 pb-3">
                {data.events.map((e, i) => (
                  <button key={e.id} onClick={() => setEi(i)} className={cx("shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer", i === ei ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white")}>
                    {hace(e.ts)}{e.hostname ? ` · ${e.hostname}` : ""}
                  </button>
                ))}
              </div>
              {ev && <EventBody ev={ev} />}
            </Card>
          </div>
        )}
      </aside>
    </div>
  )
}

function Mini({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k}</div>
      <div className="text-sm font-black text-slate-900 dark:text-white truncate">{v}</div>
      {sub && <div className="text-[10px] text-slate-400 truncate">{sub}</div>}
    </div>
  )
}

function Dim({ title, rows, mono }: { title: string; rows: [string, number][]; mono?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <Card title={title}>
      {rows.length === 0 ? <div className="text-xs text-slate-400 py-2">Sin datos</div> : (
        <ul className="space-y-2">
          {rows.map(([k, n]) => (
            <li key={k}>
              <div className="flex items-center justify-between text-xs mb-0.5 gap-2">
                <span className={cx("font-bold text-slate-700 dark:text-slate-200 truncate", mono && "font-mono text-[11px]")}>{k}</span>
                <span className="text-slate-400 font-black tabular-nums">{n}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function EventBody({ ev }: { ev: IssueEvent }) {
  const ctx: [string, string | number | null | undefined][] = [
    ["Fecha", fecha(ev.ts)], ["Usuario", ev.user_name ? `${ev.user_name}${ev.rol ? ` (${ev.rol})` : ""}` : null],
    ["Caja", ev.hostname || ev.punto_emision], ["Ruta", ev.route ? `${ev.http_method || ""} ${ev.route}` : ev.url],
    ["HTTP", ev.http_status], ["Duración", ev.duration_ms ? `${num(ev.duration_ms)} ms` : null], ["Request", ev.request_id],
    ["IP", ev.client_ip], ["Versión", ev.release], ["App", ev.app_version],
  ]
  return (
    <div className="px-4 pb-4 space-y-4">
      {ev.message && <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-[13px] font-bold text-rose-800 dark:text-rose-200 break-words whitespace-pre-wrap">{ev.message}</div>}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
        {ctx.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
          <div key={k} className="min-w-0"><dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k}</dt><dd className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate" title={String(v)}>{v}</dd></div>
        ))}
      </dl>
      {ev.extra && Object.keys(ev.extra).length > 0 && (
        <div><div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Datos adjuntos</div>
          <div className="flex flex-wrap gap-1.5">{Object.entries(ev.extra).map(([k, v]) => <span key={k} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-200"><b>{k}</b>: {String(v)}</span>)}</div></div>
      )}
      {ev.stack && (
        <div><div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Stack trace</div>
          <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] leading-relaxed font-mono overflow-x-auto max-h-72">{ev.stack}</pre></div>
      )}
      {ev.breadcrumbs && ev.breadcrumbs.length > 0 && (
        <div><div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Qué estaba haciendo antes del error</div>
          <ol className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-2 space-y-2.5">
            {ev.breadcrumbs.map((b, i) => {
              const c = CRUMB[b.type] || { c: "bg-slate-400", Icon: Wifi }
              const bad = /SIN CONEXION|-> 5\d\d/.test(b.msg)
              return (
                <li key={i} className="pl-4 relative">
                  <span className={cx("absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-slate-50 dark:ring-slate-950", bad ? "bg-rose-500" : c.c)} />
                  <div className="flex items-baseline gap-2 text-xs"><span className="font-mono text-slate-400 text-[10px]">{b.t}</span><span className="text-[10px] font-black uppercase text-slate-400">{b.type}</span></div>
                  <div className={cx("text-xs break-words", bad ? "text-rose-600 font-bold" : "text-slate-700 dark:text-slate-200")}>{b.msg}</div>
                </li>
              )
            })}
          </ol></div>
      )}
      {ev.user_agent && <div className="text-[10px] text-slate-400 break-all font-mono">{ev.user_agent}</div>}
    </div>
  )
}
