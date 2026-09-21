import { useCallback, useEffect, useState } from "react"
import { BellRing, ChevronDown, ChevronRight, Loader2, MessageCircle, Send, ShieldCheck } from "lucide-react"
import { platform, type AlertSettings, type AuditRow } from "../../api/platform"
import { Card, Chip, Empty, Skel, cx, fecha, hace } from "./ui"

const ACCION: Record<string, string> = {
  incidencia_resolved: "Resolvió una incidencia", incidencia_ignored: "Ignoró una incidencia", incidencia_unresolved: "Reabrió una incidencia",
  incidencias_resolved: "Resolvió varias incidencias", incidencias_ignored: "Ignoró varias incidencias", incidencias_unresolved: "Reabrió varias incidencias",
  incidencia_eliminada: "Eliminó una incidencia", alertas_configuradas: "Cambió las alertas",
  integracion_actualizada: "Cambió una integración", integracion_plantilla: "Aplicó valores por defecto a una integración",
  caja_actualizada: "Cambió una caja/terminal", caja_creada: "Creó una asignación de caja", caja_eliminada: "Eliminó una asignación de caja",
  tenant_actualizado: "Cambió un tenant", tenant_creado: "Creó un tenant",
}

export function AuditoriaTab() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState("")
  const [qd, setQd] = useState("")
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { const t = setTimeout(() => setQd(q), 300); return () => clearTimeout(t) }, [q])
  const load = useCallback(async () => {
    try { const r = await platform.audit({ limit: 100, q: qd || undefined }); setRows(r.items); setTotal(r.total) } finally { setLoading(false) }
  }, [qd])
  useEffect(() => { setLoading(true); void load() }, [load])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por persona o elemento…" className="w-full max-w-sm px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500" />
        <span className="text-xs text-slate-400 font-bold">{total} registros</span>
      </div>
      <Card pad={false}>
        {loading ? <div className="p-4 space-y-2">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-12" />)}</div> : rows.length === 0 ? (
          <Empty icon={<ShieldCheck className="w-7 h-7" />} title="Todavía no hay cambios registrados" hint="Cada vez que cambies una credencial, una IP, un tenant o el estado de una incidencia queda anotado acá: quién, cuándo y desde dónde." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => {
              const has = r.before || r.after
              return (
                <li key={r.id}>
                  <button onClick={() => has && setOpen(open === r.id ? null : r.id)} className={cx("w-full flex items-center gap-3 px-4 py-3 text-left", has && "hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer")}>
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-black shrink-0">{(r.actor_name || "?").slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-slate-900 dark:text-white"><b>{r.actor_name || "Sistema"}</b> · {ACCION[r.action] || r.action}</div>
                      <div className="text-[11px] text-slate-500 truncate">{r.target_label || r.target_type}{r.client_ip ? ` · desde ${r.client_ip}` : ""}</div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-semibold shrink-0"><div>{hace(r.ts)}</div><div className="text-[10px]">{fecha(r.ts)}</div></div>
                    {has ? (open === r.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />) : <span className="w-4" />}
                  </button>
                  {open === r.id && has && (
                    <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3">
                      <Diff title="Antes" data={r.before} tone="rose" />
                      <Diff title="Después" data={r.after} tone="emerald" />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Diff({ title, data, tone }: { title: string; data?: Record<string, unknown> | null; tone: "rose" | "emerald" }) {
  return (
    <div className={cx("rounded-xl p-3 border text-xs", tone === "rose" ? "bg-rose-50/60 border-rose-100 dark:bg-rose-500/5 dark:border-rose-500/20" : "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20")}>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">{title}</div>
      {data && Object.keys(data).length ? (
        <dl className="space-y-1">{Object.entries(data).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="font-black text-slate-500 shrink-0">{k}:</dt><dd className="font-mono text-slate-800 dark:text-slate-100 break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd></div>)}</dl>
      ) : <span className="text-slate-400">—</span>}
    </div>
  )
}

export function AlertasTab() {
  const [s, setS] = useState<AlertSettings | null>(null)
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => { platform.settings().then((x) => { setS(x); setPhone(x.alert_phone) }).catch(() => {}) }, [])
  const save = async (patch: Partial<AlertSettings>) => {
    setSaving(true); setMsg(null)
    try { const n = await platform.putSettings(patch); setS(n); setPhone(n.alert_phone); setMsg({ ok: true, t: "Guardado" }) }
    catch (e: any) { setMsg({ ok: false, t: e?.message || "No se pudo guardar" }) }
    finally { setSaving(false) }
  }
  const test = async () => {
    setTesting(true); setMsg(null)
    try {
      const r = await platform.alertsTest()
      setMsg({ ok: r.bell || r.whatsapp, t: `Prueba enviada — campana: ${r.bell ? "sí" : "no"} · WhatsApp: ${r.whatsapp ? "sí" : "no (¿está conectado?)"}` })
    } catch (e: any) { setMsg({ ok: false, t: e?.message || "Falló la prueba" }) } finally { setTesting(false) }
  }

  if (!s) return <Skel className="h-64 max-w-2xl" />
  return (
    <div className="grid lg:grid-cols-2 gap-4 max-w-5xl">
      <Card title="Cómo te avisamos">
        <div className="space-y-4">
          <Toggle icon={<MessageCircle className="w-4 h-4" />} title="WhatsApp" hint="Mensaje al número de abajo cuando pasa algo importante. Máximo 8 por hora para no saturarte." on={s.whatsapp_enabled} onChange={(v) => save({ whatsapp_enabled: v })} />
          <Toggle icon={<BellRing className="w-4 h-4" />} title="Campana del sistema" hint="Aviso dentro de InteliMarket para todos los superadmins, sin tope." on={s.bell_enabled} onChange={(v) => save({ bell_enabled: v })} />
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Número de WhatsApp (con código de país, sin +)</label>
            <div className="flex gap-2 mt-1">
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="595994516360" className="flex-1 px-3 py-2 rounded-xl text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500" />
              <button disabled={saving || phone === s.alert_phone || phone.length < 10} onClick={() => save({ alert_phone: phone })} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black disabled:opacity-40 cursor-pointer">Guardar</button>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={test} disabled={testing} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-60">
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar mensaje de prueba
            </button>
            {msg && <span className={cx("text-xs font-bold", msg.ok ? "text-emerald-600" : "text-rose-600")}>{msg.t}</span>}
          </div>
        </div>
      </Card>
      <Card title="Cuándo te avisamos">
        <ul className="space-y-3 text-sm">
          {[
            ["🆕", "Incidencia nueva", "La primera vez que aparece un error o una falla de un terminal de cobro."],
            ["♻️", "Volvió a pasar", "Algo que habías marcado como resuelto vuelve a fallar."],
            ["🔥", "Pico de errores", "Ocho o más veces el mismo problema en 5 minutos (una caja trabada, un terminal caído)."],
          ].map(([i, t, d]) => (
            <li key={t} className="flex gap-3"><span className="text-xl leading-none">{i}</span><div><div className="font-black text-slate-900 dark:text-white text-[13px]">{t}</div><div className="text-xs text-slate-500">{d}</div></div></li>
          ))}
        </ul>
        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 leading-relaxed">
          Los avisos de <b>advertencia</b> (por ejemplo, un cliente que cancela en el terminal) no molestan: quedan registrados pero no suenan. Las incidencias que ya marcaste como <b>ignoradas</b> tampoco avisan. El sandbox nunca manda WhatsApp.
        </div>
      </Card>
    </div>
  )
}

function Toggle({ icon, title, hint, on, onChange }: { icon: React.ReactNode; title: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0"><div className="text-[13px] font-black text-slate-900 dark:text-white">{title}</div><div className="text-xs text-slate-500">{hint}</div></div>
      <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx("relative w-11 h-6 rounded-full transition shrink-0 cursor-pointer", on ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")}>
        <span className={cx("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  )
}
