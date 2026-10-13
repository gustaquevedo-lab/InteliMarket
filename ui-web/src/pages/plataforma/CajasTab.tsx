import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle, CheckCircle2, Cpu, Loader2, Monitor, Plus, RefreshCw, Router, Save, ShieldAlert, Smartphone, Trash2, Wifi, WifiOff, X, XCircle, CreditCard, PackageOpen,
} from "lucide-react"
import { platform, type CajaItem, type CajasResponse } from "../../api/platform"
import { Card, Chip, Empty, Skel, Stat, cx, fecha, hace, num } from "./ui"

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const okIp = (v: string) => { const m = v.trim().match(IPV4); return !v.trim() || (!!m && m.slice(1).every((n) => +n <= 255)) }

export default function CajasTab() {
  const [data, setData] = useState<CajasResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CajaItem | "nueva" | null>(null)
  const [filter, setFilter] = useState<"todas" | "problemas" | "online">("todas")
  const [ping, setPing] = useState<Record<string, { ok: boolean; text: string; busy?: boolean }>>({})

  const load = useCallback(async () => {
    try { setData(await platform.cajas()); setError(null) } catch (e: any) { setError(e?.message || "No se pudo cargar") }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const t = setInterval(() => { void load() }, 15000); return () => clearInterval(t) }, [load])

  const doPing = async (c: CajaItem, target: "dinelco" | "bancard" | "pc") => {
    const key = `${c.id}:${target}`
    setPing((p) => ({ ...p, [key]: { ok: false, text: "…", busy: true } }))
    try {
      const r = await platform.pingCaja(c.id, target)
      setPing((p) => ({ ...p, [key]: { ok: r.ok, text: r.ok ? `${r.ms} ms${r.greeting ? ` · ${r.greeting}` : ""}` : r.error || "no responde" } }))
    } catch (e: any) {
      setPing((p) => ({ ...p, [key]: { ok: false, text: e?.message || "error" } }))
    }
  }

  const items = data?.items || []
  const stats = useMemo(() => ({
    activas: items.filter((c) => c.activo).length,
    online: items.filter((c) => c.heartbeat?.online).length,
    conAvisos: items.filter((c) => c.activo && c.warnings.some((w) => w.level === "error")).length,
    vieja: items.filter((c) => c.missing_capabilities.length > 0).length,
  }), [items])
  const shown = items.filter((c) => filter === "todas" || (filter === "online" ? c.heartbeat?.online : c.warnings.length > 0 && c.activo))

  if (error) return <Card><div className="text-sm text-rose-600 font-bold">{error}</div></Card>
  if (!data) return <div className="grid gap-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-20" />)}</div><Skel className="h-72" /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={<Cpu className="w-4 h-4" />}
          label="Cajas Registradas"
          value={stats.activas}
          tone="indigo"
          sub={
            <>
              <span>De {items.length} terminales</span>
              <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">POS Activos</span>
            </>
          }
        />
        <Stat
          icon={<Wifi className="w-4 h-4" />}
          label="Conectadas Ahora"
          value={stats.online}
          tone={stats.online ? "emerald" : "slate"}
          sub={
            <>
              <span>Latido en los últimos 3 min</span>
              <span className={cx("font-bold font-mono", stats.online ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400")}>
                {stats.online ? "Online" : "Offline"}
              </span>
            </>
          }
        />
        <Stat
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Con Alertas / Problemas"
          value={stats.conAvisos}
          tone={stats.conAvisos ? "rose" : "emerald"}
          sub={
            <>
              <span>{stats.conAvisos ? "Requieren revisión" : "Sin incidentes"}</span>
              <span className={cx("font-bold font-mono", stats.conAvisos ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                {stats.conAvisos ? "Alerta" : "OK"}
              </span>
            </>
          }
        />
        <Stat
          icon={<PackageOpen className="w-4 h-4" />}
          label="Versión Desactualizada"
          value={stats.vieja}
          tone={stats.vieja ? "amber" : "emerald"}
          sub={
            <>
              <span className="truncate">{data.current_release ? `Target: ${data.current_release.slice(0, 14)}` : "Release vigente"}</span>
              <span className={cx("font-bold font-mono", stats.vieja ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                {stats.vieja ? "Pendiente" : "Al día"}
              </span>
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 gap-1 shadow-inner">
            {([["todas", "Todas"], ["online", "Conectadas"], ["problemas", "Con avisos"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                  filter === k
                    ? "bg-white dark:bg-slate-700 shadow-xs text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">
            Mapeo IP para POS y terminales de cobro electrónico
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 transition shadow-xs cursor-pointer"
            title="Actualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setEditing("nueva")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva caja
          </button>
        </div>
      </div>

      {shown.length === 0 ? <Card><Empty icon={<Cpu className="w-7 h-7" />} title="No hay cajas para mostrar" hint="Cambiá el filtro o registrá una caja nueva." /></Card> : (
        <div className="grid xl:grid-cols-2 gap-4">
          {shown.map((c) => <CajaCard key={c.id} c={c} ping={ping} onPing={doPing} onEdit={() => setEditing(c)} />)}
        </div>
      )}

      {data.expected_capabilities.length > 0 && (
        <details className="text-[11px] text-slate-400">
          <summary className="cursor-pointer font-bold hover:text-slate-600">Funciones que debe tener la app de caja ({data.expected_capabilities.length})</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">{data.expected_capabilities.map((k) => <span key={k} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300">{k}</span>)}</div>
        </details>
      )}

      {editing && <CajaDrawer caja={editing === "nueva" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
    </div>
  )
}

function Ip({ label, icon, ip, target, c, ping, onPing, warn }: { label: string; icon: React.ReactNode; ip?: string | null; target: "dinelco" | "bancard" | "pc"; c: CajaItem; ping: Record<string, { ok: boolean; text: string; busy?: boolean }>; onPing: (c: CajaItem, t: "dinelco" | "bancard" | "pc") => void; warn?: boolean }) {
  const r = ping[`${c.id}:${target}`]
  return (
    <div className={cx("rounded-xl px-3 py-2 border", warn ? "border-rose-300 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-500/10" : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40")}>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">{icon}{label}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className={cx("font-mono text-[13px] font-bold", ip ? "text-slate-900 dark:text-white" : "text-slate-300")}>{ip || "sin configurar"}</span>
        {ip && (
          <button onClick={() => onPing(c, target)} disabled={r?.busy} className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-black border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer" title={target === "dinelco" ? "No probar durante una venta" : "Probar conexión"}>
            {r?.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Probar"}
          </button>
        )}
      </div>
      {r && !r.busy && <div className={cx("text-[10px] font-bold mt-0.5", r.ok ? "text-emerald-600" : "text-rose-600")}>{r.ok ? "✓ " : "✕ "}{r.text}</div>}
    </div>
  )
}

function CajaCard({ c, ping, onPing, onEdit }: { c: CajaItem; ping: Record<string, { ok: boolean; text: string; busy?: boolean }>; onPing: (c: CajaItem, t: "dinelco" | "bancard" | "pc") => void; onEdit: () => void }) {
  const hb = c.heartbeat
  const dupIps = new Set(c.warnings.filter((w) => w.level === "error").map((w) => (w.text.match(/IP ([\d.]+)/) || [])[1]))
  const tot = c.tx_24h.ok + c.tx_24h.fail
  return (
    <Card pad={false} className={cx(!c.activo && "opacity-60", c.warnings.some((w) => w.level === "error") && c.activo && "ring-1 ring-rose-300 dark:ring-rose-500/40")}>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className={cx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", hb?.online ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-slate-800")}>
            {hb?.online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h3 className="text-[15px] font-black text-slate-900 dark:text-white truncate">{c.caja_nombre}</h3>{!c.activo && <Chip className="bg-slate-100 text-slate-500 border-slate-200">inactiva</Chip>}</div>
            <div className="text-[11px] text-slate-500 truncate"><span className="font-mono">{c.hostname}</span> · punto {c.punto_emision} · {hb ? (hb.online ? <b className="text-emerald-600">conectada</b> : <>vista {hace(hb.last_seen)}</>) : "sin latidos todavía"}{hb?.user_name ? ` · ${hb.user_name}` : ""}</div>
          </div>
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Editar</button>
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          <Ip label="Dinelco" icon={<Smartphone className="w-3 h-3" />} ip={c.ip_dinelco} target="dinelco" c={c} ping={ping} onPing={onPing} warn={!!c.ip_dinelco && dupIps.has(c.ip_dinelco)} />
          <Ip label="Bancard" icon={<CreditCard className="w-3 h-3" />} ip={c.ip_bancard} target="bancard" c={c} ping={ping} onPing={onPing} warn={!!c.ip_bancard && dupIps.has(c.ip_bancard)} />
          <Ip label="PC de la caja" icon={<Monitor className="w-3 h-3" />} ip={c.ip_pc} target="pc" c={c} ping={ping} onPing={onPing} warn={!!c.ip_pc && dupIps.has(c.ip_pc)} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
          <span>Cobros con terminal 24 h: <b className="text-emerald-600">{num(c.tx_24h.ok)}</b> ok · <b className={c.tx_24h.fail ? "text-rose-600" : "text-slate-400"}>{num(c.tx_24h.fail)}</b> fallidos{tot ? ` (${Math.round((c.tx_24h.ok / tot) * 100)}%)` : ""}</span>
          {c.last_tx && <span className="flex items-center gap-1">{c.last_tx.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-rose-500" />}Último: {c.last_tx.tipo.replace(/_/g, " ")} {hace(c.last_tx.ts)}{!c.last_tx.ok && c.last_tx.error ? ` (${c.last_tx.error})` : ""}</span>}
          {hb && <span className="font-mono text-[10px] text-slate-400" title={`${hb.electron_version ? `Electron ${hb.electron_version} · ` : ""}último latido ${fecha(hb.last_seen)}`}>pantalla {hb.release || "?"}{hb.app_version ? ` · app ${hb.app_version}` : ""}</span>}
        </div>

        {c.warnings.length > 0 && c.activo && (
          <ul className="space-y-1.5">
            {c.warnings.map((w, i) => (
              <li key={i} className={cx("flex items-start gap-2 text-[11px] font-bold rounded-lg px-3 py-2", w.level === "error" ? "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200" : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200")}>
                {w.level === "error" ? <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />}{w.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function CajaDrawer({ caja, onClose, onSaved }: { caja: CajaItem | null; onClose: () => void; onSaved: () => void }) {
  const nueva = !caja
  const [f, setF] = useState({
    hostname: "", punto_emision: "", caja_nombre: caja?.caja_nombre || "", ip_address: caja?.ip_pc || "",
    ip_pos_bancard: caja?.ip_bancard || "", ip_pos_dinelco: caja?.ip_dinelco || "", activo: caja?.activo ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [del, setDel] = useState(false)
  const bad = (["ip_address", "ip_pos_bancard", "ip_pos_dinelco"] as const).filter((k) => !okIp(f[k]))

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      if (nueva) {
        await platform.createCaja({ hostname: f.hostname.trim(), punto_emision: f.punto_emision.trim(), caja_nombre: f.caja_nombre.trim(),
          ip_address: f.ip_address.trim() || undefined, ip_pos_bancard: f.ip_pos_bancard.trim() || undefined, ip_pos_dinelco: f.ip_pos_dinelco.trim() || undefined })
      } else {
        await platform.updateCaja(caja!.id, { caja_nombre: f.caja_nombre.trim(), activo: f.activo,
          ip_address: f.ip_address.trim() || null, ip_pos_bancard: f.ip_pos_bancard.trim() || null, ip_pos_dinelco: f.ip_pos_dinelco.trim() || null })
      }
      onSaved()
    } catch (e: any) { setErr(e?.message || "No se pudo guardar") } finally { setSaving(false) }
  }
  const remove = async () => {
    setSaving(true)
    try { await platform.deleteCaja(caja!.id); onSaved() } catch (e: any) { setErr(e?.message || "No se pudo eliminar") } finally { setSaving(false) }
  }

  const inp = (k: "hostname" | "punto_emision" | "caja_nombre" | "ip_address" | "ip_pos_bancard" | "ip_pos_dinelco", label: string, ph = "", mono = true, hint?: string) => (
    <div>
      <label className="text-xs font-black text-slate-800 dark:text-slate-100">{label}</label>
      <input value={(f as any)[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} placeholder={ph} spellCheck={false}
        className={cx("w-full mt-1 px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border outline-none focus:border-indigo-500", mono && "font-mono text-[13px]", (bad as string[]).includes(k) ? "border-rose-400" : "border-slate-200 dark:border-slate-700")} />
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
      {(bad as string[]).includes(k) && <div className="text-[11px] text-rose-600 font-bold mt-1">No es una IP válida (ejemplo: 192.168.0.87)</div>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-[520px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center gap-3">
          <div className="min-w-0 flex-1"><h2 className="text-base font-black text-slate-900 dark:text-white">{nueva ? "Nueva caja" : `Editar ${caja!.caja_nombre}`}</h2><p className="text-[11px] text-slate-500">{nueva ? "Asigna una máquina a un punto de emisión fijo." : `${caja!.hostname} · punto ${caja!.punto_emision}`}</p></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {nueva && <>{inp("hostname", "Nombre de la PC (hostname de Windows)", "CAJA9", true, "Es el nombre que muestra Windows; la app lo reconoce sola.")}{inp("punto_emision", "Punto de emisión (3 dígitos)", "019")}</>}
          {inp("caja_nombre", "Nombre de la caja", "Caja 9 - Esquina", false)}
          <div className="grid gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Direcciones de red (IP fija)</div>
            {inp("ip_pos_dinelco", "Terminal Dinelco", "192.168.0.87")}
            {inp("ip_pos_bancard", "Terminal Bancard", "192.168.0.37")}
            {inp("ip_address", "PC de la caja", "192.168.0.17")}
            <div className="text-[11px] text-slate-400 flex gap-1.5"><Router className="w-3.5 h-3.5 shrink-0 mt-px" />Cada equipo necesita su propia IP. Si repetís una que ya usa otra caja, el sistema no te deja guardar.</div>
          </div>
          {!nueva && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={f.activo} onClick={() => setF((s) => ({ ...s, activo: !s.activo }))} className={cx("relative w-11 h-6 rounded-full transition shrink-0", f.activo ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")}><span className={cx("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", f.activo ? "left-[22px]" : "left-0.5")} /></button>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{f.activo ? "Caja activa" : "Caja inactiva (no se usa)"}</span>
            </label>
          )}
          {err && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs font-bold text-rose-700 dark:text-rose-300 break-words">{err}</div>}
          <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button onClick={save} disabled={saving || bad.length > 0 || (nueva && (!f.hostname.trim() || !/^\d{3}$/.test(f.punto_emision.trim()) || !f.caja_nombre.trim()))} className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black flex items-center gap-2 disabled:opacity-40 cursor-pointer">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{nueva ? "Crear caja" : "Guardar"}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">Cancelar</button>
            {!nueva && (
              <div className="ml-auto">
                {del ? <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600">¿Eliminar la asignación?<button onClick={remove} className="px-2 py-1 rounded-md bg-rose-600 text-white cursor-pointer">Sí</button><button onClick={() => setDel(false)} className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer">No</button></span>
                  : <button onClick={() => setDel(true)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer" title="Eliminar"><Trash2 className="w-4 h-4" /></button>}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
